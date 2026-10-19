const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const {
  uploadInvoice,
  createInvoice,
  getInvoices,
  getInvoice,
  addPayment,
} = require("../controllers/invoiceController");

const router = express.Router();
const uploadRoot = path.resolve(__dirname, "..", "uploads");
const supportedImageFormats = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
  "image/tiff": "tiff",
  "image/gif": "gif",
};

const removeUploadDirectory = (directory) => {
  if (!directory) {
    return;
  }

  try {
    fs.rmSync(directory, { recursive: true, force: true });
  } catch {
    console.error("Invoice upload cleanup failed.");
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, req.invoiceUploadDirectory);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (
    req,
    file,
    cb
  ) => {
    if (supportedImageFormats[file.mimetype]) {
      cb(null, true);
    } else {
      const error = new Error("Unsupported file type");
      error.code = "UNSUPPORTED_FILE_TYPE";
      cb(error);
    }
  },
});

const handleInvoiceUpload = (req, res, next) => {
  let uploadDirectory;

  try {
    fs.mkdirSync(uploadRoot, { recursive: true });
    uploadDirectory = fs.mkdtempSync(
      path.join(uploadRoot, "invoice-")
    );
    req.invoiceUploadDirectory = uploadDirectory;
  } catch {
    removeUploadDirectory(uploadDirectory);
    return res.status(500).json({
      message: "Upload failed",
    });
  }

  upload.single("invoice")(req, res, (error) => {
    if (!error) {
      return next();
    }

    removeUploadDirectory(uploadDirectory);

    if (error.code === "UNSUPPORTED_FILE_TYPE") {
      return res.status(415).json({
        message: "Only image files are allowed",
      });
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          message: "Invoice image exceeds the 10 MB limit",
        });
      }

      return res.status(400).json({
        message: "Invalid invoice upload",
      });
    }

    return res.status(500).json({
      message: "Upload failed",
    });
  });
};

const validateInvoiceImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const expectedFormat = supportedImageFormats[req.file.mimetype];

  try {
    const imageBuffer = await fs.promises.readFile(req.file.path);
    const metadata = await sharp(imageBuffer, {
      failOn: "warning",
    }).metadata();

    if (metadata.format !== expectedFormat) {
      removeUploadDirectory(req.invoiceUploadDirectory);
      return res.status(415).json({
        message: "Image content does not match the declared type",
      });
    }

    await sharp(imageBuffer, {
      failOn: "warning",
    })
      .rotate()
      .png()
      .toBuffer();

    return next();
  } catch {
    removeUploadDirectory(req.invoiceUploadDirectory);
    return res.status(400).json({
      message: "Invalid or malformed image file",
    });
  }
};

// Upload invoice + OCR
router.post(
  "/upload",
  handleInvoiceUpload,
  validateInvoiceImage,
  uploadInvoice
);

// Create invoice
router.post(
  "/",
  createInvoice
);

// Get all invoices
router.get(
  "/",
  getInvoices
);

// Get single invoice
router.get(
  "/:id",
  getInvoice
);

// Add payment
router.post(
  "/:id/payments",
  addPayment
);

module.exports = router;