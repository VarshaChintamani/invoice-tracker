const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const Tesseract = require("tesseract.js");

const backendDirectory = path.resolve(__dirname, "..");
const fixtureDirectory = path.join(__dirname, "fixtures", "invoices");
const originalCreateWorker = Tesseract.createWorker;

Tesseract.createWorker = (languages, oem, options = {}) =>
  originalCreateWorker(languages, oem, {
    ...options,
    langPath: backendDirectory,
    gzip: false,
  });

const { performOCR } = require("../services/ocrService");
const { extractInvoiceData } = require("../services/invoiceParser");
const { validateInvoice } = require("../services/invoiceValidator");

const cases = [
  {
    fixture: "clear-invoice.svg",
    recognizedText: [
      "NORTHSTAR SOFTWARE LTD",
      "NS-2026-0042",
      "05/09/2026",
      "1000.00",
      "180.00",
      "1180.00",
    ],
    fields: {
      invoiceNumber: "NS-2026-0042",
      invoiceDate: "2026-09-05",
      vendor: "NORTHSTAR SOFTWARE LTD",
      subtotal: 1000,
      tax: 180,
      total: 1180,
      items: [
        { description: "Professional services", quantity: 2, unitPrice: 500, amount: 1000 },
      ],
    },
  },
  {
    fixture: "alternate-date-invoice.svg",
    recognizedText: [
      "BRIGHT STAR TRADERS LTD",
      "BST-2026-0135",
      "12-10-2026",
      "250.00",
    ],
    fields: {
      invoiceNumber: "BST-2026-0135",
      invoiceDate: "2026-10-12",
      vendor: "BRIGHT STAR TRADERS LTD",
      subtotal: 250,
      tax: 0,
      total: 250,
      items: [
        { description: "Office supplies", quantity: 1, unitPrice: 250, amount: 250 },
      ],
    },
  },
  {
    fixture: "decimal-multi-line-invoice.svg",
    recognizedText: [
      "OAK AND PINE SERVICES LTD",
      "OPS-2026-0051",
      "12.10.2026",
      "125.50",
      "10.25",
      "20.50",
      "146.00",
    ],
    fields: {
      invoiceNumber: "OPS-2026-0051",
      invoiceDate: "2026-10-12",
      vendor: "OAK AND PINE SERVICES LTD",
      subtotal: 146,
      tax: 0,
      total: 146,
      items: [
        { description: "Data analysis", quantity: 1, unitPrice: 125.5, amount: 125.5 },
        { description: "Monthly support", quantity: 2, unitPrice: 10.25, amount: 20.5 },
      ],
    },
  },
];

const withQuietConsole = async (action) => {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};

  try {
    return await action();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
};

const assertGroundTruth = (actual, expected, field) => {
  assert.ok(Object.is(actual, expected), `Ground-truth mismatch for ${field}`);
};

const normalizeText = (value) => value.toUpperCase().replace(/\s+/g, " ").trim();

for (const sample of cases) {
  test(`real OCR and invoice extraction: ${sample.fixture}`, async () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "invoice-ocr-accuracy-")
    );
    const imagePath = path.join(
      temporaryDirectory,
      sample.fixture.replace(/\.svg$/i, ".png")
    );
    const preprocessedPath = path.join(
      temporaryDirectory,
      `${path.parse(imagePath).name}-processed.png`
    );

    try {
      const svg = fs.readFileSync(
        path.join(fixtureDirectory, sample.fixture)
      );
      await sharp(svg).png().toFile(imagePath);

      const ocrText = await withQuietConsole(() => performOCR(imagePath));
      assert.ok(ocrText.trim(), "OCR returned no text");

      const normalizedOcr = normalizeText(ocrText);
      for (const expectedText of sample.recognizedText) {
        assert.ok(
          normalizedOcr.includes(normalizeText(expectedText)),
          `OCR recognition mismatch for ${sample.fixture}`
        );
      }

      const invoice = extractInvoiceData(ocrText);
      assertGroundTruth(invoice.invoiceNumber, sample.fields.invoiceNumber, "invoice number");
      assertGroundTruth(invoice.invoiceDate, sample.fields.invoiceDate, "invoice date");
      assertGroundTruth(invoice.vendor.name, sample.fields.vendor, "vendor name");
      assertGroundTruth(invoice.amounts.subtotal, sample.fields.subtotal, "subtotal");
      assertGroundTruth(invoice.amounts.gstAmount, sample.fields.tax, "tax amount");
      assertGroundTruth(invoice.amounts.totalAmount, sample.fields.total, "total amount");
      assertGroundTruth(invoice.items.length, sample.fields.items.length, "line item count");

      for (let index = 0; index < sample.fields.items.length; index += 1) {
        const actual = invoice.items[index];
        const expected = sample.fields.items[index];
        assertGroundTruth(actual.description, expected.description, `item ${index + 1} description`);
        assertGroundTruth(actual.quantity, expected.quantity, `item ${index + 1} quantity`);
        assertGroundTruth(actual.unitPrice, expected.unitPrice, `item ${index + 1} unit price`);
        assertGroundTruth(actual.amount, expected.amount, `item ${index + 1} amount`);
      }

      const validation = validateInvoice(invoice);
      assertGroundTruth(validation.status, "Valid", "invoice validation status");
      assertGroundTruth(validation.requiresReview, false, "invoice review status");
      assert.equal(fs.existsSync(preprocessedPath), false, "OCR left a preprocessed image behind");
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
}

