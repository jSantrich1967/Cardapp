"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { History, Plus, ArrowLeft } from "lucide-react";
import { getCached, setCache } from "@/lib/cache";
import { normalizeRatesMap } from "@/lib/utils/date-keys";

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

function saveRatesToStorage(rates: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rates));
  } catch {
    /* ignorar */
  }
}

export default function TasasPage() {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newRateDate, setNewRateDate] = useState("");
  const [newRateValue, setNewRateValue] = useState("");
  const [rateSaving, setRateSaving] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateSuccess, setRateSuccess] = useState(false);

  useEffect(() => {
    const cacheKey = "tasas_exchange_rates";
    const cached = getCached<Record<string, number>>(cacheKey);
    if (cached) {
      const storedRates = loadRatesFromStorage();
      setRates(normalizeRatesMap({ ...cached, ...storedRates }));
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    fetch("/api/exchange-rates", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const apiRates =
          data && typeof data === "object" && !("error" in data) ? data : {};
        const storedRates = loadRatesFromStorage();
        const merged = normalizeRatesMap({ ...apiRates, ...storedRates });
        setRates(merged);
        if (Object.keys(apiRates).length > 0) setCache(cacheKey, merged);
        if (data?.error) setError(typeof data.error === "string" ? data.error : null);
      })
      .catch((e) => {
        setRates(normalizeRatesMap(loadRatesFromStorage()));
        setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAddRate = async () => {
    if (!newRateDate || !newRateValue) return;
    const rate = Number(String(newRateValue).replace(",", "."));
    if (isNaN(rate) || rate <= 0) return;
    setRateError(null);
    setRateSuccess(false);
    setRateSaving(true);
    try {
      const res = await fetch("/api/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newRateDate, rate }),
      });
      const data = await res.json().catch(() => ({}));
      const dateKey = String(newRateDate).slice(0, 10);
      const newRates = normalizeRatesMap({ ...rates, [dateKey]: rate });
      saveRatesToStorage(newRates);
      setRates(newRates);
      setNewRateDate("");
      setNewRateValue("");
      if (res.ok) {
        setRateSuccess(true);
        setTimeout(() => setRateSuccess(false), 3000);
      } else {
        setRateError(data?.error || "No se guardó en la base de datos, pero la tasa se aplicó localmente.");
      }
    } catch (err) {
      setRateError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setRateSaving(false);
    }
  };

  const sortedRates = Object.entries(rates)
    .map(([date, rate]) => ({ date, rate }))
    .filter(({ date }) => date && /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort((a, b) => b.date.localeCompare(a.date));

  const formatDate = (dateStr: string) => {
    if (!dateStr || typeof dateStr !== "string") return dateStr ?? "";
    const d = new Date(dateStr + "T12:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("es-VE", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="h-7 w-7" />
          Histórico de tasas de cambio
        </h1>
        <p className="text-muted-foreground mt-1">
          Todas las tasas de mercado registradas por fecha. Se usa para calcular USD en Resultados.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registrar nueva tasa</CardTitle>
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
            <Button
              onClick={handleAddRate}
              disabled={!newRateDate || !newRateValue || rateSaving}
            >
              <Plus className="h-4 w-4 mr-2" />
              {rateSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
          {rateError && <p className="mt-2 text-sm text-red-600">{rateError}</p>}
          {rateSuccess && <p className="mt-2 text-sm text-green-600">Tasa guardada correctamente.</p>}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tasas por fecha</CardTitle>
          <CardDescription>
            Ordenadas de la más reciente a la más antigua. Sin tasa guardada se usa 515 por defecto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Cargando...</p>
          ) : error ? (
            <p className="text-red-600 py-4">{error}</p>
          ) : sortedRates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No hay tasas registradas. Usa el formulario de arriba para agregar una.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Fecha</th>
                    <th className="text-right py-3 px-4 font-medium">Tasa (VES/USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRates.map(({ date, rate }) => (
                    <tr key={date} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4">{formatDate(date)}</td>
                      <td className="text-right py-3 px-4 font-mono font-medium">
                        {Number(rate).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="ghost" asChild>
        <Link href="/resultados" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver a Resultados
        </Link>
      </Button>
    </div>
  );
}
