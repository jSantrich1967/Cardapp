/**
 * Seed script for demo data.
 * Run with: npx tsx src/lib/db/seed.ts
 * Requires DATABASE_URL in env.
 */
import "dotenv/config";
import { db } from "./index";
import { cards, transactions } from "./schema";

async function seed() {
  const [card1] = await db
    .insert(cards)
    .values({
      cardholderName: "Iris Briceño",
      last4: "5601",
      status: "active",
    })
    .returning();

  if (!card1) throw new Error("Failed to create card");

  const [tx1, tx2] = await db
    .insert(transactions)
    .values([
      {
        cardId: card1.id,
        date: "2024-01-15",
        operationType: "RECARGA",
        amount: "500",
        source: "manual",
      },
      {
        cardId: card1.id,
        date: "2024-01-20",
        operationType: "PROCESADA",
        amount: "-50",
        source: "manual",
      },
    ])
    .returning();

  if (tx2) {
    await db.insert(transactions).values([
      {
        cardId: card1.id,
        date: "2024-01-20",
        operationType: "FEE_VZLA",
        amount: "-0.75",
        source: "manual",
        parentTransactionId: tx2.id,
      },
      {
        cardId: card1.id,
        date: "2024-01-20",
        operationType: "FEE_MERCHANT",
        amount: "-0.5",
        source: "manual",
        parentTransactionId: tx2.id,
      },
    ]);
  }

  console.log("Seed completed. Card:", card1.cardholderName, "••••", card1.last4);
}

seed().catch(console.error).finally(() => process.exit(0));
