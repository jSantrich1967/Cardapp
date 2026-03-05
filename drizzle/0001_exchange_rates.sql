-- Tipo de cambio de mercado por fecha (para Resultados)
CREATE TABLE IF NOT EXISTS "exchange_rates" (
  "date" date PRIMARY KEY NOT NULL,
  "rate" decimal(15, 4) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