test("real OCR marks an impossible invoice date for review", async () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "invoice-ocr-date-review-")
  );
  const imagePath = path.join(temporaryDirectory, "impossible-date.png");
  const preprocessedPath = path.join(temporaryDirectory, "impossible-date-processed.png");

  try {
    const sourcePath = path.join(fixtureDirectory, "clear-invoice.svg");
    const svg = fs.readFileSync(sourcePath, "utf8")
      .replace("05/09/2026", "31/02/2026");
    await sharp(Buffer.from(svg)).png().toFile(imagePath);

    const ocrText = await withQuietConsole(() => performOCR(imagePath));
    assert.ok(normalizeText(ocrText).includes("31/02/2026"), "OCR did not recognize the test date");

    const invoice = extractInvoiceData(ocrText);
    assertGroundTruth(invoice.invoiceDate, null, "impossible invoice date");

    const validation = validateInvoice(invoice);
    assertGroundTruth(validation.status, "Review Required", "impossible-date review status");
    assert.ok(validation.warnings.some((warning) => warning.field === "invoiceDate"));
    assert.equal(fs.existsSync(preprocessedPath), false, "OCR left a preprocessed image behind");
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("real OCR does not treat unreadable amount labels as valid zero amounts", async () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "invoice-ocr-amount-review-")
  );
  const imagePath = path.join(temporaryDirectory, "unreadable-amounts.png");
  const preprocessedPath = path.join(temporaryDirectory, "unreadable-amounts-processed.png");

  try {
    const sourcePath = path.join(fixtureDirectory, "clear-invoice.svg");
    const svg = fs.readFileSync(sourcePath, "utf8")
      .replace("Subtotal: 1000.00", "Subtotal: N/A")
      .replace("GST (18%): 180.00", "GST (18%): N/A")
      .replace("Total Amount: 1180.00", "Total Amount: N/A");
    await sharp(Buffer.from(svg)).png().toFile(imagePath);

    const ocrText = await withQuietConsole(() => performOCR(imagePath));
    const normalizedOcr = normalizeText(ocrText);
    assert.ok(normalizedOcr.includes("SUBTOTAL"), "OCR did not recognize the subtotal label");
    assert.ok(normalizedOcr.includes("N/A"), "OCR did not recognize the unreadable amount marker");

    const invoice = extractInvoiceData(ocrText);
    assertGroundTruth(invoice.amounts.subtotal, 0, "unreadable subtotal fallback");
    assertGroundTruth(invoice.amounts.gstAmount, 0, "unreadable tax fallback");
    assertGroundTruth(invoice.amounts.totalAmount, 0, "unreadable total fallback");
    assert.deepEqual(invoice.amounts.extraction, {
      subtotal: false,
      gstAmount: false,
      totalAmount: false,
    });

    const validation = validateInvoice(invoice);
    assertGroundTruth(validation.status, "Review Required", "unreadable-amount review status");
    assert.deepEqual(
      validation.warnings.map((warning) => warning.field),
      ["amounts.subtotal", "amounts.totalAmount", "amounts.gstAmount"]
    );
    assert.equal(fs.existsSync(preprocessedPath), false, "OCR left a preprocessed image behind");
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("real OCR rejects malformed image data without leaving a processed image", async () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "invoice-ocr-invalid-")
  );
  const imagePath = path.join(temporaryDirectory, "malformed.png");
  const preprocessedPath = path.join(temporaryDirectory, "malformed-processed.png");

  try {
    fs.writeFileSync(imagePath, Buffer.from("not a PNG image"));

    await withQuietConsole(() => assert.rejects(performOCR(imagePath)));
    assertGroundTruth(fs.existsSync(preprocessedPath), false, "failed OCR temp image cleanup");
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});