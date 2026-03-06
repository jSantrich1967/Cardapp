"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { LoadingDots } from "@/components/ui/loading-dots";
import { getCached, setCache } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { normalizeDateKey } from "@/lib/utils/date-keys";

const TIPO_CAMBIO = 515;
const FEE_MERCHANT_PCT = 0.04; // 4% por recarga en bolívares

interface CardItem {
  id: string;
  cardholderName: string;
  last4: string;
}

interface RecargaRow {
  id: string;
  cardId: string;
  date: string;
  usd: number;
  ves: number;
  feeMerchant: number;
  feeUsdMercado: number;
  saldo: number;
}

interface PageData {
  cards: CardItem[];
  transactions: TxItem[];
  exchangeRates: Record<string, number>;
}

interface TxItem {
  id: string;
  cardId?: string;
  card_id?: string;
  date: string;
  operationType?: string;
  operation_type?: string;
  amount: string;
}

function isRecarga(t: TxItem): boolean {
  const op = (t.operationType ?? t.operation_type ?? "").toUpperCase();
  return op === "RECARGA" && Math.abs(Number(t.amount)) > 0;
}

function getCardId(t: TxItem): string {
  return t.cardId ?? t.card_id ?? "";
}

export default function VesUsadosPage() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [rows, setRows] = useState<RecargaRow[]>([]);
  const [filterCardId, setFilterCardId] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const params = new URLSearchParams();
    if (filterCardId && filterCardId !== "all") params.set("cardId", filterCardId);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    const cacheKey = `ves-usados_${params.toString()}`;
    const cached = getCached<PageData>(cacheKey);
    if (cached) {
      setCards(cached.cards ?? []);
      const txList = Array.isArray(cached.transactions) ? cached.transactions : [];
      const rates = cached.exchangeRates || {};
      setExchangeRates(rates);
      const recargas = txList.filter(isRecarga)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let saldoAcum = 0;
      const result: RecargaRow[] = recargas.map((t) => {
        const usd = Math.abs(Number(t.amount));
        const ves = Math.round(usd * TIPO_CAMBIO * 100) / 100;
        const feeMerchant = Math.round(ves * FEE_MERCHANT_PCT * 100) / 100;
        const dateKey = normalizeDateKey(t.date);
        const rate = rates[dateKey] || TIPO_CAMBIO;
        const feeUsdMercado = feeMerchant / rate;

        saldoAcum += ves + feeMerchant;
        return {
          id: t.id,
          cardId: getCardId(t),
          date: t.date,
          usd,
          ves,
          feeMerchant,
          feeUsdMercado,
          saldo: saldoAcum,
        };
      });
      setRows(result);
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetchWithTimeout(`/api/ves-usados-data?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: PageData & { error?: string }) => {
        if (cancelled) return;
        if (data?.error) {
          setCards([]);
          setRows([]);
          setError(data.error);
          return;
        }
        const cardsData = Array.isArray(data?.cards) ? data.cards : [];
        const txList: TxItem[] = Array.isArray(data?.transactions) ? data.transactions : [];
        const rates = data?.exchangeRates || {};
        setCards(cardsData);
        setExchangeRates(rates);
        setCache(cacheKey, { cards: cardsData, transactions: txList, exchangeRates: rates });
        const recargas = txList.filter(isRecarga)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let saldoAcum = 0;
        const result: RecargaRow[] = recargas.map((t) => {
          const usd = Math.abs(Number(t.amount));
          const ves = Math.round(usd * TIPO_CAMBIO * 100) / 100;
          const feeMerchant = Math.round(ves * FEE_MERCHANT_PCT * 100) / 100;
          const dateKey = normalizeDateKey(t.date);
          const rate = rates[dateKey] || TIPO_CAMBIO;
          const feeUsdMercado = feeMerchant / rate;

          saldoAcum += ves + feeMerchant;
          return {
            id: t.id,
            cardId: getCardId(t),
            date: t.date,
            usd,
            ves,
            feeMerchant,
            feeUsdMercado,
            saldo: saldoAcum,
          };
        });
        setRows(result);
      })
      .catch(() => {
        if (!cancelled) {
          setCards([]);
          setRows([]);
          setError("No se pudo cargar. Revisa la conexión y reintenta.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filterCardId, filterFrom, filterTo, retryCount]);

  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const totalVes = rows.length > 0 ? rows[rows.length - 1]!.saldo : 0;

  const exportExcel = () => {
    const headers = ["Fecha", "Tarjeta", "USD$", "VES", "Fee Merchant 4%", "Fee USD (Mercado)", "Saldo"];
    const exportRows = rows.map((r) => {
      const card = cardMap.get(r.cardId);
      const cardLabel = card ? `${card.cardholderName} •••• ${card.last4}` : r.cardId;
      return [
        r.date.split("T")[0] ?? r.date,
        cardLabel,
        r.usd.toFixed(2),
        `-${r.ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
        `-${r.feeMerchant.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
        `-$${r.feeUsdMercado.toFixed(2)}`,
        `-${r.saldo.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
      ];
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...exportRows]), "VES Usados");
    XLSX.writeFile(wb, `ves-usados-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("VES Usados - CardOps", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generado: ${new Date().toLocaleDateString("es")} | Tipo cambio: ${TIPO_CAMBIO}`, 14, 30);

    const headers = ["Fecha", "Tarjeta", "USD$", "VES", "Fee 4%", "Fee USD (Mercado)", "Saldo"];
    const body = rows.map((r) => {
      const card = cardMap.get(r.cardId);
      const cardLabel = card ? `${card.cardholderName} •••• ${card.last4}` : r.cardId;
      return [
        r.date.split("T")[0] ?? r.date,
        cardLabel,
        r.usd.toFixed(2),
        `-${r.ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
        `-${r.feeMerchant.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
        `-$${r.feeUsdMercado.toFixed(2)}`,
        `-${r.saldo.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
      ];
    });

    autoTable(doc, {
      startY: 38,
      head: [headers],
      body,
    });
    doc.save(`ves-usados-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">VES Usados</h1>
          <p className="text-muted-foreground">
            Recargas en USD convertidas a VES (tipo de cambio: {TIPO_CAMBIO}). Fee Merchant 4% por recarga en bolívares.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel} disabled={rows.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" onClick={exportPdf} disabled={rows.length === 0}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Tarjeta</label>
              <Select value={filterCardId} onValueChange={setFilterCardId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.cardholderName} •••• {c.last4}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Desde</label>
              <Input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Hasta</label>
              <Input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Total VES usados (VES + Fee Merchant 4%, acumulado)</CardTitle>
          <p className="text-2xl font-bold text-amber-600">
            -{totalVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES
          </p>
        </CardHeader>
      </Card>

      {loading ? (
        <LoadingDots />
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setRetryCount((c) => c + 1)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-white font-bold text-center"
                    style={{ backgroundColor: "#21356e" }}
                  >
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Tarjeta</th>
                    <th className="p-3">USD$</th>
                    <th className="p-3">VES</th>
                    <th className="p-3">Fee Merchant 4%</th>
                    <th className="p-3 text-emerald-300">Fee USD (Mercado)</th>
                    <th className="p-3">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const card = cardMap.get(r.cardId);
                    const cardLabel = card
                      ? `${card.cardholderName} •••• ${card.last4}`
                      : r.cardId;
                    return (
                      <tr
                        key={r.id}
                        className={
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }
                      >
                        <td className="p-3 border-b border-gray-200">
                          {r.date.split("T")[0] ?? r.date}
                        </td>
                        <td className="p-3 border-b border-gray-200">
                          {cardLabel}
                        </td>
                        <td className="p-3 border-b border-gray-200 text-right">
                          ${r.usd.toFixed(2)}
                        </td>
                        <td className="p-3 border-b border-gray-200 text-right text-amber-600">
                          -{r.ves.toLocaleString("es-VE", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-3 border-b border-gray-200 text-right text-emerald-600 font-bold">
                          -${r.feeUsdMercado.toFixed(2)}
                          <div className="text-[10px] text-muted-foreground font-normal">
                            (tasa: {exchangeRates[normalizeDateKey(r.date)] ? exchangeRates[normalizeDateKey(r.date)] : "515*"})
                          </div>
                        </td>
                        <td className="p-3 border-b border-gray-200 text-right font-medium text-amber-600">
                          -{r.saldo.toLocaleString("es-VE", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && !error && (
              <p className="text-center py-12 text-muted-foreground">
                No hay recargas. Agrega transacciones de tipo Recarga desde Transacciones o Importar.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
