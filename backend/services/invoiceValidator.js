// ====================================
// INVOICE VALIDATOR
// ====================================

const validateInvoice = (invoice) => {
  const errors = [];
  const warnings = [];

  // ====================================
  // REQUIRED FIELD VALIDATION
  // ====================================

  if (!invoice.invoiceNumber) {
    errors.push({
      field: "invoiceNumber",
      message: "Invoice number is missing",
    });
  }

  if (!invoice.vendor?.name) {
    errors.push({
      field: "vendor.name",
      message: "Vendor name is missing",
    });
  }

  if (!invoice.invoiceDate) {
    warnings.push({
      field: "invoiceDate",
      message: "Invoice date is missing",
    });
  }

  if (!invoice.dueDate) {
    warnings.push({
      field: "dueDate",
      message: "Due date is missing",
    });
  }

  // ====================================
  // DATE VALIDATION
  // ====================================

  if (invoice.invoiceDate) {
    if (!isValidDate(invoice.invoiceDate)) {
      errors.push({
        field: "invoiceDate",
        message: "Invalid invoice date",
      });
    }
  }

  if (invoice.dueDate) {
    if (!isValidDate(invoice.dueDate)) {
      errors.push({
        field: "dueDate",
        message: "Invalid due date",
      });
    }
  }

  // Due date should not be before invoice date
  if (
    invoice.invoiceDate &&
    invoice.dueDate &&
    isValidDate(invoice.invoiceDate) &&
    isValidDate(invoice.dueDate)
  ) {
    const invoiceDate = new Date(
      invoice.invoiceDate
    );

    const dueDate = new Date(
      invoice.dueDate
    );

    if (dueDate < invoiceDate) {
      errors.push({
        field: "dueDate",
        message:
          "Due date cannot be before invoice date",
      });
    }
  }

  // ====================================
  // EMAIL VALIDATION
  // ====================================

  if (invoice.vendor?.email) {
    if (!isValidEmail(invoice.vendor.email)) {
      warnings.push({
        field: "vendor.email",
        message: "Invalid vendor email format",
      });
    }
  }

  // ====================================
  // GSTIN VALIDATION
  // ====================================

  if (invoice.vendor?.gstin) {
    if (!isValidGSTIN(invoice.vendor.gstin)) {
      warnings.push({
        field: "vendor.gstin",
        message: "Invalid GSTIN format",
        value: invoice.vendor.gstin,
      });
    }
  }

  // ====================================
  // AMOUNT VALIDATION
  // ====================================

  const amounts = invoice.amounts || {};
  const subtotal = readAmount(amounts.subtotal);
  const gstRate = readAmount(amounts.gstRate);
  const gstAmount = readAmount(amounts.gstAmount);
  const totalAmount = readAmount(amounts.totalAmount);
  const amountPaid = readAmount(amounts.amountPaid);

  for (const [field, value] of Object.entries({
    subtotal,
    gstRate,
    gstAmount,
    totalAmount,
    amountPaid,
  })) {
    if (!Number.isFinite(value)) {
      errors.push({
        field: `amounts.${field}`,
        message: "Must be a finite numeric amount",
      });
    }
  }

  const extraction = amounts.extraction;
  const amountsToReview = ["subtotal", "totalAmount"];

  if (gstRate > 0) {
    amountsToReview.push("gstAmount");
  }

  if (extraction) {
    for (const field of amountsToReview) {
      if (extraction[field] === false) {
        warnings.push({
          field: `amounts.${field}`,
          message: "Amount could not be extracted; review required",
        });
      }
    }
  }

  // ====================================
  // GST CALCULATION
  // ====================================

  if (
    subtotal > 0 &&
    gstRate > 0 &&
    gstAmount > 0
  ) {
    const expectedGST =
      roundAmount(
        subtotal * (gstRate / 100)
      );

    const gstDifference =
      Math.abs(
        expectedGST - gstAmount
      );

    if (gstDifference > 0.01) {
      errors.push({
        field: "amounts.gstAmount",
        message:
          "GST amount does not match GST rate and subtotal",
        expected: expectedGST,
        extracted: gstAmount,
      });
    }
  }

  // ====================================
  // TOTAL CALCULATION
  // ====================================

  if (
    subtotal > 0 &&
    gstAmount >= 0 &&
    totalAmount > 0
  ) {
    const expectedTotal =
      roundAmount(
        subtotal + gstAmount
      );

    const totalDifference =
      Math.abs(
        expectedTotal - totalAmount
      );

    if (totalDifference > 0.01) {
      errors.push({
        field: "amounts.totalAmount",
        message:
          "Total amount does not match subtotal + tax",
        expected: expectedTotal,
        extracted: totalAmount,
      });
    }
  }

  // ====================================
  // LINE ITEM VALIDATION
  // ====================================

  const items = invoice.items || [];

  items.forEach((item, index) => {
    const quantity = readAmount(item.quantity);
    const unitPrice = readAmount(item.unitPrice);
    const amount = readAmount(item.amount);

    const invalidNumericField = [
      ["quantity", quantity],
      ["unitPrice", unitPrice],
      ["amount", amount],
    ].find(([, value]) => !Number.isFinite(value));

    if (invalidNumericField) {
      errors.push({
        field: `items[${index}].${invalidNumericField[0]}`,
        message: "Must be a finite numeric value",
        description: item.description || "",
      });

      return;
    }

    if (
      quantity <= 0 ||
      unitPrice < 0 ||
      amount < 0
    ) {
      warnings.push({
        field: `items[${index}]`,
        message:
          "Line item contains invalid numeric values",
      });

      return;
    }

    const expectedAmount =
      roundAmount(
        quantity * unitPrice
      );

    const difference =
      Math.abs(
        expectedAmount - amount
      );

    if (difference > 0.01) {
      errors.push({
        field: `items[${index}].amount`,
        message:
          "Quantity × Unit Price does not match Amount",
        description:
          item.description || "",
        expected: expectedAmount,
        extracted: amount,
      });
    }
  });

  // ====================================
  // ITEMS → SUBTOTAL
  // ====================================

  if (items.length > 0 && subtotal > 0) {
    const calculatedSubtotal =
      roundAmount(
        items.reduce(
          (sum, item) =>
            sum + Number(item.amount || 0),
          0
        )
      );

    const subtotalDifference =
      Math.abs(
        calculatedSubtotal - subtotal
      );

    if (subtotalDifference > 0.01) {
      errors.push({
        field: "amounts.subtotal",
        message:
          "Subtotal does not match the sum of line items",
        expected: calculatedSubtotal,
        extracted: subtotal,
      });
    }
  }

  // ====================================
  // FINAL STATUS
  // ====================================

  const isValid =
    errors.length === 0;

  const requiresReview =
    errors.length > 0 ||
    warnings.length > 0;

  let status = "Valid";

  if (errors.length > 0) {
    status = "Invalid";
  } else if (warnings.length > 0) {
    status = "Review Required";
  }

  return {
    isValid,
    requiresReview,
    status,
    errors,
    warnings,
    summary: {
      errorCount: errors.length,
      warningCount: warnings.length,
    },
  };
};


