import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Upload, BarChart3, Database } from "lucide-react";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CardOps</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tus tarjetas de crédito, importa transacciones desde imágenes y calcula saldos automáticamente.
        </p>
      </div>

      <DashboardSummary />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CreditCard className="h-8 w-8 text-primary" />
            <CardTitle>Tarjetas</CardTitle>
            <CardDescription>Administra tus tarjetas (nombre + últimos 4 dígitos)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/cards">Ir a Tarjetas</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Upload className="h-8 w-8 text-primary" />
            <CardTitle>Importar</CardTitle>
            <CardDescription>Sube una imagen de tu tabla Excel para extraer transacciones con OCR</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/import">Importar Imagen</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <BarChart3 className="h-8 w-8 text-primary" />
            <CardTitle>Transacciones</CardTitle>
            <CardDescription>Lista de transacciones con exportación a Excel y PDF</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/transactions">Ver Transacciones</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Database className="h-8 w-8 text-primary" />
            <CardTitle>Respaldo</CardTitle>
            <CardDescription>Exporta o importa un respaldo completo de tus datos</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/backup">Ir a Respaldo</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
