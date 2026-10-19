const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const Module = require("node:module");
const path = require("node:path");
const sharp = require("sharp");
const { once } = require("node:events");

const sampleOcrText = `
Northstar Software Ltd
10 Market Road
TAX INVOICE
Invoice Number: NS-2026-0042
Invoice Date: 05/09/2026
Due Date: 20/09/2026
Vendor Email: billing@northstar.example
Description Qty Rate Amount
Professional services 2 500.00 1000.00
Subtotal: 1,000.00
GST (18%): 180.00
Total Amount: 1,180.00
`;

const modulePaths = {
  db: require.resolve("../db"),
  ocr: require.resolve("../services/ocrService"),
  parser: require.resolve("../services/invoiceParser"),
  validator: require.resolve("../services/invoiceValidator"),
  controller: require.resolve("../controllers/invoiceController"),
  routes: require.resolve("../routes/invoiceRoutes"),
};

const replaceModule = (modulePath, exports) => {
  const mockedModule = new Module(modulePath);
  mockedModule.filename = modulePath;
  mockedModule.loaded = true;
  mockedModule.exports = exports;
  require.cache[modulePath] = mockedModule;
};

const startTestServer = async ({
  ocrText = sampleOcrText,
  ocrError,
  validatorError,
  databaseError,
} = {}) => {
  const previousModules = new Map(
    Object.values(modulePaths).map((modulePath) => [
      modulePath,
      require.cache[modulePath],
    ])
  );
  const ocrPaths = [];
  const databaseCalls = [];
  const uploadDirectories = [];
  const paymentRows = [];
  let storedInvoice;
  const originalMkdtempSync = fs.mkdtempSync;
  const uploadRoot = `${path.resolve(__dirname, "..", "uploads")}${path.sep}`;

  fs.mkdtempSync = function (...args) {
    const directory = originalMkdtempSync.apply(this, args);
    if (directory.startsWith(uploadRoot)) {
      uploadDirectories.push(directory);
    }
    return directory;
  };

  const restoreModules = () => {
    fs.mkdtempSync = originalMkdtempSync;

    for (const [modulePath, cachedModule] of previousModules) {
      if (cachedModule) {
        require.cache[modulePath] = cachedModule;
      } else {
        delete require.cache[modulePath];
      }
    }
  };

  try {
    delete require.cache[modulePaths.controller];
    delete require.cache[modulePaths.routes];
    delete require.cache[modulePaths.parser];
    delete require.cache[modulePaths.validator];

    replaceModule(modulePaths.db, {
      query: async (...args) => {
        databaseCalls.push(args);

        if (databaseError) {
          throw databaseError;
        }

        const [sql, values = []] = args;

        if (/INSERT INTO invoices/i.test(sql)) {
          storedInvoice = {
            id: 1,
            invoice_number: values[0],
            vendor_name: values[1],
            invoice_date: values[2],
            due_date: values[3],
            subtotal: values[4],
            tax: values[5],
            total_amount: values[6],
            po_number: values[7],
            ocr_text: values[8],
            status: values[9],
            amount_paid: values[10],
            details: JSON.parse(values[11]),
            validation_status: values[12],
          };
          return { rows: [storedInvoice] };
        }

        if (/SELECT\s+i\.\*/i.test(sql)) {
          return {
            rows: storedInvoice
              ? [{
                ...storedInvoice,
                paid_amount: Number(storedInvoice.amount_paid || 0) + paymentRows.reduce(
                  (sum, payment) => sum + Number(payment.amount || 0),
                  0
                ),
              }]
              : [],
          };
        }

        if (/SELECT total_amount, amount_paid FROM invoices/i.test(sql)) {
          return {
            rows: storedInvoice && Number(values[0]) === storedInvoice.id
              ? [{
                total_amount: storedInvoice.total_amount,
                amount_paid: storedInvoice.amount_paid,
              }]
              : [],
          };
        }

        if (/SELECT \* FROM invoices WHERE id/i.test(sql)) {
          return {
            rows: storedInvoice && Number(values[0]) === storedInvoice.id
              ? [storedInvoice]
              : [],
          };
        }

          if (/INSERT INTO payments/i.test(sql)) {
            paymentRows.push({
              id: paymentRows.length + 1,
              invoice_id: values[0],
              payment_reference: values[1],
              payment_date: values[2],
              amount: values[3],
              payment_method: values[4],
              status: "Completed",
            });
            return { rows: [] };
          }

          if (/SELECT COALESCE\(SUM\(amount\),0\) \+ \$2 AS paid/i.test(sql)) {
            const paymentAmount = paymentRows.reduce(
              (sum, payment) => sum + Number(payment.amount || 0),
              Number(values[1] || 0)
            );
            return { rows: [{ paid: paymentAmount }] };
          }

          if (/UPDATE invoices\s+SET status = \$1/i.test(sql)) {
            if (storedInvoice && Number(values[1]) === storedInvoice.id) {
              storedInvoice.status = values[0];
            }
            return { rows: [] };
          }

        if (/FROM payments/i.test(sql)) {
            return {
              rows: paymentRows.filter(
                (payment) => Number(payment.invoice_id) === Number(values[0])
              ),
            };
        }

        return { rows: [] };
      },
    });
    replaceModule(modulePaths.ocr, {
      performOCR: async (filePath) => {
        ocrPaths.push(filePath);
        if (ocrError) {
          throw ocrError;
        }
        return ocrText;
      },
    });

    if (validatorError) {
      replaceModule(modulePaths.validator, {
        validateInvoice: () => {
          throw validatorError;
        },
      });
    }

    const express = require("express");
    const invoiceRoutes = require(modulePaths.routes);
    const app = express();
    app.use(express.json());
    app.use("/api/invoices", invoiceRoutes);

    const server = http.createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    return {
      url: `http://127.0.0.1:${server.address().port}/api/invoices`,
      ocrPaths,
      databaseCalls,
      uploadDirectories,
      close: async () => {
        try {
          await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
          });
        } finally {
          restoreModules();
        }
      },
    };
  } catch (error) {
    restoreModules();
    throw error;
  }
};

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

