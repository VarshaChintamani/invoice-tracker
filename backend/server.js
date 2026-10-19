require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const invoiceRoutes =
  require("./routes/invoiceRoutes");

const app = express();

app.use(cors());

app.use(
  express.json()
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(
  "/uploads",
  express.static(
    path.join(
      __dirname,
      "uploads"
    )
  )
);

// Health check
app.get(
  "/",
  (req, res) => {
    res.json({
      message:
        "Invoice OCR API is running",
    });
  }
);

// Invoice routes
app.use(
  "/api/invoices",
  invoiceRoutes
);

const PORT =
  process.env.PORT || 5000;

app.listen(
  PORT,
  () => {
    console.log(
      `Server running on http://localhost:${PORT}`
    );
  }
);