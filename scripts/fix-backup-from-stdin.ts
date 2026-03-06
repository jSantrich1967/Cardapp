/**
 * Corrige backup leyendo desde stdin (pegar el contenido corrupto).
 * Uso: Pega el contenido y ejecuta: npx tsx scripts/fix-backup-from-stdin.ts
 * O: Get-Content raw.txt | npx tsx scripts/fix-backup-from-stdin.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

async function main() {
  let raw: string;
  if (process.stdin.isTTY) {
    // No stdin, try raw-backup.txt
    try {
      raw = readFileSync(join(process.cwd(), "raw-backup.txt"), "utf-8");
    } catch {
      console.error("Pega el contenido corrupto y presiona Ctrl+Z (Windows) o Ctrl+D (Unix)");
      console.error("O guarda el contenido en raw-backup.txt y ejecuta de nuevo.");
      process.exit(1);
    }
  } else {
    raw = await readStdin();
  }

  const outPath = join(process.cwd(), "backup.json");

  // Try 1: Reverse the entire string (common when JSON is displayed backwards)
  const reversed = raw.split("").reverse().join("");
  try {
    const parsed = JSON.parse(reversed);
    if (parsed.cards && parsed.transactions) {
      writeFileSync(outPath, JSON.stringify(parsed, null, 2), "utf-8");
      console.log("backup.json corregido:", parsed.cards.length, "tarjetas,", parsed.transactions.length, "transacciones.");
      return;
    }
  } catch {
    // Not valid JSON
  }

  // Try 2: Maybe it's valid JSON as-is?
  try {
    const parsed = JSON.parse(raw);
    if (parsed.cards && parsed.transactions) {
      writeFileSync(outPath, JSON.stringify(parsed, null, 2), "utf-8");
      console.log("backup.json ya era válido.");
      return;
    }
  } catch {
    // Not valid
  }

  console.error("No se pudo corregir. El formato no se reconoce.");
  process.exit(1);
}

main();
