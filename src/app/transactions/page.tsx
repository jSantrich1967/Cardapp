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
  parentTransactionId?: string | null;
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

  useEffect(() => {
    fetchCards();
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

  const filteredByCard =
    filterCardId && filterCardId !== "all"
      ? transactions.filter((t) => String(t.cardId).trim() === String(filterCardId).trim())
      : transactions;

  // Build display list: fees appear below their parent PROCESADA
  const feesByParent = new Map<string, Transaction[]>();
  const parents: Transaction[] = [];
  for (const t of filteredByCard) {
    if (t.parentTransactionId) {
      const arr = feesByParent.get(t.parentTransactionId) ?? [];
      arr.push(t);
      feesByParent.set(t.parentTransactionId, arr);
    } else {
      parents.push(t);
    }
  }
  parents.sort(
    (a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime() ||
      (a.id || "").localeCompare(b.id || "")
  );
  for (const arr of feesByParent.values()) {
    arr.sort((a, b) => {
      const order: Record<string, number> = { FEE_VZLA: 0, FEE_MERCHANT: 1 };
      return (order[a.operationType] ?? 2) - (order[b.operationType] ?? 2);
    });
  }
  const displayRows: Transaction[] = [];
  for (const p of parents) {
    displayRows.push(p);
    if (p.operationType === "PROCESADA") {
      displayRows.push(...(feesByParent.get(p.id) ?? []));
    }
  }

  const balanceByTx =
    filterCardId && filterCardId !== "all"
      ? computeRunningBalance(displayRows)
      : computeRunningBalancePerCard(displayRows);
  const balance = getCurrentBalance(filteredByCard);

  const refetchTransactions = () => {
    const params = new URLSearchParams();
    if (filterCardId && filterCardId !== "all") params.set("cardId", filterCardId);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    fetch(`/api/transactions?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setTransactions(Array.isArray(data) ? data : []));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta transacción?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) refetchTransactions();
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
                  {displayRows.map((t) => {
                    const isFee = !!t.parentTransactionId;
                    return (
                    <tr
                      key={t.id}
                      className={`border-b ${isFee ? "bg-muted/40" : ""}`}
                    >
                      <td className="p-2">{t.date.split("T")[0] ?? t.date}</td>
                    {filterCardId === "all" && (
                      <td className="p-2">
                        <Select
                          value={t.cardId}
                          onValueChange={async (newCardId) => {
                            const res = await fetch(`/api/transactions/${t.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ cardId: newCardId }),
                            });
                            if (res.ok) refetchTransactions();
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs min-w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(cards || []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.cardholderName} •••• {c.last4}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                      <td className={`p-2 ${isFee ? "pl-8 text-muted-foreground" : ""}`}>
                        {isFee && "↳ "}
                        {OP_LABELS[t.operationType] ?? t.operationType}
                      </td>
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
                  );
                  })}
                </tbody>
              </table>
            </div>
            {displayRows.length === 0 && (
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
