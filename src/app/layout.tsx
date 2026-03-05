import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/layout/Nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CardOps - Credit Card Management",
  description: "Manage credit cards, import transactions from images, and track balances",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
