"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface CardItem {
  id: string;
  cardholderName: string;
  last4: string;
}

interface ReportData {
  summary: {
    recarga: number;
    procesada: number;
    feeVzla: number;
    feeMerchant: number;
    balance: number;
  };
  monthly: Array<{
    month: string;
    recarga: number;
    procesada: number;
    feeVzla: number;
    feeMerchant: number;
  }>;
  byCard: Array<{
    id: string;
    cardholderName: string;
    last4: string;
    balance: number;
    txCount: number;
  }>;
}

const COLORS = ["#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"];

export default function ReportsPage() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [cardId, setCardId] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchReport = () => {
    const params = new URLSearchParams();
    if (cardId && cardId !== "all") params.set("cardId", cardId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/reports?${params}`)
      .then((r) => r.json())
      .then(setReport);
  };

  useEffect(() => {
    fetch("/api/cards")
      .then((r) => r.json())
      .then(setCards);
  }, []);

  useEffect(() => {
    fetchReport();
  }, [cardId, from, to]);

  const exportCsv = async () => {
    const params = new URLSearchParams();
    if (cardId && cardId !== "all") params.set("cardId", cardId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();
    const headers = ["Fecha", "Tipo", "Monto", "Notas"];
    const rows = data.map(
      (t: { date: string; operationType: string; amount: string; notes: string | null }) =>
        [t.date, t.operationType, t.amount, t.notes || ""].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cardops-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!report) return <p className="text-muted-foreground">Cargando...</p>;

  const feeData = [
    { name: "Fee Vzla", value: report.summary.feeVzla, color: COLORS[0] },
    { name: "Fee Merchant", value: report.summary.feeMerchant, color: COLORS[1] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <Button onClick={exportCsv}>Exportar CSV</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <div className="flex flex-wrap gap-4">
            <div>
              <Label>Tarjeta</Label>
              <Select value={cardId} onValueChange={setCardId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
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
              <Label>Desde</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Saldo</CardTitle>
            <CardContent className="pt-2">
              <p className="text-2xl font-bold text-primary">
                ${report.summary.balance.toFixed(2)}
              </p>
            </CardContent>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Recarga</CardTitle>
            <CardContent className="pt-2">
              <p className="text-2xl font-bold text-green-600">
                ${report.summary.recarga.toFixed(2)}
              </p>
            </CardContent>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Procesada</CardTitle>
            <CardContent className="pt-2">
              <p className="text-2xl font-bold text-red-600">
                ${report.summary.procesada.toFixed(2)}
              </p>
            </CardContent>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Fees</CardTitle>
            <CardContent className="pt-2">
              <p className="text-2xl font-bold">
                ${(report.summary.feeVzla + report.summary.feeMerchant).toFixed(2)}
              </p>
            </CardContent>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por mes</CardTitle>
            <CardDescription>Procesada + Fees</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={report.monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="procesada" fill="#8b5cf6" name="Procesada" />
                <Bar dataKey="feeVzla" fill="#a78bfa" name="Fee Vzla" />
                <Bar dataKey="feeMerchant" fill="#c4b5fd" name="Fee Merchant" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desglose de fees</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={feeData.filter((d) => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }) => `${name}: $${value.toFixed(2)}`}
                >
                  {feeData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saldo por tarjeta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {report.byCard.map((c) => (
              <div
                key={c.id}
                className="flex justify-between items-center py-2 border-b"
              >
                <span>
                  {c.cardholderName} •••• {c.last4} ({c.txCount} tx)
                </span>
                <span className="font-bold text-primary">
                  ${c.balance.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