const mimeFormats = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
  "image/tiff": "tiff",
  "image/gif": "gif",
};

const makeRaster = (format) => sharp({
  create: {
    width: 24,
    height: 24,
    channels: 3,
    background: { r: 255, g: 255, b: 255 },
  },
}).toFormat(format).toBuffer();

const makeUpload = async (
  type = "image/png",
  filename = "test-invoice.png",
  contents,
  fieldName = "invoice"
) => {
  const form = new FormData();
  const uploadContents = contents === undefined
    ? await makeRaster(mimeFormats[type] || "png")
    : contents;

  form.append(
    fieldName,
    new Blob([uploadContents], { type }),
    filename
  );
  return form;
};

const upload = (url, body) => withQuietConsole(async () => {
  const response = await fetch(`${url}/upload`, {
    method: "POST",
    body,
  });
  const responseBody = await response.text();

  return new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
});

const parseJson = (response) => response.json();

const saveJson = (url, body) => withQuietConsole(async () => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseBody = await response.text();

  return new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
});

const validSavePayload = () => ({
  invoiceNumber: "SAVE-2026-0001",
  invoiceType: "TAX INVOICE",
  vendorName: "Willow Labs Ltd",
  currency: "INR",
  vendorAddress: "2 Sample Avenue",
  vendorGSTIN: "29ABCDE1234F1Z5",
  vendorEmail: "billing@willow.example",
  vendorPhone: "9876543210",
  invoiceDate: "2026-10-18",
  dueDate: "2026-11-18",
  subtotal: 100,
  gstRate: 18,
  tax: 18,
  totalAmount: 118,
  amountPaid: 20,
  poNumber: "PO-2026-0001",
  paymentTerms: "Net 30",
  paymentReference: "REF-001",
  amountExtraction: {
    subtotal: true,
    gstAmount: true,
    totalAmount: true,
  },
  items: [{ description: "Consulting", quantity: 1, unitPrice: 100, amount: 100 }],
  ocrText: "Synthetic OCR fixture",
});

