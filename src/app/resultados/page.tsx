"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { getCached, setCache } from "@/lib/cache";
import { normalizeDateKey, normalizeRatesMap } from "@/lib/utils/date-keys";

const TIPO_CAMBIO_RECARGA = 515; // Para calcular VES: USD × 515
const FEE_MERCHANT_PCT = 0.04; // 4% por recarga en bolívares
const STORAGE_KEY = "cardops_exchange_rates";

function loadRatesFromStorage(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

interface CardItem {
  id: string;
  cardholderName: string;
  last4: string;
}

interface Transaction {
  id: string;
  cardId: string;
  date: string;
  operationType: string;
  amount: string;
  parentTransactionId?: string | null;
}

export default function ResultadosPage() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterCardId, setFilterCardId] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

  // Datos de Resultados: cards + transactions
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (filterCardId && filterCardId !== "all") params.set("cardId", filterCardId);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    const cacheKey = `resultados_${params.toString()}`;
    const cached = getCached<{ cards: CardItem[]; transactions: Transaction[] }>(cacheKey);
    if (cached) {
      setCards(cached.cards ?? []);
      setTransactions(cached.transactions ?? []);
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetch(`/api/resultados?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.error) {
          setCards([]);
          setTransactions([]);
          return;
        }
        const cardsData = Array.isArray(data?.cards) ? data.cards : [];
        const txData = Array.isArray(data?.transactions) ? data.transactions : [];
        setCards(cardsData);
        setTransactions(txData);
        setCache(cacheKey, { cards: cardsData, transactions: txData });
      })
      .catch(() => {
        if (!cancelled) {
          setCards([]);
          setTransactions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filterCardId, filterFrom, filterTo]);

  // Tasas: desde Histórico de tasas (mismo endpoint + localStorage)
  const refreshRates = () => {
    const storedRates = normalizeRatesMap(loadRatesFromStorage());
    setExchangeRates(storedRates);
    fetch("/api/exchange-rates", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const apiRates =
          data && typeof data === "object" && !("error" in data) ? data : {};
        const merged = normalizeRatesMap({
          ...apiRates,
          ...loadRatesFromStorage(),
        });
        setExchangeRates(merged);
      })
      .catch(() => setExchangeRates(normalizeRatesMap(loadRatesFromStorage())));
  };

  useEffect(() => {
    refreshRates();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshRates();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refreshRates();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // USD recibidos = Procesada - fees (Fee Vzla + Fee Merchant)
  const procesadas = transactions.filter((t) => t.operationType === "PROCESADA");
  const feesByParent = new Map<string, Transaction[]>();
  transactions.forEach((t) => {
    if (t.parentTransactionId) {
      const arr = feesByParent.get(t.parentTransactionId) ?? [];
      arr.push(t);
      feesByParent.set(t.parentTransactionId, arr);
    }
  });

  let usdRecibidos = 0;
  procesadas.forEach((p) => {
    const procesadaAmount = Math.abs(Number(p.amount));
    const fees = feesByParent.get(p.id) ?? [];
    const feeVzla = fees
      .filter((f) => f.operationType === "FEE_VZLA")
      .reduce((s, f) => s + Math.abs(Number(f.amount)), 0);
    const feeMerchant = fees
      .filter((f) => f.operationType === "FEE_MERCHANT")
      .reduce((s, f) => s + Math.abs(Number(f.amount)), 0);
    usdRecibidos += procesadaAmount - feeVzla - feeMerchant;
  });

  // VES usados solo de Procesadas y Fees (no Recargas)
  // Procesadas: monto × 515 + fee 4%, ÷ tasa mercado = USD
  // Fees: |monto| × 515 (VES equiv del fee), ÷ tasa mercado = USD
  const fees = transactions.filter(
    (t) => t.operationType === "FEE_VZLA" || t.operationType === "FEE_MERCHANT"
  );

  let usdGastadoVes = 0;
  procesadas.forEach((p) => {
    const dateStr = normalizeDateKey(p.date);
    const usd = Math.abs(Number(p.amount));
    const ves = Math.round(usd * TIPO_CAMBIO_RECARGA * 100) / 100;
    const feeMerchant = Math.round(ves * FEE_MERCHANT_PCT * 100) / 100;
    const totalVes = ves + feeMerchant;
    const tasaMercado = exchangeRates[dateStr];
    usdGastadoVes += totalVes / (tasaMercado && tasaMercado > 0 ? tasaMercado : TIPO_CAMBIO_RECARGA);
  });
  fees.forEach((f) => {
    const dateStr = normalizeDateKey(f.date);
    const feeUsd = Math.abs(Number(f.amount));
    const vesEquiv = Math.round(feeUsd * TIPO_CAMBIO_RECARGA * 100) / 100;
    const tasaMercado = exchangeRates[dateStr];
    usdGastadoVes += vesEquiv / (tasaMercado && tasaMercado > 0 ? tasaMercado : TIPO_CAMBIO_RECARGA);
  });

  const ganancia = usdRecibidos - usdGastadoVes;

  const fechasParaTasa = [
    ...new Set([
      ...procesadas.map((p) => normalizeDateKey(p.date)),
      ...fees.map((f) => normalizeDateKey(f.date)),
    ]),
  ].filter(Boolean).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resultados</h1>
        <p className="text-muted-foreground">
          Comparación: USD recibidos (Procesada - fees) vs VES usados de Procesadas y Fees (× 515 + fee 4%) ÷ tipo cambio mercado.
          Ganancia = USD recibidos - USD gastado.
        </p>
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
          <CardTitle>Tipo de cambio de mercado por fecha</CardTitle>
          <CardDescription>
            Para Procesadas y Fees: (VES + fee) ÷ tasa del día = USD. Sin tasa guardada se usa 515.
            Para agregar o editar tasas, ve a{" "}
            <Link href="/tasas" className="text-primary hover:underline font-medium">
              Histórico de tasas
            </Link>
            .
          </CardDescription>
          {fechasParaTasa.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-muted-foreground mb-2">Fechas con Procesadas/Fees:</p>
              <div className="flex flex-wrap gap-2">
                {fechasParaTasa.map((f) => (
                  <span
                    key={f}
                    className={`text-sm px-2 py-1 rounded ${
                      exchangeRates[f]
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {f}: {exchangeRates[f] ?? "sin tasa (usa 515)"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">USD recibidos (neto)</CardTitle>
                <CardDescription>Procesada - Fee Vzla - Fee Merchant</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  ${usdRecibidos.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">USD gastado (VES usados)</CardTitle>
                <CardDescription>
                  VES usados (Procesadas + Fees) ÷ tipo cambio mercado (por fecha)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  ${usdGastadoVes.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Ganancia
                </CardTitle>
                <CardDescription>USD recibidos - USD gastado</CardDescription>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-bold ${
                    ganancia >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  ${ganancia.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
              <CardDescription>
                Cálculo de ganancia comparando USD recibidos vs VES usados convertidos a USD.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
                <p className="text-muted-foreground text-sm">
                  Has recibido{" "}
                  <span className="font-medium text-foreground">
                    ${usdRecibidos.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>{" "}
                  netos (Procesada menos fees). VES usados (Procesadas + Fees) equivalentes a{" "}
                  <span className="font-medium text-foreground">
                    ${usdGastadoVes.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>{" "}
                  (Procesada: USD × 515 + 4% fee; Fees: USD × 515; ÷ tasa mercado fecha = USD).
                  Ganancia:{" "}
                  <span
                    className={`font-bold ${ganancia >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    ${ganancia.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                  .
                </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
