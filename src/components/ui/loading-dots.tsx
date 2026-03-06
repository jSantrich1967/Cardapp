"use client";

import { Loader2 } from "lucide-react";

/**
 * Indicador de carga con spinner.
 * Más visible que solo texto - evita que parezca bloqueado.
 */
export function LoadingDots({ className = "" }: { className?: string }) {
  return (
    <p className={`text-muted-foreground inline-flex items-center gap-2 ${className}`}>
      <Loader2 className="h-4 w-4 animate-spin" />
      Cargando...
    </p>
  );
}
