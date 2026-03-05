"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ParsedRow } from "@/lib/utils/ocr-parser";
import { formatDateForDb } from "@/lib/utils/parse";
import { AlertTriangle } from "lucide-react";

const OPERATION_TYPES = ["RECARGA", "PROCESADA", "FEE_VZLA", "FEE_MERCHANT"] as const;

interface EditableRow extends ParsedRow {
  id: string;
  isDuplicate?: boolean;
}

export function ImportReviewGrid({
  rows,
  extractedCardName,
  extractedLast4,
  onConfirm,
  onCancel,
}: {
  rows: ParsedRow[];
  extractedCardName: string;
  extractedLast4: string;
  onConfirm: (rows: ParsedRow[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [editableRows, setEditableRows] = useState<EditableRow[]>(() =>
    rows.map((r, i) => ({
      ...r,
      id: `row-${i}`,
    }))
  );

  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    return editableRows.map((r) => {
      const key = `${r.fecha ? formatDateForDb(r.fecha) : ""}-${r.operationType}-${r.monto}`;
      const isDup = seen.has(key);
      seen.add(key);
      return isDup;
    });
  }, [editableRows]);

  const updateRow = (id: string, updates: Partial<ParsedRow>) => {
    setEditableRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const removeRow = (id: string) => {
    setEditableRows((prev) => prev.filter((r) => r.id !== id));
  };

  const validRows = editableRows.filter(
    (r) =>
      r.fecha &&
      (r.operationType || r.operacion) &&
      r.monto != null &&
      !isNaN(Number(r.monto))
  );

  const handleConfirm = () => {
    const toSend = validRows.map(({ id, isDuplicate, ...r }) => ({
      ...r,
      operationType: (r.operationType || (r.operacion ? normalizeOp(r.operacion) : "RECARGA")) as ParsedRow["operationType"],
    }));
    onConfirm(toSend);
  };

  function normalizeOp(op: string): "RECARGA" | "PROCESADA" | "FEE_VZLA" | "FEE_MERCHANT" {
    const l = op.toLowerCase();
    if (l.includes("recarga")) return "RECARGA";
    if (l.includes("procesada")) return "PROCESADA";
    if (l.includes("fee vzla")) return "FEE_VZLA";
    if (l.includes("fee merchant")) return "FEE_MERCHANT";
    return "RECARGA";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paso 2: Revisar y editar datos extraídos</CardTitle>
        <CardDescription>
          {extractedCardName || extractedLast4
            ? `Tarjeta detectada: ${extractedCardName || "?"} ${extractedLast4 ? `•••• ${extractedLast4}` : ""}`
            : "Revisa que las fechas, operaciones y montos sean correctos. Las celdas con baja confianza están resaltadas."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="text-left p-2">Fecha</th>
                <th className="text-left p-2">Operación</th>
                <th className="text-right p-2">Monto</th>
                <th className="text-right p-2">Saldo</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {editableRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`border-t ${
                    row.confidence < 0.7
                      ? "bg-amber-50 dark:bg-amber-950/20"
                      : duplicates[idx]
                      ? "bg-red-50 dark:bg-red-950/20"
                      : ""
                  }`}
                >
                  <td className="p-2">
                    <Input
                      type="date"
                      value={
                        row.fecha
                          ? formatDateForDb(row.fecha)
                          : ""
                      }
                      onChange={(e) => {
                        const d = e.target.value ? new Date(e.target.value) : null;
                        updateRow(row.id, { fecha: d });
                      }}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <Select
                      value={row.operationType || "RECARGA"}
                      onValueChange={(v) =>
                        updateRow(row.id, {
                          operationType: v as ParsedRow["operationType"],
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATION_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2 text-right">
                    <Input
                      type="text"
                      value={row.monto ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = v ? parseFloat(v.replace(",", ".")) : null;
                        updateRow(row.id, { monto: n });
                      }}
                      className="h-8 text-xs text-right"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <Input
                      type="text"
                      value={row.saldo ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = v ? parseFloat(v.replace(",", ".")) : null;
                        updateRow(row.id, { saldo: n });
                      }}
                      className="h-8 text-xs text-right"
                    />
                  </td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeRow(row.id)}
                    >
                      ×
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editableRows.some((_, i) => duplicates[i]) && (
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Filas duplicadas detectadas (misma fecha, tipo y monto). Se omitirán al guardar.
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={validRows.length === 0}
          >
            Confirmar importación ({validRows.length} filas)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
