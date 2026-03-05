# CardOps Database Schema

## Tables Overview

### 1. `cards`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Primary key |
| cardholder_name | varchar(255) | e.g. "Iris Briceño" |
| last4 | varchar(4) | Last 4 digits, e.g. "5601" |
| status | enum: active, inactive | Card status |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update |

### 2. `transactions`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Primary key |
| card_id | uuid (FK → cards) | Reference to card |
| date | date | Transaction date |
| operation_type | enum: RECARGA, PROCESADA, FEE_VZLA, FEE_MERCHANT | Operation type |
| amount | decimal(15,2) | Amount (positive for RECARGA, negative for others) |
| notes | text | Optional notes |
| source | enum: manual, import | How it was created |
| import_batch_id | uuid (FK, nullable) | If from import |
| parent_transaction_id | uuid (FK, nullable) | For fee → PROCESADA link |
| reported_balance | decimal(15,2) nullable | From OCR Saldo column if present |
| raw_ocr_text | text nullable | Original OCR text for audit |
| created_at | timestamptz | Creation timestamp |

### 3. `import_batches`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Primary key |
| card_id | uuid (FK → cards) | Card for this import |
| image_url | varchar(500) | Stored image path (Supabase Storage) |
| image_filename | varchar(255) | Original filename |
| status | enum: pending, processing, completed, failed | Import status |
| extracted_card_name | varchar(255) | OCR-detected card name |
| extracted_last4 | varchar(4) | OCR-detected last4 |
| row_count | int | Number of rows extracted |
| error_message | text nullable | If failed |
| created_at | timestamptz | Creation timestamp |

### 4. `import_rows` (raw extracted rows before confirmation)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Primary key |
| import_batch_id | uuid (FK) | Batch reference |
| row_index | int | Row order |
| raw_text | text | Full raw OCR text for row |
| fecha | date nullable | Parsed date |
| operacion | varchar(100) | Parsed operation |
| monto | decimal(15,2) | Parsed amount |
| saldo | decimal(15,2) nullable | Parsed balance if present |
| confidence | decimal(3,2) | 0-1 confidence score |
| transaction_id | uuid (FK, nullable) | After save, link to created transaction |

## Relationships
- cards 1 → N transactions
- cards 1 → N import_batches
- import_batches 1 → N import_rows
- transactions N → 1 parent_transaction (for fees)
- transactions N → 1 import_batches (optional)

## Indexes
- transactions(card_id, date)
- transactions(import_batch_id)
- transactions(parent_transaction_id)
- import_batches(card_id)
- import_rows(import_batch_id)
