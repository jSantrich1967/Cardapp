"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getCurrentBalance, computeRunningBalance, computeRunningBalancePerCard } from "@/lib/utils/balance";
import { parseAmount } from "@/lib/utils/parse";
import { Plus, Trash2 } from "lucide-react";

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
  createdAt?: string;
}

const OP_LABELS: Record<string, string> = {
  RECARGA: "Recarga",
  PROCESADA: "Procesada",
  FEE_VZLA: "Fee Vzla",
  FEE_MERCHANT: "Fee Merchant",
};

function TransactionsContent() {
  const searchParams = useSearchParams();
  const [cards, setCards] = useState<CardItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterCardId, setFilterCardId] = useState<string>("all");

  // Pre-select card from URL (e.g. /transactions?cardId=xxx from cards page)
  useEffect(() => {
    const cardId = searchParams.get("cardId");
    if (cardId) setFilterCardId(cardId);
  }, [searchParams]);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    cardId: "",
    date: new Date().toISOString().slice(0, 10),
    operationType: "RECARGA" as "RECARGA" | "PROCESADA",
    amount: "",
    notes: "",
  });

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
    if (filterType && filterType !== "all") params.set("type", filterType);
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
  }, [filterCardId, filterFrom, filterTo, filterType]);

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
  // Order: date asc (strict chronological - day 25 before day 26), then within date: Recarga, Procesada, fees
  const toDateStr = (d: string) => String(d).split("T")[0] ?? d;
  parents.sort((a, b) => {
    const dateStrA = toDateStr(a.date);
    const dateStrB = toDateStr(b.date);
    const dateCmp = dateStrA.localeCompare(dateStrB);
    if (dateCmp !== 0) return dateCmp; // Strict date order: 25 before 26
    // Same date: RECARGA first (0), PROCESADA second (1)
    const orderA = a.operationType === "RECARGA" ? 0 : 1;
    const orderB = b.operationType === "RECARGA" ? 0 : 1;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
  // Fee order: FEE_VZLA first, then FEE_MERCHANT (or by createdAt to preserve import order)
  Array.from(feesByParent.values()).forEach((arr) => {
    arr.sort((a, b) => {
      const order: Record<string, number> = { FEE_VZLA: 0, FEE_MERCHANT: 1 };
      const typeOrder = (order[a.operationType] ?? 2) - (order[b.operationType] ?? 2);
      if (typeOrder !== 0) return typeOrder;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
  });
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
    if (filterType && filterType !== "all") params.set("type", filterType);
    fetch(`/api/transactions?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setTransactions(Array.isArray(data) ? data : []));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta transacción?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) refetchTransactions();
  };

  const openAddDialog = () => {
    setAddForm({
      cardId: filterCardId !== "all" ? filterCardId : cards[0]?.id ?? "",
      date: new Date().toISOString().slice(0, 10),
      operationType: "RECARGA",
      amount: "",
      notes: "",
    });
    setAddOpen(true);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseAmount(addForm.amount);
    if (amountNum == null || isNaN(amountNum) || amountNum <= 0) {
      alert("Ingresa un monto válido (ej: 100 o 1234,56)");
      return;
    }
    if (!addForm.cardId) {
      alert("Selecciona una tarjeta");
      return;
    }
    const res = await fetch("/api/transactions/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId: addForm.cardId,
        date: addForm.date,
        operationType: addForm.operationType,
        amount: amountNum,
        notes: addForm.notes || null,
      }),
    });
    if (res.ok) {
      setAddOpen(false);
      refetchTransactions();
    } else {
      const err = await res.json();
      alert(err.error || "Error al crear transacción");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transacciones</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} disabled={cards.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar transacción
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva transacción</DialogTitle>
              <DialogDescription>
                Agrega una Recarga o Procesada. Los fees se generan automáticamente para Procesada.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <Label htmlFor="add-card">Tarjeta</Label>
                <Select
                  value={addForm.cardId}
                  onValueChange={(v) => setAddForm((f) => ({ ...f, cardId: v }))}
                  required
                >
                  <SelectTrigger id="add-card" className="mt-1">
                    <SelectValue placeholder="Selecciona tarjeta" />
                  </SelectTrigger>
                  <SelectContent>
                    {cards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.cardholderName} •••• {c.last4}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="add-date">Fecha</Label>
                <Input
                  id="add-date"
                  type="date"
                  value={addForm.date}
                  onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="add-type">Tipo</Label>
                <Select
                  value={addForm.operationType}
                  onValueChange={(v: "RECARGA" | "PROCESADA") =>
                    setAddForm((f) => ({ ...f, operationType: v }))
                  }
                >
                  <SelectTrigger id="add-type" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECARGA">Recarga</SelectItem>
                    <SelectItem value="PROCESADA">Procesada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="add-amount">Monto</Label>
                <Input
                  id="add-amount"
                  type="text"
                  value={addForm.amount}
                  onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="Ej: 100 o 1.234,56"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="add-notes">Notas (opcional)</Label>
                <Input
                  id="add-notes"
                  value={addForm.notes}
                  onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notas"
                  className="mt-1"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Agregar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
                    <th className="text-left p-2">
                      <div className="flex flex-col gap-1">
                        <span>Tipo</span>
                        <Select value={filterType} onValueChange={setFilterType}>
                          <SelectTrigger className="h-8 text-xs w-full min-w-[120px]">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="RECARGA">Recarga</SelectItem>
                            <SelectItem value="PROCESADA">Procesada</SelectItem>
                            <SelectItem value="FEE_VZLA">Fee Vzla</SelectItem>
                            <SelectItem value="FEE_MERCHANT">Fee Merchant</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </th>
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

export default function TransactionsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando...</p>}>
      <TransactionsContent />
    </Suspense>
  );
}
