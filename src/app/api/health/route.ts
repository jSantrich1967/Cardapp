import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** GET: Prueba la conexión a la base de datos. Útil para diagnosticar "no baja la data". */
export async function GET() {
  try {
    const start = Date.now();
    const cCount = await db.select().from(cards);
    const duration = Date.now() - start;
    return NextResponse.json({
      ok: true,
      message: "Conexión a la base de datos OK",
      data: {
        cardsCount: cCount.length,
        db_duration_ms: duration,
        db_host: process.env.SUPABASE_DATABASE_URL ? "pooler-config" : "direct-config",
        region: process.env.VERCEL_REGION || "local"
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[health]", e);
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        hint: msg.toLowerCase().includes("password") || msg.toLowerCase().includes("28p01")
          ? "Verifica usuario y contraseña. Si la contraseña tiene *, usa %2A en su lugar."
          : msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("abort")
            ? "Timeout en Vercel. Asegúrate de usar el Pooler (puerto 6543) y tener SUPABASE_DATABASE_URL configurada en el panel de Vercel."
            : "Revisa las variables de entorno en el panel de Vercel.",
      },
      { status: 500 }
    );
  }
}
