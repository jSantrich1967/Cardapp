"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { preprocessImageForOcr } from "@/lib/utils/image-preprocess";
import { parseOcrToRows, extractCardInfo, type ParsedRow } from "@/lib/utils/ocr-parser";
import { formatDateForDb } from "@/lib/utils/parse";
import { createWorker, type Worker } from "tesseract.js";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { ImportReviewGrid } from "@/components/import/ImportReviewGrid";

interface CardItem {
  id: string;
  cardholderName: string;
  last4: string;
}

export default function ImportPage() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "review" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [batchId, setBatchId] = useState<string>("");
  const [extractedCardName, setExtractedCardName] = useState<string>("");
  const [extractedLast4, setExtractedLast4] = useState<string>("");

  useEffect(() => {
    fetch("/api/cards")
      .then((r) => r.json())
      .then((data) => {
        const cardList = Array.isArray(data) ? data : [];
        setCards(cardList);
        if (cardList.length > 0 && !selectedCardId) setSelectedCardId(cardList[0].id);
      })
      .catch(() => setCards([]));
  }, []);

  const runOcr = useCallback(async () => {
    if (!file || !selectedCardId) return;
    setStatus("processing");
    setError("");
    setProgress(0);

    let worker: Worker | null = null;
    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Preprocess
      setStatus("processing");
      setProgress(10);
      const processedDataUrl = await preprocessImageForOcr(url, {
        grayscale: true,
        contrast: 1.2,
        threshold: 140,
      });
      setProgress(30);

      worker = await createWorker("spa", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(30 + Math.round(m.progress * 50));
          }
        },
      });

      const { data } = await worker.recognize(processedDataUrl);
      setProgress(85);

      const words = data.words.map((w) => ({
        text: w.text,
        bbox: w.bbox,
        confidence: w.confidence,
      }));

      const cardInfo = extractCardInfo(words);
      setExtractedCardName(cardInfo.cardName || "");
      setExtractedLast4(cardInfo.last4 || "");

      const rows = parseOcrToRows(words);
      setParsedRows(rows);
      setProgress(100);

      // Create import batch
      const batchRes = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: selectedCardId,
          imageFilename: file.name,
        }),
      });
      const batch = await batchRes.json();
      if (batch.id) setBatchId(batch.id);

      setStatus("review");
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR failed");
      setStatus("error");
    } finally {
      if (worker) await worker.terminate();
    }
  }, [file, selectedCardId]);

  const handleConfirmImport = async (rows: Array<ParsedRow & { cardId?: string }>) => {
    if (!batchId) return;
    setStatus("saving");
    setError("");
    try {
      const payload = {
        rows: rows.map((r) => ({
          fecha: r.fecha ? formatDateForDb(r.fecha) : null,
          operacion: r.operacion,
          operationType: r.operationType,
          monto: r.monto,
          saldo: r.saldo ?? undefined,
          rawText: r.rawText,
          confidence: r.confidence,
          cardId: r.cardId,
        })),
      };
      const res = await fetch(`/api/import/${batchId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setPreviewUrl("");
    setProgress(0);
    setStatus("idle");
    setError("");
    setParsedRows([]);
    setBatchId("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importar desde imagen</h1>
        <p className="text-muted-foreground">
          Sube una captura de pantalla de una tabla con columnas: Fecha, Operación y Monto (Saldo es opcional).
        </p>
      </div>

      {status === "idle" || status === "error" ? (
        <Card>
          <CardHeader>
            <CardTitle>Paso 1: Selecciona tarjeta y sube imagen</CardTitle>
            <CardDescription>
              Formatos: PNG, JPG. La tabla debe ser legible (buen contraste).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Tarjeta</Label>
              <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una tarjeta" />
                </SelectTrigger>
                <SelectContent>
                  {(cards || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.cardholderName} •••• {c.last4}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Imagen</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {(cards || []).length === 0 && (
              <p className="text-sm text-amber-600">
                Crea una tarjeta primero en la página de Tarjetas.
              </p>
            )}
            <Button
              onClick={runOcr}
              disabled={!file || !selectedCardId || (cards || []).length === 0}
            >
              <Upload className="h-4 w-4 mr-2" />
              Procesar con OCR
            </Button>
            {error && (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {status === "processing" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="flex-1">
                <p className="font-medium">Extrayendo texto con OCR...</p>
                <Progress value={progress} className="mt-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {status === "review" && (
        <ImportReviewGrid
          rows={parsedRows}
          cards={cards}
          defaultCardId={selectedCardId || (cards[0]?.id ?? "")}
          extractedCardName={extractedCardName}
          extractedLast4={extractedLast4}
          onConfirm={handleConfirmImport}
          onCancel={reset}
        />
      )}

      {status === "saving" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-medium">Guardando transacciones...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {status === "done" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 text-green-600">
              <CheckCircle className="h-8 w-8" />
              <div>
                <p className="font-medium">Importación completada</p>
                <p className="text-sm text-muted-foreground">
                  Las transacciones se guardaron correctamente. Los fees se generaron automáticamente.
                </p>
                <Button onClick={reset} className="mt-4">
                  Importar otra imagen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