test("uploads through OCR, parser, and validator with the frontend response shape", async () => {
  const server = await startTestServer();

  try {
    const response = await upload(
      server.url,
      await makeUpload("image/png", "../../private-invoice.png")
    );
    const result = await parseJson(response);

    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(result).sort(), [
      "data",
      "message",
      "ocrText",
      "validation",
    ]);
    assert.equal(result.message, "OCR completed successfully");
    assert.equal(result.ocrText, sampleOcrText);
    assert.equal(result.data.invoiceNumber, "NS-2026-0042");
    assert.equal(result.data.vendor.name, "Northstar Software Ltd");
    assert.equal(result.data.amounts.totalAmount, 1180);
    assert.equal(result.validation.status, "Valid");
    assert.equal(server.ocrPaths.length, 1);
    assert.equal(server.ocrPaths[0].includes("private-invoice.png"), false);
    assert.equal(fs.existsSync(server.ocrPaths[0]), false);
    assert.equal(server.uploadDirectories.length, 1);
    assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
    assert.deepEqual(server.databaseCalls, []);
  } finally {
    await server.close();
  }
});

test("returns empty parsed data and validation errors for empty OCR text", async () => {
  const server = await startTestServer({ ocrText: "" });

  try {
    const response = await upload(server.url, await makeUpload());
    const result = await parseJson(response);

    assert.equal(response.status, 200);
    assert.equal(result.ocrText, "");
    assert.equal(result.data.invoiceNumber, "");
    assert.deepEqual(
      result.validation.errors.map((error) => error.field),
      ["invoiceNumber", "vendor.name"]
    );
    assert.equal(result.validation.status, "Invalid");
  } finally {
    await server.close();
  }
});

test("represents an impossible OCR date as null with a review warning", async () => {
  const server = await startTestServer({
    ocrText: `Northstar Software Ltd\nInvoice Number: NS-2026-0043\nInvoice Date: 31/02/2026\nDue Date: 20/03/2026`,
  });

  try {
    const response = await upload(server.url, await makeUpload());
    const result = await parseJson(response);

    assert.equal(response.status, 200);
    assert.equal(result.data.invoiceDate, null);
    assert.equal(result.validation.status, "Review Required");
    assert.ok(
      result.validation.warnings.some((warning) => warning.field === "invoiceDate")
    );
  } finally {
    await server.close();
  }
});

test("flags unreadable and non-finite OCR amounts for review instead of validating them", async () => {
  for (const value of ["not-an-amount", "NaN", "Infinity"]) {
    const ocrText = sampleOcrText
      .replace("Professional services 2 500.00 1000.00\n", "")
      .replace("Subtotal: 1,000.00", `Subtotal: ${value}`)
      .replace("GST (18%): 180.00", "GST (18%): unavailable")
      .replace("Total Amount: 1,180.00", "Total Amount: unknown");
    const server = await startTestServer({ ocrText });

    try {
      const response = await upload(server.url, await makeUpload());
      const result = await parseJson(response);

      assert.equal(response.status, 200);
      assert.equal(result.data.amounts.subtotal, 0);
      assert.equal(result.data.amounts.gstAmount, 0);
      assert.equal(result.data.amounts.totalAmount, 0);
      assert.equal(result.validation.status, "Review Required");
      assert.deepEqual(
        result.validation.warnings.map((warning) => warning.field),
        ["amounts.subtotal", "amounts.totalAmount", "amounts.gstAmount"]
      );
      assert.equal(server.uploadDirectories.length, 1);
      assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
    } finally {
      await server.close();
    }
  }
});

test("returns a JSON processing error and removes the upload when OCR fails", async () => {
  const server = await startTestServer({
    ocrError: new Error(
      "OCR_PRIVATE_SENTINEL C:\\private\\uploads\\invoice.png"
    ),
  });

  try {
    const response = await upload(server.url, await makeUpload());
    const result = await parseJson(response);

    assert.equal(response.status, 500);
    assert.equal(result.message, "Invoice processing failed");
    assert.equal(result.error, "The invoice could not be processed");
    assert.equal(JSON.stringify(result).includes("OCR_PRIVATE_SENTINEL"), false);
    assert.equal(JSON.stringify(result).includes("C:\\private"), false);
    assert.equal(JSON.stringify(result).includes("stack"), false);
    assert.equal(fs.existsSync(server.ocrPaths[0]), false);
    assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
  } finally {
    await server.close();
  }
});

