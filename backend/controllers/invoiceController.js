const fs = require("fs");

const pool = require("../db");
const { performOCR } = require("../services/ocrService");
const {
  extractInvoiceData,
} = require("../services/invoiceParser");
const {
  validateInvoice,
} = require("../services/invoiceValidator");
// const uploadInvoice = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         message: "Invoice file is required",
//       });
//     }

//     console.log("Processing:", req.file.originalname);

//     const ocrText = await performOCR(req.file.path);

//     const extractedData = extractInvoiceData(ocrText);
// const validation =
//   validateInvoice(parsedData);
//     fs.unlink(req.file.path, () => {});

//     res.json({
//       message: "OCR completed successfully",
//       ocrText,
//       data: extractedData,
//       validation,
//     });
//   } catch (error) {
//     console.error(error);

//     res.status(500).json({
//       message: "OCR processing failed",
//       error: error.message,
//     });
//   }
// };

const uploadInvoice = async (req, res) => {
  let filePath = null;

  try {
    // ====================================
    // CHECK FILE
    // ====================================

    if (!req.file) {
      return res.status(400).json({
        message: "Invoice image is required",
      });
    }

    filePath = req.file.path;

    // ====================================
    // OCR
    // ====================================

    const ocrText =
      await performOCR(filePath);

    // ====================================
    // PARSE OCR DATA
    // ====================================

    const parsedData =
      extractInvoiceData(ocrText);

    // ====================================
    // VALIDATE INVOICE
    // ====================================

    const validation =
      validateInvoice(parsedData);

    // ====================================
    // RESPONSE
    // ====================================

    return res.status(200).json({
      message: "OCR completed successfully",

      ocrText,

      data: parsedData,

      validation,
    });

  } catch (error) {
    console.error("Invoice upload processing failed.");
    return res.status(500).json({
      message: "Invoice processing failed",
      error: "The invoice could not be processed",
    });
  } finally {
    if (req.invoiceUploadDirectory) {
      try {
        fs.rmSync(req.invoiceUploadDirectory, {
          recursive: true,
          force: true,
        });
      } catch {
        console.error("Invoice upload cleanup failed.");
      }
    } else if (filePath) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error("Invoice upload cleanup failed.");
        }
      }
    }
  }
};

const getPaymentStatus = (paidAmount, totalAmount) => {
  if (paidAmount > 0 && paidAmount >= totalAmount) {
    return "Paid";
  }

  if (paidAmount > 0) {
    return "Partial";
  }

  return "Pending";
};

const createInvoice = async (req, res) => {
  try {
    const {
      invoiceNumber,
      vendorName,
      invoiceDate,
      dueDate,
      subtotal,
      tax,
      totalAmount,
      poNumber,
      ocrText,
      invoiceType,
      currency,
      vendorAddress,
      vendorGSTIN,
      vendorEmail,
      vendorPhone,
      gstRate,
      amountPaid,
      paymentTerms,
      paymentReference,
      amountExtraction,
      items,
    } = req.body;

    const details = {
      invoiceType: invoiceType || "",
      currency: currency || "INR",
      vendorAddress: vendorAddress || "",
      vendorGSTIN: vendorGSTIN || "",
      vendorEmail: vendorEmail || "",
      vendorPhone: vendorPhone || "",
      gstRate: gstRate ?? 0,
      paymentTerms: paymentTerms || "",
      paymentReference: paymentReference || "",
      amountExtraction: {
        subtotal: amountExtraction?.subtotal === true,
        gstAmount: amountExtraction?.gstAmount === true,
        totalAmount: amountExtraction?.totalAmount === true,
      },
      items: Array.isArray(items) ? items : [],
    };
    const normalizedAmountPaid = amountPaid ?? 0;
    const validation = validateInvoice({
      invoiceNumber,
      invoiceDate,
      dueDate,
      vendor: {
        name: vendorName,
        email: details.vendorEmail,
        gstin: details.vendorGSTIN,
      },
      amounts: {
        subtotal,
        gstRate: details.gstRate,
        gstAmount: tax,
        totalAmount,
        amountPaid: normalizedAmountPaid,
        extraction: details.amountExtraction,
      },
      items: details.items,
    });

    if (!validation.isValid) {
      return res.status(422).json({
        message: "Invoice data failed validation",
        validation,
      });
    }

    const paymentStatus = getPaymentStatus(
      Number(normalizedAmountPaid),
      Number(totalAmount || 0)
    );

    const result = await pool.query(
      `
      INSERT INTO invoices
      (
        invoice_number,
        vendor_name,
        invoice_date,
        due_date,
        subtotal,
        tax,
        total_amount,
        po_number,
        ocr_text,
        status,
        amount_paid,
        details,
        validation_status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
      `,
      [
        invoiceNumber,
        vendorName,
        invoiceDate || null,
        dueDate || null,
        subtotal || 0,
        tax || 0,
        totalAmount || 0,
        poNumber,
        ocrText,
        paymentStatus,
        normalizedAmountPaid,
        JSON.stringify(details),
        validation.status,
      ]
    );

    res.status(201).json({
      ...result.rows[0],
      validation,
    });
  } catch (error) {
    console.error("Invoice save failed.", {
      code: error.code || "UNKNOWN", error,
    });

    res.status(500).json({
      message: "Failed to create invoice",
    });
  }
};

const getInvoices = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * 
      FROM invoices i
      ORDER BY i.created_at DESC`);

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch invoices",
    });
  }
};

const getInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await pool.query(
      `SELECT * FROM invoices WHERE id = $1`,
      [id]
    );

    if (invoice.rows.length === 0) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    const payments = await pool.query(
      `
      SELECT *
      FROM payments
      WHERE invoice_id = $1
      ORDER BY payment_date DESC
      `,
      [id]
    );

    res.json({
      invoice: invoice.rows[0],
      payments: payments.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch invoice",
    });
  }
};

const addPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      paymentReference,
      paymentDate,
      amount,
      paymentMethod,
    } = req.body;

    const invoiceResult = await pool.query(
      `SELECT total_amount, amount_paid FROM invoices WHERE id = $1`,
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    await pool.query(
      `
      INSERT INTO payments
      (
        invoice_id,
        payment_reference,
        payment_date,
        amount,
        payment_method
      )
      VALUES ($1,$2,$3,$4,$5)
      `,
      [
        id,
        paymentReference,
        paymentDate,
        amount,
        paymentMethod,
      ]
    );

    const paymentTotal = await pool.query(
      `
      SELECT COALESCE(SUM(amount),0) + $2 AS paid
      FROM payments
      WHERE invoice_id = $1
      `,
      [id, Number(invoiceResult.rows[0].amount_paid || 0)]
    );

    const totalAmount =
      parseFloat(invoiceResult.rows[0].total_amount);

    const paidAmount =
      parseFloat(paymentTotal.rows[0].paid);

    let status = "Pending";

    if (paidAmount >= totalAmount) {
      status = "Paid";
    } else if (paidAmount > 0) {
      status = "Partial";
    }

    await pool.query(
      `
      UPDATE invoices
      SET status = $1
      WHERE id = $2
      `,
      [status, id]
    );

    res.json({
      message: "Payment added successfully",
      status,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to add payment",
    });
  }
};

module.exports = {
  uploadInvoice,
  createInvoice,
  getInvoices,
  getInvoice,
  addPayment,
};