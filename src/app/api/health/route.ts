import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** GET: Prueba la conexión a la base de datos. Útil para diagnosticar "no baja la data". */
export async function GET() {
  try {
    await db.select().from(cards).limit(1);
    return NextResponse.json({
      ok: true,
      message: "Conexión a la base de datos OK",
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
          : msg.toLowerCase().includes("connect") || msg.toLowerCase().includes("econnrefused") || msg.toLowerCase().includes("timeout")
          ? "No se puede conectar. En Supabase Dashboard → Settings → Database, copia la URI de 'Direct connection' (puerto 5432) y úsala como SUPABASE_DATABASE_URL."
          : "Revisa SUPABASE_DATABASE_URL en .env.local",
      },
      { status: 500 }
    );
  }
}
