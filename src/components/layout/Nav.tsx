"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Upload, List, BarChart3, FileCheck, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/cards", label: "Tarjetas", icon: CreditCard },
  { href: "/import", label: "Importar", icon: Upload },
  { href: "/transactions", label: "Transacciones", icon: List },
  { href: "/reconciliation", label: "Reconciliación", icon: FileCheck },
  { href: "/ves-usados", label: "VES Usados", icon: DollarSign },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            <CreditCard className="h-6 w-6 text-primary" />
            CardOps
          </Link>
          <div className="flex gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
