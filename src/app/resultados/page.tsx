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
import { Button } from "@/components/ui/button";
import { TrendingUp, Plus } from "lucide-react";

const TIPO_CAMBIO_RECARGA = 515; // Para calcular VES: USD × 515
const FEE_MERCHANT_PCT = 0.04; // 4% por recarga en bolívares

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
  const [newRateDate, setNewRateDate] = useState("");
  const [newRateValue, setNewRateValue] = useState("");

  useEffect(() => {
    fetch("/api/cards")
      .then((r) => r.json())
      .then((data) => setCards(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    fetch("/api/exchange-rates")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object" && !("error" in data)) {
          setExchangeRates(data);
        } else {
          setExchangeRates({});
        }
      })
      .catch(() => setExchangeRates({}));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCardId && filterCardId !== "all") params.set("cardId", filterCardId);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    fetch(`/api/transactions?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTransactions(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filterCardId, filterFrom, filterTo]);

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
    const dateStr = p.date.split("T")[0] ?? p.date;
    const usd = Math.abs(Number(p.amount));
    const ves = Math.round(usd * TIPO_CAMBIO_RECARGA * 100) / 100;
    const feeMerchant = Math.round(ves * FEE_MERCHANT_PCT * 100) / 100;
    const totalVes = ves + feeMerchant;
    const tasaMercado = exchangeRates[dateStr];
    usdGastadoVes += totalVes / (tasaMercado && tasaMercado > 0 ? tasaMercado : TIPO_CAMBIO_RECARGA);
  });
  fees.forEach((f) => {
    const dateStr = f.date.split("T")[0] ?? f.date;
    const feeUsd = Math.abs(Number(f.amount));
    const vesEquiv = Math.round(feeUsd * TIPO_CAMBIO_RECARGA * 100) / 100;
    const tasaMercado = exchangeRates[dateStr];
    usdGastadoVes += vesEquiv / (tasaMercado && tasaMercado > 0 ? tasaMercado : TIPO_CAMBIO_RECARGA);
  });

  const ganancia = usdRecibidos - usdGastadoVes;

  const fechasParaTasa = [
    ...new Set([
      ...procesadas.map((p) => p.date.split("T")[0] ?? p.date),
      ...fees.map((f) => f.date.split("T")[0] ?? f.date),
    ]),
  ].sort();

  const handleAddRate = async () => {
    if (!newRateDate || !newRateValue) return;
    const rate = Number(newRateValue);
    if (isNaN(rate) || rate <= 0) return;
    try {
      const res = await fetch("/api/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newRateDate, rate }),
      });
      const data = await res.json();
      if (res.ok) {
        setExchangeRates((prev) => ({ ...prev, [newRateDate]: rate }));
        setNewRateDate("");
        setNewRateValue("");
        // Refetch para confirmar que se guardó en la base de datos
        const refetch = await fetch("/api/exchange-rates");
        const refreshed = await refetch.json();
        if (refreshed && typeof refreshed === "object" && !("error" in refreshed)) {
          setExchangeRates(refreshed);
        }
      } else {
        alert(data?.error || "Error al guardar. Verifica la conexión a la base de datos.");
      }
    } catch {
      alert("Error de conexión. Verifica que DATABASE_URL esté configurado.");
    }
  };

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
          </CardDescription>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-sm text-muted-foreground">Fecha</label>
              <Input
                type="date"
                value={newRateDate}
                onChange={(e) => setNewRateDate(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Tasa mercado</label>
              <Input
                type="number"
                step="0.01"
                min="1"
                placeholder="ej: 520"
                value={newRateValue}
                onChange={(e) => setNewRateValue(e.target.value)}
                className="w-[120px]"
              />
            </div>
            <Button onClick={handleAddRate} disabled={!newRateDate || !newRateValue}>
              <Plus className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </div>
          {fechasParaTasa.length > 0 && (
            <div className="mt-4 pt-4 border-t">
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
