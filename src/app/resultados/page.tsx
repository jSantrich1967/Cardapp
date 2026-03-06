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
import { TrendingUp, RefreshCw } from "lucide-react";
import { LoadingDots } from "@/components/ui/loading-dots";
import { Button } from "@/components/ui/button";
import { getCached, setCache } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
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
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

  // Datos de Resultados: cards + transactions
  useEffect(() => {
    let cancelled = false;
    setError(null);
    const params = new URLSearchParams();
    if (filterCardId && filterCardId !== "all") params.set("cardId", filterCardId);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    const cacheKey = `resultados_${params.toString()}`;
    const cached = getCached<{ cards: CardItem[]; transactions: Transaction[]; exchangeRates?: Record<string, number> }>(cacheKey);
    if (cached) {
      setCards(cached.cards ?? []);
      setTransactions(cached.transactions ?? []);
      if (cached.exchangeRates) {
        const merged = normalizeRatesMap({ ...cached.exchangeRates, ...loadRatesFromStorage() });
        setExchangeRates(merged);
      }
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchWithTimeout(`/api/resultados?${params}`, { cache: "no-store", timeout: 45000 })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = [data?.error, data?.hint].filter(Boolean).join(" — ") || `Error ${r.status}`;
          throw new Error(msg);
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.error) {
          setCards([]);
          setTransactions([]);
          setError(data.error || "Error al cargar datos");
          return;
        }
        const cardsData = Array.isArray(data?.cards) ? data.cards : [];
        const txData = Array.isArray(data?.transactions) ? data.transactions : [];
        const apiRates = data?.exchangeRates && typeof data.exchangeRates === "object" ? data.exchangeRates : {};
        setCards(cardsData);
        setTransactions(txData);
        const mergedRates = normalizeRatesMap({ ...apiRates, ...loadRatesFromStorage() });
        setExchangeRates(mergedRates);
        setCache(cacheKey, { cards: cardsData, transactions: txData, exchangeRates: mergedRates });
      })
      .catch((err) => {
        if (!cancelled) {
          // Solo mostrar error si no teníamos caché (evita sobrescribir datos buenos)
          if (!cached) {
            setCards([]);
            setTransactions([]);
            setError(
              err.name === "AbortError"
                ? "La solicitud tardó demasiado. Si usas Supabase, prueba SUPABASE_DIRECT_URL (puerto 5432) en .env.local en lugar del pooler (6543)."
                : (err instanceof Error ? err.message : "No se pudieron cargar los resultados. Intenta de nuevo.")
            );
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filterCardId, filterFrom, filterTo, retryCount]);

  // Tasas: desde Histórico de tasas (mismo endpoint + localStorage)
  const refreshRates = () => {
    const storedRates = normalizeRatesMap(loadRatesFromStorage());
    setExchangeRates(storedRates);
    fetchWithTimeout("/api/exchange-rates", { cache: "no-store" })
      .then(async (r) => {
        const text = await r.text();
        try {
          return JSON.parse(text);
        } catch {
          return {}; // Respuesta no-JSON: usar solo localStorage
        }
      })
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
    // Si venimos de Histórico Tasas (acabamos de agregar/editar), forzar refresh
    try {
      if (sessionStorage.getItem("cardops_rates_updated") === "1") {
        sessionStorage.removeItem("cardops_rates_updated");
        refreshRates();
      }
    } catch {
      /* ignorar */
    }
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

  let totalBrutoUsd = 0;
  let totalFeesUsd = 0;
  let totalMerchantFeeUsdMercado = 0;
  let totalBaseVesUsdMercado = 0;

  procesadas.forEach((p) => {
    const rawAmount = Math.abs(Number(p.amount));
    totalBrutoUsd += rawAmount;

    const subFees = feesByParent.get(p.id) ?? [];
    const nominalFees = subFees.reduce((s, f) => s + Math.abs(Number(f.amount)), 0);
    totalFeesUsd += nominalFees;

    const dateStr = normalizeDateKey(p.date);
    const vesBase = Math.round(rawAmount * TIPO_CAMBIO_RECARGA * 100) / 100;
    const feeVes = Math.round(vesBase * FEE_MERCHANT_PCT * 100) / 100;
    const rate = exchangeRates[dateStr] || TIPO_CAMBIO_RECARGA;

    totalBaseVesUsdMercado += vesBase / rate;
    totalMerchantFeeUsdMercado += feeVes / rate;
  });

  const usdRecibidosResult = totalBrutoUsd - totalFeesUsd;
  const ganancia = usdRecibidosResult - totalBaseVesUsdMercado - totalMerchantFeeUsdMercado;

  const fees = transactions.filter(
    (t) => t.operationType === "FEE_VZLA" || t.operationType === "FEE_MERCHANT"
  );

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
            . Las tasas se sincronizan automáticamente.
          </CardDescription>
          <div className="mt-2 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refreshRates()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refrescar tasas
            </Button>
          </div>
          {fechasParaTasa.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-muted-foreground mb-2">Fechas con Procesadas/Fees:</p>
              <div className="flex flex-wrap gap-2">
                {fechasParaTasa.map((f) => (
                  <span
                    key={f}
                    className={`text-sm px-2 py-1 rounded ${exchangeRates[f]
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                      }`}
                    title="Formato YYYY-MM-DD (igual que en Histórico de tasas)"
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
        <LoadingDots />
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive font-medium break-words">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Si el error menciona conexión o password: revisa .env.local. Prueba{" "}
              <a href="/api/health" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                /api/health
              </a>{" "}
              para más detalles.
            </p>
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
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">USD Recibidos (Netos)</CardTitle>
                <CardDescription>Procesada - Fees (Comisiones USD)</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  ${usdRecibidosResult.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">USD Gastado (VES + Fee)</CardTitle>
                <CardDescription>
                  (VES + 4% Fee) ÷ tasa mercado (cada fecha)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  ${(totalBaseVesUsdMercado + totalMerchantFeeUsdMercado).toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
                  className={`text-2xl font-bold ${ganancia >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                >
                  ${ganancia.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumen Operativo</CardTitle>
              <CardDescription>
                Desglose detallado según el formato de costos y beneficios.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-w-md space-y-2 font-mono text-sm border p-4 rounded-lg bg-slate-50">
                <div className="flex justify-between items-center">
                  <span>(+) USD Procesados</span>
                  <span className="font-bold">${totalBrutoUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-red-600">
                  <span>(-) USD Fees (Bancos/Admin)</span>
                  <span className="font-bold">-${totalFeesUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2 font-bold">
                  <span>(=) USD$ Recibidos</span>
                  <span>${usdRecibidosResult.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-amber-600">
                  <span>(-) USD Merchant (Ves 4% Mercado)</span>
                  <span className="font-bold">-${totalMerchantFeeUsdMercado.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-blue-600">
                  <span>(-) Costo Base VES (Mercado)</span>
                  <span className="font-bold">-${totalBaseVesUsdMercado.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center border-t border-double pt-2 text-lg font-bold">
                  <span>Total Resultado</span>
                  <span className={ganancia >= 0 ? "text-green-600" : "text-red-600"}>
                    ${ganancia.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <p className="mt-4 text-muted-foreground text-xs italic">
                * Los costos en VES se convierten a USD usando la tasa de mercado de cada fecha.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
