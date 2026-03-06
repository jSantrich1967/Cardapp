import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Upload, BarChart3, Database, ArrowRight } from "lucide-react";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";

const features = [
  {
    href: "/cards",
    icon: CreditCard,
    title: "Tarjetas",
    description: "Administra tus tarjetas (nombre + últimos 4 dígitos)",
    label: "Ir a Tarjetas",
  },
  {
    href: "/import",
    icon: Upload,
    title: "Importar",
    description: "Sube una imagen de tu tabla Excel para extraer transacciones con OCR",
    label: "Importar Imagen",
  },
  {
    href: "/transactions",
    icon: BarChart3,
    title: "Transacciones",
    description: "Lista de transacciones con exportación a Excel y PDF",
    label: "Ver Transacciones",
  },
  {
    href: "/backup",
    icon: Database,
    title: "Respaldo",
    description: "Exporta o importa un respaldo completo de tus datos",
    label: "Ir a Respaldo",
  },
];

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ href, icon: Icon, title, description, label }) => (
          <Card key={href} className="flex flex-col transition-colors hover:border-primary/30">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{title}</CardTitle>
              </div>
              <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-0">
              <Button asChild variant="outline" className="w-full justify-between group">
                <Link href={href}>
                  {label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
