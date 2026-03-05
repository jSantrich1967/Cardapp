# CardOps

A production-ready web app for managing multiple credit cards with automatic balance computation, fee calculation, and **OCR-based image import** of transaction tables from screenshots.

## Features

- **Multiple cards**: Create and manage cards (cardholder name + last 4 digits)
- **Image → Data import**: Upload PNG/JPG screenshots of Excel-like tables; the app extracts rows via client-side OCR (tesseract.js)
- **Automatic fees**: When a PROCESADA is created, auto-generates FEE VZLA (1.5%) and FEE MERCHANT (1%)
- **Balance logic**: Running balance computed from transactions (RECARGA +, PROCESADA/FEEs -)
- **Reconciliation**: Compare computed vs reported balance from OCR
- **Reports & export**: Dashboard, charts, CSV export

## Tech Stack

- **Next.js 14** (App Router) + React + TypeScript
- **TailwindCSS** + shadcn/ui
- **Drizzle ORM** + PostgreSQL (Supabase)
- **tesseract.js** (client-side OCR, free)
- **Recharts** for charts

## Setup

### 1. Clone and install

```bash
cd "Procesando Tarjetas"
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Supabase Postgres connection string
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Optional: Supabase for storage (for import images)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Database

**Option A: Supabase**

1. Create a project at [supabase.com](https://supabase.com)
2. Get the connection string from Project Settings → Database
3. Run the migration:

```bash
# Using Supabase SQL Editor: paste contents of drizzle/0000_init.sql and run
# Or use drizzle-kit:
npm run db:push
```

**Option B: Local Postgres**

```bash
createdb cardops
DATABASE_URL=postgresql://localhost/cardops npm run db:push
```

### 4. Seed (optional)

```bash
npx tsx src/lib/db/seed.ts
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## OCR: How it works and limitations

### Flow

1. **Upload**: User selects an image (PNG/JPG) of a table with columns like Fecha, Operación, Monto, Saldo
2. **Preprocess**: Client-side grayscale + contrast + threshold to improve OCR accuracy
3. **OCR**: tesseract.js (Spanish) extracts words with bounding boxes
4. **Parse**: Rows are detected by Y-position; cells by X-position. Dates (dd/mm/yyyy), amounts (6.000,00), and operation types (Recarga, Procesada, Fee Vzla, Fee Merchant) are normalized
5. **Review**: Editable grid with low-confidence highlighting and duplicate detection
6. **Confirm**: Saves transactions, auto-generates fees for PROCESADA, stores raw OCR text for audit

### Limitations

- **Accuracy**: Depends on image quality. Blurry or low-contrast images may produce errors. Use clear screenshots.
- **Table structure**: Works best with simple tabular layouts. Complex merged cells or nested tables may not parse correctly.
- **Language**: OCR is configured for Spanish (`spa`). Mixed languages may reduce accuracy.
- **Client-side only**: No server cost, but processing happens in the browser (can be slow on large images).

## Deploy (Vercel)

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add `DATABASE_URL` (and optional Supabase vars) in Project Settings → Environment Variables
4. Deploy

Vercel will run `npm run build` and deploy the Next.js app.

## Data normalization

- **Amounts**: Spanish format `6.000,00` → `6000.00`
- **Dates**: `dd/mm/yyyy`
- **Operation types**: `Recarga` → RECARGA, `Procesada` → PROCESADA, `Fee Vzla` → FEE_VZLA, `Fee Merchant` → FEE_MERCHANT

## Scripts

| Command        | Description                    |
|----------------|--------------------------------|
| `npm run dev`  | Start dev server               |
| `npm run build`| Build for production           |
| `npm run start`| Start production server        |
| `npm run db:push` | Push schema to DB            |
| `npm run db:studio` | Open Drizzle Studio        |
| `npm test`     | Run unit tests                 |

## License

MIT
