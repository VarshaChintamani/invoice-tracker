const test = require("node:test");
const assert = require("node:assert/strict");
const { extractInvoiceData } = require("../services/invoiceParser");

const sampleOcrText = `
Northstar Software Ltd
10 Market Road
GSTIN: 29ABCDE1234F1Z5
TAX INVOICE
Invoice Number: NS-2026-0042
PO Number: PO-2026-9
Invoice Date: 05/09/2026
Due Date: 20/09/2026
Vendor Email: billing@northstar.example
Phone: +91 9876543210
Description Qty Rate Amount
Professional services 2 500.00 1000.00
Subtotal: 1,000.00
GST (18%): 180.00
Total Amount: 1,180.00
`;

test("extracts representative invoice fields and a line item", () => {
  const invoice = extractInvoiceData(sampleOcrText);

  assert.equal(invoice.invoiceNumber, "NS-2026-0042");
  assert.equal(invoice.invoiceType, "TAX INVOICE");
  assert.equal(invoice.invoiceDate, "2026-09-05");
  assert.equal(invoice.dueDate, "2026-09-20");
  assert.equal(invoice.poNumber, "PO-2026-9");
  assert.equal(invoice.vendor.name, "Northstar Software Ltd");
  assert.equal(invoice.vendor.address, "10 Market Road");
  assert.equal(invoice.vendor.email, "billing@northstar.example");
  assert.equal(invoice.vendor.phone, "+919876543210");
  assert.equal(invoice.vendor.gstin, "29ABCDE1234F1Z5");
  assert.deepEqual(invoice.items, [{
    description: "Professional services",
    quantity: 2,
    unitPrice: 500,
    amount: 1000,
  }]);
  assert.deepEqual(invoice.amounts, {
    subtotal: 1000,
    gstRate: 18,
    gstAmount: 180,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalTax: 180,
    totalAmount: 1180,
    extraction: {
      subtotal: true,
      gstAmount: true,
      totalAmount: true,
    },
    amountPaid: 0,
    balanceDue: 1180,
  });
});

test("returns empty/default fields when OCR text has no invoice data", () => {
  const invoice = extractInvoiceData("");

  assert.equal(invoice.invoiceNumber, "");
  assert.equal(invoice.vendor.name, "");
  assert.equal(invoice.invoiceDate, null);
  assert.equal(invoice.dueDate, null);
  assert.deepEqual(invoice.items, []);
  assert.equal(invoice.amounts.subtotal, 0);
  assert.equal(invoice.amounts.totalAmount, 0);
  assert.deepEqual(invoice.amounts.extraction, {
    subtotal: false,
    gstAmount: false,
    totalAmount: false,
  });
});

test("returns null for a date that cannot be parsed", () => {
  const invoice = extractInvoiceData("Invoice Date: not-a-date");

  assert.equal(invoice.invoiceDate, null);
});

test("rejects an impossible calendar date instead of emitting it", () => {
  const invoice = extractInvoiceData("Invoice Date: 31/02/2026");

  assert.equal(invoice.invoiceDate, null);
});

test("accepts leap days only in leap years", () => {
  assert.equal(
    extractInvoiceData("Invoice Date: 29/02/2024").invoiceDate,
    "2024-02-29"
  );
  assert.equal(
    extractInvoiceData("Invoice Date: 29/02/2025").invoiceDate,
    null
  );
});

test("rejects day and month overflow", () => {
  for (const value of ["31/04/2026", "31/02/2026", "01/13/2026"]) {
    assert.equal(
      extractInvoiceData(`Invoice Date: ${value}`).invoiceDate,
      null,
      `${value} should not be parsed as a calendar date`
    );
  }
});

test("uses zero when an amount cannot be read", () => {
  const invoice = extractInvoiceData("Subtotal: N/A\nTotal Amount: unknown");

  assert.equal(invoice.amounts.subtotal, 0);
  assert.equal(invoice.amounts.totalAmount, 0);
  assert.deepEqual(invoice.amounts.extraction, {
    subtotal: false,
    gstAmount: false,
    totalAmount: false,
  });
});

test("marks explicit zero as extracted and rejects malformed numeric prefixes", () => {
  const zeroInvoice = extractInvoiceData(
    "Subtotal: 0.00\nGST (0%): 0.00\nTotal Amount: 0.00"
  );
  const malformedInvoice = extractInvoiceData(
    "Subtotal: 1.234\nTotal Amount: 12abc"
  );

  assert.equal(zeroInvoice.amounts.subtotal, 0);
  assert.equal(zeroInvoice.amounts.gstAmount, 0);
  assert.equal(zeroInvoice.amounts.totalAmount, 0);
  assert.deepEqual(zeroInvoice.amounts.extraction, {
    subtotal: true,
    gstAmount: true,
    totalAmount: true,
  });
  assert.equal(malformedInvoice.amounts.subtotal, 0);
  assert.equal(malformedInvoice.amounts.totalAmount, 0);
  assert.equal(malformedInvoice.amounts.extraction.subtotal, false);
  assert.equal(malformedInvoice.amounts.extraction.totalAmount, false);
});