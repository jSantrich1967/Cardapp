"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";

interface CardItem {
  id: string;
  cardholderName: string;
  last4: string;
}

interface ReconItem {
  id: string;
  date: string;
  operationType: string;
  amount: string;
  reportedBalance: string;
  computedBalance: number;
  difference: number;
  possibleOcrError: boolean;
}

export default function ReconciliationPage() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [cardId, setCardId] = useState<string>("");
  const [items, setItems] = useState<ReconItem[]>([]);
  const [mismatches, setMismatches] = useState<ReconItem[]>([]);

  useEffect(() => {
    fetchWithTimeout("/api/cards")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setCards(list);
        if (list.length > 0 && !cardId) setCardId(list[0].id);
      })
      .catch(() => setCards([]));
  }, []);

  useEffect(() => {
    if (!cardId) return;
    fetchWithTimeout(`/api/reconciliation?cardId=${cardId}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        setMismatches(data.mismatches || []);
      })
      .catch(() => {
        setItems([]);
        setMismatches([]);
      });
  }, [cardId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reconciliación</h1>
        <p className="text-muted-foreground">
          Compara el saldo reportado (de la tabla OCR) con el saldo calculado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecciona tarjeta</CardTitle>
          <Select value={cardId} onValueChange={setCardId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Tarjeta" />
            </SelectTrigger>
            <SelectContent>
              {cards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.cardholderName} •••• {c.last4}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
      </Card>

      {mismatches.length > 0 && (
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Diferencias detectadas ({mismatches.length})
            </CardTitle>
            <CardDescription>
              Posible error de OCR. Revisa las filas con saldo reportado que no coincide con el calculado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Fecha</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-right p-2">Monto</th>
                    <th className="text-right p-2">Reportado</th>
                    <th className="text-right p-2">Calculado</th>
                    <th className="text-right p-2">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {mismatches.map((m) => (
                    <tr key={m.id} className="border-b">
                      <td className="p-2">{m.date}</td>
                      <td className="p-2">{m.operationType}</td>
                      <td className="p-2 text-right">{m.amount}</td>
                      <td className="p-2 text-right">{m.reportedBalance}</td>
                      <td className="p-2 text-right">{m.computedBalance.toFixed(2)}</td>
                      <td className="p-2 text-right text-amber-600 font-medium">
                        {m.difference > 0 ? "+" : ""}
                        {m.difference.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Todas las filas con saldo reportado</CardTitle>
          <CardDescription>
            Solo se muestran transacciones importadas que tenían columna Saldo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No hay transacciones con saldo reportado para esta tarjeta.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Fecha</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-right p-2">Monto</th>
                    <th className="text-right p-2">Reportado</th>
                    <th className="text-right p-2">Calculado</th>
                    <th className="text-right p-2">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr
                      key={m.id}
                      className={`border-b ${m.possibleOcrError ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}
                    >
                      <td className="p-2">{m.date}</td>
                      <td className="p-2">{m.operationType}</td>
                      <td className="p-2 text-right">{m.amount}</td>
                      <td className="p-2 text-right">{m.reportedBalance}</td>
                      <td className="p-2 text-right">{m.computedBalance.toFixed(2)}</td>
                      <td className="p-2 text-right">
                        {Math.abs(m.difference) > 0.01 ? (
                          <span className="text-amber-600 font-medium">
                            {m.difference > 0 ? "+" : ""}
                            {m.difference.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-green-600">✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
