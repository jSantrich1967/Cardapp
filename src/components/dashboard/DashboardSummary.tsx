"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { TrendingUp } from "lucide-react";

export function DashboardSummary() {
  const [data, setData] = useState<{
    summary?: { balance: number; recarga: number; procesada: number; feeVzla: number; feeMerchant: number };
    byCard?: Array<{ cardholderName: string; last4: string; balance: number }>;
  } | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data?.summary) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Resumen global
        </CardTitle>
        <CardDescription>Saldo total y desglose por tipo</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Saldo total</p>
            <p className="text-2xl font-bold text-primary">
              ${data.summary.balance.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Recargas</p>
            <p className="text-2xl font-bold text-green-600">
              ${data.summary.recarga.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Procesadas</p>
            <p className="text-2xl font-bold text-red-600">
              ${data.summary.procesada.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fees</p>
            <p className="text-2xl font-bold">
              ${(data.summary.feeVzla + data.summary.feeMerchant).toFixed(2)}
            </p>
          </div>
        </div>
        {data.byCard && data.byCard.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Por tarjeta</p>
            <div className="flex flex-wrap gap-4">
              {data.byCard.map((c) => (
                <Link
                  key={`${c.cardholderName}-${c.last4}`}
                  href="/transactions"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {c.cardholderName} •••• {c.last4}: ${c.balance.toFixed(2)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
