"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrentBalance, computeRunningBalance, computeRunningBalancePerCard } from "@/lib/utils/balance";
import { Pencil, Trash2 } from "lucide-react";

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
  notes: string | null;
  source: string;
}

const OP_LABELS: Record<string, string> = {
  RECARGA: "Recarga",
  PROCESADA: "Procesada",
  FEE_VZLA: "Fee Vzla",
  FEE_MERCHANT: "Fee Merchant",
};

export default function TransactionsPage() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterCardId, setFilterCardId] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchCards = () => {
    fetch("/api/cards")
      .then((r) => r.json())
      .then((data) => setCards(Array.isArray(data) ? data : []));
  };

  const fetchTransactions = () => {
    const params = new URLSearchParams();
    if (filterCardId && filterCardId !== "all") params.set("cardId", filterCardId);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    fetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((data) => setTransactions(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCards();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTransactions();
  }, [filterCardId, filterFrom, filterTo]);

  const filteredByCard =
    filterCardId && filterCardId !== "all"
      ? transactions.filter((t) => t.cardId === filterCardId)
      : transactions;

  const sortedByDate = [...filteredByCard].sort(
    (a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime() ||
      (a.id || "").localeCompare(b.id || "")
  );
  const balanceByTx =
    filterCardId && filterCardId !== "all"
      ? computeRunningBalance(sortedByDate)
      : computeRunningBalancePerCard(sortedByDate);
  const balance = getCurrentBalance(filteredByCard);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta transacción?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) fetchTransactions();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transacciones</h1>
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
                  {(cards || []).map((c) => (
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
          <CardTitle>Saldo calculado</CardTitle>
          <p className="text-2xl font-bold text-primary">
            ${balance.toFixed(2)}
          </p>
        </CardHeader>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Fecha</th>
                    {filterCardId === "all" && (
                      <th className="text-left p-2">Tarjeta</th>
                    )}
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-right p-2">Monto</th>
                    <th className="text-right p-2">Saldo</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {sortedByDate.map((t) => (
                    <tr key={t.id} className="border-b">
                      <td className="p-2">{t.date.split("T")[0] ?? t.date}</td>
                      {filterCardId === "all" && (
                        <td className="p-2">
                          {(() => {
                            const c = (cards || []).find((x) => x.id === t.cardId);
                            return c ? `${c.cardholderName} •••• ${c.last4}` : "—";
                          })()}
                        </td>
                      )}
                      <td className="p-2">{OP_LABELS[t.operationType] ?? t.operationType}</td>
                      <td
                        className={`p-2 text-right ${
                          Number(t.amount) >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {Number(t.amount) >= 0 ? "+" : ""}
                        ${Math.abs(Number(t.amount)).toFixed(2)}
                      </td>
                      <td className="p-2 text-right font-medium text-primary">
                        ${(balanceByTx.get(t.id) ?? balanceByTx.get(`${t.date}-${t.amount}`) ?? 0).toFixed(2)}
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sortedByDate.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">
                No hay transacciones. Importa desde una imagen o agrega manualmente.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
