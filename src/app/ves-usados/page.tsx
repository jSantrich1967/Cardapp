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
import { FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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
  saldo: number;
}

export default function VesUsadosPage() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [rows, setRows] = useState<RecargaRow[]>([]);
  const [filterCardId, setFilterCardId] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cards")
      .then((r) => r.json())
      .then((data) => setCards(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("type", "RECARGA");
    if (filterCardId && filterCardId !== "all") params.set("cardId", filterCardId);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    fetch(`/api/transactions?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const txList = Array.isArray(data) ? data : [];
        const recargas = txList
          .filter((t: { operationType: string; amount: string }) => {
            if (t.operationType !== "RECARGA") return false;
            const amt = Number(t.amount);
            return amt > 0;
          })
          .sort(
            (a: { date: string }, b: { date: string }) =>
              new Date(a.date).getTime() - new Date(b.date).getTime()
          );

        let saldoAcum = 0;
        const result: RecargaRow[] = recargas.map((t: { id: string; cardId: string; date: string; amount: string }) => {
          const usd = Number(t.amount);
          const ves = Math.round(usd * TIPO_CAMBIO * 100) / 100;
          const feeMerchant = Math.round(ves * FEE_MERCHANT_PCT * 100) / 100;
          // Ambas son negativas (salidas): -VES + (-Fee) = -(VES + Fee), se suman
          saldoAcum += ves + feeMerchant;
          return {
            id: t.id,
            cardId: t.cardId,
            date: t.date,
            usd,
            ves,
            feeMerchant,
            saldo: saldoAcum,
          };
        });
        setRows(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filterCardId, filterFrom, filterTo]);

  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const totalVes = rows.length > 0 ? rows[rows.length - 1]!.saldo : 0;

  const exportExcel = () => {
    const headers = ["Fecha", "Tarjeta", "USD$", "VES", "Fee Merchant 4%", "Saldo"];
    const exportRows = rows.map((r) => {
      const card = cardMap.get(r.cardId);
      const cardLabel = card ? `${card.cardholderName} •••• ${card.last4}` : r.cardId;
      return [
        r.date.split("T")[0] ?? r.date,
        cardLabel,
        r.usd.toFixed(2),
        `-${r.ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
        `-${r.feeMerchant.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
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

    const headers = ["Fecha", "Tarjeta", "USD$", "VES", "Fee 4%", "Saldo"];
    const body = rows.map((r) => {
      const card = cardMap.get(r.cardId);
      const cardLabel = card ? `${card.cardholderName} •••• ${card.last4}` : r.cardId;
      return [
        r.date.split("T")[0] ?? r.date,
        cardLabel,
        r.usd.toFixed(2),
        `-${r.ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
        `-${r.feeMerchant.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
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
        <p className="text-muted-foreground">Cargando...</p>
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
                        <td className="p-3 border-b border-gray-200 text-right text-amber-600">
                          -{r.feeMerchant.toLocaleString("es-VE", {
                            minimumFractionDigits: 2,
                          })}
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
            {rows.length === 0 && (
              <p className="text-center py-12 text-muted-foreground">
                No hay recargas. Las recargas aparecerán aquí convertidas a VES.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