test("returns a JSON processing error when OCR output makes the parser throw", async () => {
  const server = await startTestServer({ ocrText: null });

  try {
    const response = await upload(server.url, await makeUpload());
    const result = await parseJson(response);

    assert.equal(response.status, 500);
    assert.equal(result.message, "Invoice processing failed");
    assert.equal(typeof result.error, "string");
    assert.equal(fs.existsSync(server.ocrPaths[0]), false);
    assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
  } finally {
    await server.close();
  }
});

test("returns a JSON processing error when validation throws", async () => {
  const server = await startTestServer({
    validatorError: new Error("synthetic validation failure"),
  });

  try {
    const response = await upload(server.url, await makeUpload());
    const result = await parseJson(response);

    assert.equal(response.status, 500);
    assert.equal(result.message, "Invoice processing failed");
    assert.equal(result.error, "The invoice could not be processed");
    assert.equal(fs.existsSync(server.ocrPaths[0]), false);
    assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
  } finally {
    await server.close();
  }
});

test("returns a JSON client error when the upload has no invoice file", async () => {
  const server = await startTestServer();

  try {
    const response = await upload(server.url);
    const result = await parseJson(response);

    assert.equal(response.status, 400);
    assert.equal(result.message, "Invoice image is required");
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(server.ocrPaths, []);
    assert.equal(server.uploadDirectories.length, 1);
    assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
  } finally {
    await server.close();
  }
});

test("rejects unsupported MIME types before OCR is called", async () => {
  const server = await startTestServer();

  try {
    const response = await upload(server.url, await makeUpload("text/plain"));
    const result = await parseJson(response);

    assert.equal(response.status, 415);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(result, {
      message: "Only image files are allowed",
    });
    assert.deepEqual(server.ocrPaths, []);
    assert.equal(server.uploadDirectories.length, 1);
    assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
  } finally {
    await server.close();
  }
});

test("rejects malformed bytes labeled as image/png before OCR is called", async () => {
  const server = await startTestServer();

  try {
    const response = await upload(
      server.url,
      await makeUpload("image/png", "spoofed.png", Buffer.from("not a PNG image"))
    );
    const result = await parseJson(response);

    assert.equal(response.status, 400);
    assert.deepEqual(result, {
      message: "Invalid or malformed image file",
    });
    assert.deepEqual(server.ocrPaths, []);
    assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
  } finally {
    await server.close();
  }
});

test("accepts valid PNG, JPEG, WebP, TIFF, and GIF content", async () => {
  const server = await startTestServer();

  try {
    for (const mimeType of Object.keys(mimeFormats)) {
      const response = await upload(
        server.url,
        await makeUpload(mimeType)
      );
      const result = await parseJson(response);

      assert.equal(response.status, 200);
      assert.equal(result.message, "OCR completed successfully");
    }

    assert.equal(server.ocrPaths.length, Object.keys(mimeFormats).length);
    assert.equal(server.uploadDirectories.length, Object.keys(mimeFormats).length);
    for (const [index, filePath] of server.ocrPaths.entries()) {
      const directory = path.dirname(filePath);
      assert.ok(server.uploadDirectories.includes(directory));
      assert.equal(
        fs.existsSync(directory),
        false,
        `Temporary directory for ${Object.keys(mimeFormats)[index]} remains`
      );
    }
  } finally {
    await server.close();
  }
});

test("rejects supported image bytes whose MIME type declares another format", async () => {
  const server = await startTestServer();

  try {
    const png = await makeRaster("png");
    const response = await upload(
      server.url,
      await makeUpload("image/jpeg", "mismatched.jpg", png)
    );
    const result = await parseJson(response);

    assert.equal(response.status, 415);
    assert.deepEqual(result, {
      message: "Image content does not match the declared type",
    });
    assert.deepEqual(server.ocrPaths, []);
    assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
  } finally {
    await server.close();
  }
});

