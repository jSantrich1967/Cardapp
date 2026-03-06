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
  const criticalCSS = `
    body{font-family:system-ui,-apple-system,sans-serif;background:#f5f5f7;color:#1d1d1f;margin:0;line-height:1.5;min-height:100vh}
    a{color:#6366f1;text-decoration:none}
    a:hover{text-decoration:underline}
    .container{max-width:1200px;margin:0 auto;padding:0 1rem}
    nav{background:#fff;border-bottom:1px solid #e5e7eb;padding:.75rem 1rem}
    nav>div{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem}
    nav a{padding:.5rem .75rem;border-radius:6px;font-weight:500;display:inline-flex;align-items:center;gap:.5rem}
    nav a:hover{background:#f3f4f6}
    main{padding:1.5rem 0;flex:1}
    .min-h-screen{min-height:100vh;display:flex;flex-direction:column}
    h1{font-size:1.5rem;font-weight:700;margin:0 0 .5rem}
    p{margin:0 0 1rem;color:#6b7280}
    button,.btn{padding:.5rem 1rem;border-radius:6px;font-weight:500;cursor:pointer;border:1px solid #e5e7eb;background:#fff}
    button:hover,.btn:hover{background:#f3f4f6}
    .rounded-lg{background:#fff;border-radius:8px;border:1px solid #e5e7eb}
    main .border{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem}
    table{width:100%;border-collapse:collapse}
    th,td{padding:.75rem 1rem;text-align:left;border-bottom:1px solid #e5e7eb}
    th{font-weight:600}
    .space-y-6>*+*{margin-top:1.5rem}
    .flex{display:flex}
    .gap-2{gap:.5rem}
    .gap-4{gap:1rem}
  `;

  return (
    <html lang="es">
      <body className={inter.className}>
        <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
