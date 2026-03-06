-- CardOps: solo tablas (los tipos ya existen)
-- Usa este script si obtuviste "card_status ya existe"

CREATE TABLE IF NOT EXISTS "cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cardholder_name" varchar(255) NOT NULL,
  "last4" varchar(4) NOT NULL,
  "status" "card_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "import_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "card_id" uuid NOT NULL REFERENCES "cards"("id") ON DELETE CASCADE,
  "image_url" varchar(500),
  "image_filename" varchar(255),
  "status" "import_batch_status" DEFAULT 'pending' NOT NULL,
  "extracted_card_name" varchar(255),
  "extracted_last4" varchar(4),
  "row_count" integer DEFAULT 0,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "card_id" uuid NOT NULL REFERENCES "cards"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "operation_type" "operation_type" NOT NULL,
  "amount" decimal(15, 2) NOT NULL,
  "notes" text,
  "source" "transaction_source" DEFAULT 'manual' NOT NULL,
  "import_batch_id" uuid REFERENCES "import_batches"("id") ON DELETE SET NULL,
  "parent_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
  "reported_balance" decimal(15, 2),
  "raw_ocr_text" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "import_rows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "import_batch_id" uuid NOT NULL REFERENCES "import_batches"("id") ON DELETE CASCADE,
  "row_index" integer NOT NULL,
  "raw_text" text NOT NULL,
  "fecha" date,
  "operacion" varchar(100),
  "monto" decimal(15, 2),
  "saldo" decimal(15, 2),
  "confidence" decimal(3, 2),
  "transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "exchange_rates" (
  "date" date PRIMARY KEY NOT NULL,
  "rate" decimal(15, 4) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "transactions_card_id_idx" ON "transactions" ("card_id");
CREATE INDEX IF NOT EXISTS "transactions_date_idx" ON "transactions" ("date");
CREATE INDEX IF NOT EXISTS "transactions_import_batch_id_idx" ON "transactions" ("import_batch_id");
CREATE INDEX IF NOT EXISTS "transactions_parent_transaction_id_idx" ON "transactions" ("parent_transaction_id");
-- Importante: la tabla es "import_batches", NO "import"
CREATE INDEX IF NOT EXISTS "import_batches_card_id_idx" ON "import_batches" ("card_id");
