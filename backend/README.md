# Invoice OCR Backend

## Save and Validation Contract

`POST /api/invoices` validates the submitted invoice on the server; a client-provided validation result is not accepted as authoritative.

- `Valid`: save the invoice with `validation_status = Valid`.
- `Review Required`: save it for review with `validation_status = Review Required`. This covers missing OCR amounts/dates when the numeric fields are otherwise valid.
- `Invalid`: return HTTP 422 with validation details and do not insert the invoice.

The existing `status` column continues to represent payment state (`Pending`, `Partial`, or `Paid`). `validation_status` is separate. Existing records receive `Unverified` when the additive schema change is applied.

## Persistence Mapping

| Form/API value | Storage |
| --- | --- |
| Invoice number, vendor name, dates, subtotal, tax, total, PO number, raw OCR text | Existing invoice columns |
| Amount paid | `invoices.amount_paid` |
| Invoice type, currency, vendor address/GSTIN/email/phone, GST rate, payment terms/reference, amount extraction flags, parsed items | `invoices.details` JSONB |
| Validation state | `invoices.validation_status` |
| Balance due | Derived from total minus recorded paid amount; not independently stored |
| Subsequent payment events | Existing `payments` table |

The table creation script includes idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements so existing databases can receive the additive columns by rerunning `node createTables.js`.

## Local Database Smoke Test

Automated backend tests mock PostgreSQL; none connects to a live database. To manually exercise persistence, create a **disposable, non-production PostgreSQL database** first, then set `DATABASE_URL` only in the current shell to that database's connection string. Run `node createTables.js` from this directory, start the API with `npm run dev`, and exercise invoice create/list/retrieve endpoints against that disposable database. Do not put production credentials in test commands or logs.

For example, in PowerShell, set `$env:DATABASE_URL` to the disposable database URL without saving it in project files, then run `node createTables.js`. In a second backend terminal run `npm run dev`. Submit a synthetic invoice JSON to `POST http://localhost:5000/api/invoices`, then verify it with `GET http://localhost:5000/api/invoices` and `GET http://localhost:5000/api/invoices/<returned-id>`. Drop the disposable database after the smoke test.

TLS certificate verification is enabled. For a database using a private CA, configure Node's trusted CA bundle (for example with `NODE_EXTRA_CA_CERTS`) rather than disabling certificate verification.
