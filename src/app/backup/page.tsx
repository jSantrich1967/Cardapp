"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, AlertCircle } from "lucide-react";

export default function BackupPage() {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setMessage(null);
    setExporting(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al exportar");
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cardops-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: "success", text: "Respaldo exportado correctamente." });
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Error al exportar respaldo.",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setMessage({ type: "error", text: "Selecciona un archivo JSON de respaldo." });
      return;
    }

    if (
      !confirm(
        "¿Importar respaldo? Esto reemplazará TODAS las tarjetas y transacciones actuales. Esta acción no se puede deshacer."
      )
    ) {
      return;
    }

    setMessage(null);
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al importar");

      setMessage({
        type: "success",
        text: `Respaldo importado: ${result.cardsRestored} tarjetas, ${result.transactionsRestored} transacciones.`,
      });
      fileInputRef.current.value = "";
      // Refresh the page so other components refetch data
      window.location.reload();
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Error al importar respaldo.",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Respaldo</h1>
        <p className="text-muted-foreground">
          Exporta o importa un respaldo completo de tarjetas y transacciones.
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg p-4 ${
            message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{message.text}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Exportar respaldo
            </CardTitle>
            <CardDescription>
              Descarga un archivo JSON con todas las tarjetas y transacciones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? "Exportando..." : "Exportar"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar respaldo
            </CardTitle>
            <CardDescription>
              Restaura desde un archivo JSON. Reemplazará todos los datos actuales.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            <Button onClick={handleImport} disabled={importing} variant="outline">
              {importing ? "Importando..." : "Importar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