// ====================================
// DATE
// ====================================

const isValidDate = (value) => {
  if (!value) {
    return false;
  }

  if (typeof value === "string") {
    const dateValue = value.trim();

    if (!dateValue) {
      return false;
    }

    const numericDateMatch = dateValue.match(
      /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})(?=$|[ Tt].*)/
    );

    if (numericDateMatch) {
      const [, first, second, third] = numericDateMatch;
      let year;
      let month;
      let day;

      if (first.length === 4) {
        year = Number(first);
        month = Number(second);
        day = Number(third);
      } else {
        const firstNumber = Number(first);
        const secondNumber = Number(second);
        const thirdNumber = Number(third);

        if (firstNumber > 12) {
          day = firstNumber;
          month = secondNumber;
        } else {
          month = firstNumber;
          day = secondNumber;
        }

        year = normalizeTwoDigitYear(thirdNumber, third.length);
      }

      if (!isValidCalendarDate(year, month, day)) {
        return false;
      }
    } else {
      const namedDateMatch = dateValue.match(
        /^(?:(\w+)\s+(\d{1,2}),?\s+(\d{4})|(\d{1,2})\s+(\w+)\s+(\d{4}))(?:$|[ ,Tt].*)/
      );

      if (namedDateMatch) {
        const monthName = namedDateMatch[1] || namedDateMatch[5];
        const day = Number(namedDateMatch[2] || namedDateMatch[4]);
        const year = Number(namedDateMatch[3] || namedDateMatch[6]);
        const month = monthNumber(monthName);

        if (!month || !isValidCalendarDate(year, month, day)) {
          return false;
        }
      }
    }
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime());
};

const isValidCalendarDate = (year, month, day) => {
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return false;
  }

  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
};

const isLeapYear = (year) =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const normalizeTwoDigitYear = (year, length) => {
  if (length !== 2) {
    return year;
  }

  return year < 50 ? 2000 + year : 1900 + year;
};

const monthNumber = (monthName) => {
  const monthNames = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ];

  return monthNames.indexOf(monthName.slice(0, 3).toLowerCase()) + 1;
};

const readAmount = (value) => {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return Number.NaN;
  }

  const normalizedValue = value.trim();
  const numericPattern = /^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

  if (!numericPattern.test(normalizedValue)) {
    return Number.NaN;
  }

  return Number(normalizedValue.replace(/,/g, ""));
};


// ====================================
// EMAIL
// ====================================

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
};


// ====================================
// GSTIN
// ====================================

const isValidGSTIN = (gstin) => {
  if (!gstin) {
    return false;
  }

  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/i.test(
    gstin
  );
};


// ====================================
// ROUND AMOUNT
// ====================================

const roundAmount = (value) => {
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
};


// ====================================
// EXPORT
// ====================================

module.exports = {
  validateInvoice,
};