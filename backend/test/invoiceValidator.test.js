const test = require("node:test");
const assert = require("node:assert/strict");
const { validateInvoice } = require("../services/invoiceValidator");

const validInvoice = () => ({
  invoiceNumber: "NS-2026-0042",
  invoiceDate: "2026-09-05",
  dueDate: "2026-09-20",
  vendor: {
    name: "Northstar Software Ltd",
    email: "billing@northstar.example",
    gstin: "29ABCDE1234F1Z5",
  },
  amounts: {
    subtotal: 1000,
    gstRate: 18,
    gstAmount: 180,
    totalAmount: 1180,
  },
  items: [{
    description: "Professional services",
    quantity: 2,
    unitPrice: 500,
    amount: 1000,
  }],
});

test("accepts a complete invoice with consistent totals and line items", () => {
  const result = validateInvoice(validInvoice());

  assert.equal(result.isValid, true);
  assert.equal(result.requiresReview, false);
  assert.equal(result.status, "Valid");
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test("reports missing required fields and warns about missing dates", () => {
  const result = validateInvoice({});

  assert.equal(result.status, "Invalid");
  assert.deepEqual(
    result.errors.map((error) => error.field),
    ["invoiceNumber", "vendor.name"]
  );
  assert.deepEqual(
    result.warnings.map((warning) => warning.field),
    ["invoiceDate", "dueDate"]
  );
});

test("rejects a malformed date string", () => {
  const invoice = validInvoice();
  invoice.invoiceDate = "not-a-date";

  const result = validateInvoice(invoice);

  assert.equal(result.status, "Invalid");
  assert.ok(result.errors.some((error) => error.field === "invoiceDate"));
});

test("rejects an impossible calendar date", () => {
  const invoice = validInvoice();
  invoice.invoiceDate = "2026-02-31";

  const result = validateInvoice(invoice);

  assert.equal(result.status, "Invalid");
  assert.ok(result.errors.some((error) => error.field === "invoiceDate"));
});

test("rejects month and day overflow in numeric date formats", () => {
  for (const value of ["2026-04-31", "2026-13-01", "2026/02/31", "31/02/2026"]) {
    const invoice = validInvoice();
    invoice.invoiceDate = value;

    const result = validateInvoice(invoice);

    assert.equal(result.status, "Invalid", `${value} should be invalid`);
    assert.ok(result.errors.some((error) => error.field === "invoiceDate"));
  }
});

test("accepts leap years and supported non-ISO date formats", () => {
  for (const value of ["2024-02-29", "09/05/2026", "September 5, 2026"]) {
    const invoice = validInvoice();
    invoice.invoiceDate = value;

    const result = validateInvoice(invoice);

    assert.equal(result.status, "Valid", `${value} should be valid`);
  }
});

test("rejects a leap day in a non-leap year", () => {
  const invoice = validInvoice();
  invoice.invoiceDate = "2025-02-29";

  const result = validateInvoice(invoice);

  assert.equal(result.status, "Invalid");
  assert.ok(result.errors.some((error) => error.field === "invoiceDate"));
});

test("reports a whitespace-only date as invalid", () => {
  const invoice = validInvoice();
  invoice.invoiceDate = "   ";

  const result = validateInvoice(invoice);

  assert.equal(result.status, "Invalid");
  assert.ok(result.errors.some((error) => error.field === "invoiceDate"));
});

test("rejects nonnumeric monetary values", () => {
  const invoice = validInvoice();
  invoice.amounts = {
    subtotal: "not-an-amount",
    gstRate: 0,
    gstAmount: 0,
    totalAmount: 0,
  };
  invoice.items = [];

  const result = validateInvoice(invoice);

  assert.equal(result.status, "Invalid");
  assert.ok(result.errors.some((error) => error.field === "amounts.subtotal"));
});

test("rejects malformed and non-finite values in all invoice amount fields", () => {
  const invalidValues = ["not-an-amount", "12x", "NaN", NaN, Infinity, -Infinity];

  for (const field of ["subtotal", "gstRate", "gstAmount", "totalAmount", "amountPaid"]) {
    for (const value of invalidValues) {
      const invoice = validInvoice();
      invoice.amounts[field] = value;
      invoice.items = [];

      const result = validateInvoice(invoice);

      assert.equal(
        result.status,
        "Invalid",
        `${field}=${String(value)} should be invalid`
      );
      assert.ok(
        result.errors.some((error) => error.field === `amounts.${field}`),
        `${field}=${String(value)} should report its field`
      );
    }
  }
});

test("treats absent and blank optional amount fields as zero", () => {
  for (const value of [undefined, null, "", "   "]) {
    const invoice = validInvoice();
    invoice.amounts = {
      subtotal: value,
      gstRate: value,
      gstAmount: value,
      totalAmount: value,
    };
    invoice.items = [];

    const result = validateInvoice(invoice);

    assert.equal(result.status, "Valid");
  }
});

test("requires review when parsed core amount labels were not extracted", () => {
  const invoice = validInvoice();
  invoice.amounts.extraction = {
    subtotal: false,
    gstAmount: false,
    totalAmount: false,
  };

  const result = validateInvoice(invoice);

  assert.equal(result.isValid, true);
  assert.equal(result.requiresReview, true);
  assert.equal(result.status, "Review Required");
  assert.deepEqual(
    result.warnings.map((warning) => warning.field),
    ["amounts.subtotal", "amounts.totalAmount", "amounts.gstAmount"]
  );
});

test("accepts explicit zero amounts when their labels were extracted", () => {
  const invoice = validInvoice();
  invoice.amounts = {
    subtotal: 0,
    gstRate: 0,
    gstAmount: 0,
    totalAmount: 0,
    extraction: {
      subtotal: true,
      gstAmount: true,
      totalAmount: true,
    },
  };
  invoice.items = [];

  const result = validateInvoice(invoice);

  assert.equal(result.isValid, true);
  assert.equal(result.requiresReview, false);
  assert.equal(result.status, "Valid");
  assert.deepEqual(result.warnings, []);
});

test("accepts zero and finite integer and decimal amount values", () => {
  const zeroInvoice = validInvoice();
  zeroInvoice.amounts = {
    subtotal: 0,
    gstRate: 0,
    gstAmount: 0,
    totalAmount: 0,
  };
  zeroInvoice.items = [];

  assert.equal(validateInvoice(zeroInvoice).status, "Valid");

  const decimalInvoice = validInvoice();
  decimalInvoice.amounts = {
    subtotal: "1000.50",
    gstRate: 18,
    gstAmount: "180.09",
    totalAmount: "1180.59",
  };
  decimalInvoice.items = [];

  assert.equal(validateInvoice(decimalInvoice).status, "Valid");
});

test("rejects nonnumeric line-item values", () => {
  for (const [field, value] of [
    ["quantity", "two"],
    ["unitPrice", NaN],
    ["amount", Infinity],
  ]) {
    const invoice = validInvoice();
    invoice.items[0][field] = value;

    const result = validateInvoice(invoice);

    assert.equal(result.status, "Invalid");
    assert.ok(
      result.errors.some((error) => error.field === `items[0].${field}`)
    );
  }
});

test("reports a total that does not equal subtotal plus tax", () => {
  const invoice = validInvoice();
  invoice.amounts.totalAmount = 1200;

  const result = validateInvoice(invoice);

  assert.equal(result.status, "Invalid");
  assert.ok(result.errors.some((error) => error.field === "amounts.totalAmount"));
});

test("reports a line item whose quantity and unit price do not match its amount", () => {
  const invoice = validInvoice();
  invoice.items[0].amount = 900;

  const result = validateInvoice(invoice);

  assert.equal(result.status, "Invalid");
  assert.ok(result.errors.some((error) => error.field === "items[0].amount"));
});