import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  decimal,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const cardStatusEnum = pgEnum("card_status", ["active", "inactive"]);
export const operationTypeEnum = pgEnum("operation_type", [
  "RECARGA",
  "PROCESADA",
  "FEE_VZLA",
  "FEE_MERCHANT",
]);
export const transactionSourceEnum = pgEnum("transaction_source", [
  "manual",
  "import",
]);
export const importBatchStatusEnum = pgEnum("import_batch_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

// Cards table
export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardholderName: varchar("cardholder_name", { length: 255 }).notNull(),
  last4: varchar("last4", { length: 4 }).notNull(),
  status: cardStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: uuid("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  operationType: operationTypeEnum("operation_type").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"),
  source: transactionSourceEnum("source").default("manual").notNull(),
  importBatchId: uuid("import_batch_id").references(
    () => importBatches.id,
    { onDelete: "set null" }
  ),
  parentTransactionId: uuid("parent_transaction_id"),
  reportedBalance: decimal("reported_balance", { precision: 15, scale: 2 }),
  rawOcrText: text("raw_ocr_text"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Import batches table
export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: uuid("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  imageUrl: varchar("image_url", { length: 500 }),
  imageFilename: varchar("image_filename", { length: 255 }),
  status: importBatchStatusEnum("status").default("pending").notNull(),
  extractedCardName: varchar("extracted_card_name", { length: 255 }),
  extractedLast4: varchar("extracted_last4", { length: 4 }),
  rowCount: integer("row_count").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Import rows (raw extracted data before confirmation)
export const importRows = pgTable("import_rows", {
  id: uuid("id").primaryKey().defaultRandom(),
  importBatchId: uuid("import_batch_id")
    .notNull()
    .references(() => importBatches.id, { onDelete: "cascade" }),
  rowIndex: integer("row_index").notNull(),
  rawText: text("raw_text").notNull(),
  fecha: date("fecha"),
  operacion: varchar("operacion", { length: 100 }),
  monto: decimal("monto", { precision: 15, scale: 2 }),
  saldo: decimal("saldo", { precision: 15, scale: 2 }),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  transactionId: uuid("transaction_id").references(() => transactions.id, {
    onDelete: "set null",
  }),
});

// Relations
export const cardsRelations = relations(cards, ({ many }) => ({
  transactions: many(transactions),
  importBatches: many(importBatches),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  card: one(cards),
  importBatch: one(importBatches),
  parentTransaction: one(transactions, {
    fields: [transactions.parentTransactionId],
    references: [transactions.id],
  }),
  feeTransactions: many(transactions),
}));

export const importBatchesRelations = relations(importBatches, ({ one, many }) => ({
  card: one(cards),
  importRows: many(importRows),
  transactions: many(transactions),
}));

export const importRowsRelations = relations(importRows, ({ one }) => ({
  importBatch: one(importBatches),
  transaction: one(transactions),
}));