test("rejects SVG content labeled as PNG", async () => {
  const server = await startTestServer();

  try {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>'
    );
    const response = await upload(
      server.url,
      await makeUpload("image/png", "vector.png", svg)
    );
    const result = await parseJson(response);

    assert.equal(response.status, 415);
    assert.deepEqual(result, {
      message: "Image content does not match the declared type",
    });
    assert.deepEqual(server.ocrPaths, []);
    assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
  } finally {
    await server.close();
  }
});

test("rejects truncated raster data before OCR is called", async () => {
  const server = await startTestServer();

  try {
    const png = await makeRaster("png");
    const truncatedPng = png.subarray(0, Math.floor(png.length / 2));
    const response = await upload(
      server.url,
      await makeUpload("image/png", "truncated.png", truncatedPng)
    );
    const result = await parseJson(response);

    assert.equal(response.status, 400);
    assert.deepEqual(result, {
      message: "Invalid or malformed image file",
    });
    assert.deepEqual(server.ocrPaths, []);
    assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
  } finally {
    await server.close();
  }
});

test("returns a JSON 413 for an oversized file and leaves no upload behind", async () => {
  const server = await startTestServer();

  try {
    const response = await upload(
      server.url,
      await makeUpload(
        "image/png",
        "oversized.png",
        Buffer.alloc(10 * 1024 * 1024 + 1)
      )
    );
    const result = await parseJson(response);

    assert.equal(response.status, 413);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(result, {
      message: "Invoice image exceeds the 10 MB limit",
    });
    assert.deepEqual(server.ocrPaths, []);
    assert.equal(server.uploadDirectories.length, 1);
    assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
  } finally {
    await server.close();
  }
});

test("returns a JSON 400 for an unexpected multipart field", async () => {
  const server = await startTestServer();

  try {
    const response = await upload(
      server.url,
      await makeUpload("image/png", "wrong-field.png", Buffer.from("synthetic image"), "other")
    );
    const result = await parseJson(response);

    assert.equal(response.status, 400);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(result, {
      message: "Invalid invoice upload",
    });
    assert.deepEqual(server.ocrPaths, []);
    assert.equal(server.uploadDirectories.length, 1);
    assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
  } finally {
    await server.close();
  }
});

