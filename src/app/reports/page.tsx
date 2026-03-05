"use client";

import { useCallback, useEffect, useState } from "react";
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
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchReport = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (cardId && cardId !== "all") params.set("cardId", cardId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/reports?${params}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Error al cargar reportes");
        if (!data?.summary) throw new Error("Respuesta inválida del servidor");
        setReport(data);
      })
      .catch((err) => {
        setReport(null);
        setError(err instanceof Error ? err.message : "Error de conexión. Verifica que la base de datos esté configurada.");
      })
      .finally(() => setLoading(false));
  }, [cardId, from, to]);

  useEffect(() => {
    fetch("/api/cards")
      .then((r) => r.json())
      .then((data) => setCards(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const exportExcel = () => {
    if (!report) return;
    const wb = XLSX.utils.book_new();
    const summaryData = [
      ["Resumen", ""],
      ["Saldo", (report.summary.balance ?? 0).toFixed(2)],
      ["Total Recarga", (report.summary.recarga ?? 0).toFixed(2)],
      ["Total Procesada", (report.summary.procesada ?? 0).toFixed(2)],
      ["Fee Vzla", (report.summary.feeVzla ?? 0).toFixed(2)],
      ["Fee Merchant", (report.summary.feeMerchant ?? 0).toFixed(2)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Resumen");
    const monthlyData = [
      ["Mes", "Recarga", "Procesada", "Fee Vzla", "Fee Merchant"],
      ...(report.monthly ?? []).map((m) => [m.month, m.recarga, m.procesada, m.feeVzla, m.feeMerchant]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthlyData), "Por mes");
    const byCardData = [
      ["Tarjeta", "Últimos 4", "Saldo", "Transacciones"],
      ...(report.byCard ?? []).map((c) => [c.cardholderName, c.last4, c.balance, c.txCount]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(byCardData), "Por tarjeta");
    XLSX.writeFile(wb, `reportes-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPdf = () => {
    if (!report) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Reportes CardOps", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generado: ${new Date().toLocaleDateString("es")}`, 14, 30);

    const summary = report.summary;
    autoTable(doc, {
      startY: 38,
      head: [["Concepto", "Monto"]],
      body: [
        ["Saldo", `$${(summary.balance ?? 0).toFixed(2)}`],
        ["Total Recarga", `$${(summary.recarga ?? 0).toFixed(2)}`],
        ["Total Procesada", `$${(summary.procesada ?? 0).toFixed(2)}`],
        ["Fee Vzla", `$${(summary.feeVzla ?? 0).toFixed(2)}`],
        ["Fee Merchant", `$${(summary.feeMerchant ?? 0).toFixed(2)}`],
      ],
    });

    const docAny = doc as jsPDF & { lastAutoTable?: { finalY: number } };
    let finalY = docAny.lastAutoTable?.finalY ?? 50;
    if ((report.monthly ?? []).length > 0) {
      doc.text("Gastos por mes", 14, finalY + 15);
      autoTable(doc, {
        startY: finalY + 20,
        head: [["Mes", "Recarga", "Procesada", "Fee Vzla", "Fee Merchant"]],
        body: (report.monthly ?? []).map((m) => [String(m.month), String(m.recarga), String(m.procesada), String(m.feeVzla), String(m.feeMerchant)]),
      });
      finalY = docAny.lastAutoTable?.finalY ?? finalY;
    }

    if ((report.byCard ?? []).length > 0) {
      doc.text("Saldo por tarjeta", 14, finalY + 15);
      autoTable(doc, {
        startY: finalY + 20,
        head: [["Tarjeta", "Últimos 4", "Saldo", "Transacciones"]],
        body: (report.byCard ?? []).map((c) => [c.cardholderName, c.last4, c.balance.toFixed(2), String(c.txCount)]),
      });
    }

    doc.save(`reportes-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (loading && !report) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchReport}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report?.summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-muted-foreground">No hay datos para mostrar. Importa transacciones o verifica los filtros.</p>
      </div>
    );
  }

  const summary = report.summary;
  const monthly = report.monthly ?? [];
  const byCard = report.byCard ?? [];
  const feeData = [
    { name: "Fee Vzla", value: summary.feeVzla ?? 0, color: COLORS[0] },
    { name: "Fee Merchant", value: summary.feeMerchant ?? 0, color: COLORS[1] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            Exportar Excel
          </Button>
          <Button variant="outline" onClick={exportPdf}>
            Exportar PDF
          </Button>
        </div>
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
                  {(cards || []).map((c) => (
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
                ${(summary.balance ?? 0).toFixed(2)}
              </p>
            </CardContent>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Recarga</CardTitle>
            <CardContent className="pt-2">
              <p className="text-2xl font-bold text-green-600">
                ${(summary.recarga ?? 0).toFixed(2)}
              </p>
            </CardContent>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Procesada</CardTitle>
            <CardContent className="pt-2">
              <p className="text-2xl font-bold text-red-600">
                ${(summary.procesada ?? 0).toFixed(2)}
              </p>
            </CardContent>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Fees</CardTitle>
            <CardContent className="pt-2">
              <p className="text-2xl font-bold">
                ${((summary.feeVzla ?? 0) + (summary.feeMerchant ?? 0)).toFixed(2)}
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
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="procesada" fill="#8b5cf6" name="Procesada" />
                <Bar dataKey="feeVzla" fill="#a78bfa" name="Fee Vzla" />
                <Bar dataKey="feeMerchant" fill="#c4b5fd" name="Fee Merchant" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desglose de fees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {feeData.some((d) => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
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
                      {feeData.filter((d) => d.value > 0).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-20">No hay fees registrados</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saldo por tarjeta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {byCard.map((c) => (
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