test("returns a safe JSON 500 for malformed multipart data", async () => {
  const server = await startTestServer();
  const boundary = "incomplete-invoice-boundary";

  try {
    const response = await withQuietConsole(async () => {
      const rawResponse = await fetch(`${server.url}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: `--${boundary}\r\nContent-Disposition: form-data; name="invoice"; filename="partial.png"\r\nContent-Type: image/png\r\n\r\npartial image data`,
      });
      const responseBody = await rawResponse.text();

      return new Response(responseBody, {
        status: rawResponse.status,
        statusText: rawResponse.statusText,
        headers: rawResponse.headers,
      });
    });
    const result = await parseJson(response);

    assert.equal(response.status, 500);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(result, {
      message: "Upload failed",
    });
    assert.deepEqual(server.ocrPaths, []);
    assert.equal(server.uploadDirectories.length, 1);
    assert.equal(fs.existsSync(server.uploadDirectories[0]), false);
  } finally {
    await server.close();
  }
});

test("revalidates a valid save request and persists all editable fields", async () => {
  const server = await startTestServer();

  try {
    const response = await saveJson(server.url, {
      ...validSavePayload(),
      validation: { status: "Invalid", isValid: false },
    });
    const result = await parseJson(response);

    assert.equal(response.status, 201);
    assert.equal(result.validation.status, "Valid");
    assert.equal(result.validation_status, "Valid");
    assert.equal(result.status, "Partial");
    assert.equal(result.amount_paid, 20);
    assert.deepEqual(result.details, {
      invoiceType: "TAX INVOICE",
      currency: "INR",
      vendorAddress: "2 Sample Avenue",
      vendorGSTIN: "29ABCDE1234F1Z5",
      vendorEmail: "billing@willow.example",
      vendorPhone: "9876543210",
      gstRate: 18,
      paymentTerms: "Net 30",
      paymentReference: "REF-001",
      amountExtraction: {
        subtotal: true,
        gstAmount: true,
        totalAmount: true,
      },
      items: [{ description: "Consulting", quantity: 1, unitPrice: 100, amount: 100 }],
    });

    const [insertSql] = server.databaseCalls[0];
    assert.match(insertSql, /amount_paid/);
    assert.match(insertSql, /details/);
    assert.match(insertSql, /validation_status/);

    const listResponse = await fetch(server.url);
    const invoices = await parseJson(listResponse);
    assert.equal(invoices[0].validation_status, "Valid");
    assert.equal(invoices[0].paid_amount, 20);

    const detailResponse = await fetch(`${server.url}/1`);
    const detail = await parseJson(detailResponse);
    assert.equal(detail.invoice.details.paymentReference, "REF-001");
    assert.deepEqual(detail.payments, []);
  } finally {
    await server.close();
  }
});

test("saves incomplete extracted amounts only with Review Required status", async () => {
  const server = await startTestServer();
  const payload = validSavePayload();
  payload.subtotal = 0;
  payload.gstRate = 0;
  payload.tax = 0;
  payload.totalAmount = 0;
  payload.amountExtraction = {
    subtotal: false,
    gstAmount: false,
    totalAmount: false,
  };

  try {
    const response = await saveJson(server.url, payload);
    const result = await parseJson(response);

    assert.equal(response.status, 201);
    assert.equal(result.validation.status, "Review Required");
    assert.equal(result.validation_status, "Review Required");
    assert.deepEqual(
      result.validation.warnings.map((warning) => warning.field),
      ["amounts.subtotal", "amounts.totalAmount"]
    );
  } finally {
    await server.close();
  }
});

test("includes the saved opening amount in list, detail, and later payment status", async () => {
  const server = await startTestServer();

  try {
    const createResponse = await saveJson(server.url, validSavePayload());
    const created = await parseJson(createResponse);
    assert.equal(created.amount_paid, 20);

    const paymentResponse = await saveJson(`${server.url}/1/payments`, {
      paymentReference: "PAY-002",
      paymentDate: "2026-10-18",
      amount: 98,
      paymentMethod: "Bank transfer",
    });
    const paymentResult = await parseJson(paymentResponse);

    assert.equal(paymentResult.status, "Paid");
    assert.equal(server.databaseCalls.some(([sql]) => /SET status = \$1/i.test(sql)), true);

    const listResponse = await fetch(server.url);
    const invoices = await parseJson(listResponse);
    assert.equal(invoices[0].paid_amount, 118);

    const detailResponse = await fetch(`${server.url}/1`);
    const detail = await parseJson(detailResponse);
    assert.equal(detail.invoice.amount_paid, 20);
    assert.equal(detail.payments.length, 1);
  } finally {
    await server.close();
  }
});

test("rejects impossible dates and malformed amounts even when client claims Valid", async () => {
  for (const payload of [
    { ...validSavePayload(), invoiceDate: "2026-02-31" },
    { ...validSavePayload(), subtotal: "not-an-amount" },
  ]) {
    const server = await startTestServer();

    try {
      const response = await saveJson(server.url, {
        ...payload,
        validation: { status: "Valid", isValid: true },
      });
      const result = await parseJson(response);

      assert.equal(response.status, 422);
      assert.equal(result.message, "Invoice data failed validation");
      assert.equal(result.validation.status, "Invalid");
      assert.deepEqual(server.databaseCalls, []);
    } finally {
      await server.close();
    }
  }
});

test("does not expose database error details in invoice-save responses", async () => {
  const server = await startTestServer({
    databaseError: Object.assign(
      new Error("private SQL text C:\\private\\db-path"),
      { code: "23505" }
    ),
  });

  try {
    const response = await withQuietConsole(() =>
      saveJson(server.url, validSavePayload())
    );
    const responseText = await response.text();

    assert.equal(response.status, 500);
    assert.equal(responseText, JSON.stringify({
      message: "Failed to create invoice",
    }));
    assert.equal(responseText.includes("private SQL"), false);
    assert.equal(responseText.includes("C:\\private"), false);
    assert.equal(responseText.includes("stack"), false);
  } finally {
    await server.close();
  }
});