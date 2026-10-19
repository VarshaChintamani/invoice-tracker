// const extractInvoiceData = (text) => {
//   const cleanText = text
//     .replace(/\r/g, "")
//     .replace(/\t/g, " ");

//   // --------------------------------
//   // INVOICE NUMBER
//   // --------------------------------

//   let invoiceNumber = "";

//   const invoiceNumberMatch = cleanText.match(
//     /(?:invoice\s*(?:no|number|#)?|invoios\s*(?:no|number|#)?|ivoios\s*(?:no|number|#)?)[\s:|#-]*([A-Z]{2,10}[-/][A-Z0-9-]+|[A-Z]{2,10}-\d+|\d{3,})/i
//   );

//   if (invoiceNumberMatch) {
//     invoiceNumber =
//       invoiceNumberMatch[1].trim();
//   }

//   // --------------------------------
//   // PO NUMBER
//   // --------------------------------

//   const poNumberMatch = cleanText.match(
//     /(?:PO|P\.O\.|Purchase Order)\s*(?:No|Number|#)?[\s:|#-]*([A-Z0-9-]+)/i
//   );

//   const poNumber =
//     poNumberMatch?.[1]?.trim() || "";

//   // --------------------------------
//   // VENDOR
//   // --------------------------------

//   const lines = cleanText
//     .split("\n")
//     .map((line) => line.trim())
//     .filter(Boolean);

//   let vendorName = "";

//   if (lines.length > 0) {
//     const firstLine = lines[0];

//     if (
//       !/invoice/i.test(firstLine) &&
//       !/tax invoice/i.test(firstLine) &&
//       !/gstin/i.test(firstLine)
//     ) {
//       vendorName = firstLine;
//     }
//   }

//   // --------------------------------
//   // VENDOR EMAIL
//   // --------------------------------

//   const emailMatch = cleanText.match(
//     /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
//   );

//   const email =
//     emailMatch?.[0]?.trim() || "";

//   // --------------------------------
//   // PHONE
//   // --------------------------------

//   const phoneMatch = cleanText.match(
//     /(?:\+91[\s-]?)?[6-9]\d{9}/
//   );

//   const phone = extractPhone(cleanText);
//     // phoneMatch?.[0]?.trim() || "";

//   // --------------------------------
//   // GSTIN
//   // --------------------------------

//   const gstinMatch = cleanText.match(
//     /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/i
//   );

//   const gstin = extractGSTIN(cleanText);
 
//   // --------------------------------
//   // INVOICE DATE
//   // --------------------------------

//   const invoiceDateMatch = cleanText.match(
//     /(?:invoice\s*date|invoios\s*date|ivoios\s*date|date)\s*[:|#-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
//   );

//   const invoiceDate =
//     convertDate(invoiceDateMatch?.[1]);

//   // --------------------------------
//   // DUE DATE
//   // --------------------------------

//   const dueDateMatch = cleanText.match(
//     /(?:due\s*date|due)\s*[:|#-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
//   );

//   const dueDate =
//     convertDate(dueDateMatch?.[1]);

//   // --------------------------------
//   // SUBTOTAL
//   // --------------------------------

//   const subtotalMatch = cleanText.match(
//     /(?:subtotal|sub\s*total)\s*[:|₹$]?\s*([\d,]+(?:\.\d{1,2})?)/i
//   );

//   const subtotal =
//     parseAmount(subtotalMatch?.[1]);

//   // --------------------------------
//   // GST RATE
//   // --------------------------------

//   const gstRateMatch = cleanText.match(
//     /GST\s*\((\d+(?:\.\d+)?)%\)/i
//   );

//   const gstRate =
//     parseFloat(gstRateMatch?.[1] || 0);

//   // --------------------------------
//   // GST AMOUNT
//   // --------------------------------

//   const gstMatch = cleanText.match(
//     /GST\s*(?:\(\d+(?:\.\d+)?%\))?\s*[:|₹$]?\s*([\d,]+(?:\.\d{1,2})?)/i
//   );

//   const gstAmount =
//     parseAmount(gstMatch?.[1]);

//   // --------------------------------
//   // TOTAL
//   // --------------------------------

//   const totalMatch = cleanText.match(
//     /(?:grand\s*total|total\s*amount|total)\s*[:|₹$]?\s*([\d,]+(?:\.\d{1,2})?)/i
//   );

//   const totalAmount =
//     parseAmount(totalMatch?.[1]);

//   // --------------------------------
//   // PAYMENT TERMS
//   // --------------------------------

//   const paymentTermsMatch =
//     cleanText.match(
//       /Payment\s*T(?:e|c)rms?\s*[:|]?\s*(.+)/i
//     );

//   const paymentTerms =
//     paymentTermsMatch?.[1]?.trim() || "";

//   // --------------------------------
//   // PAYMENT REFERENCE
//   // --------------------------------

//   const paymentReferenceMatch =
//     cleanText.match(
//       /Payment\s*Reference\s*:\s*(.+)/i
//     );

//   const paymentReference =
//     paymentReferenceMatch?.[1]?.trim() || "";

//   // --------------------------------
//   // INVOICE TYPE
//   // --------------------------------

//   const invoiceTypeMatch =
//     cleanText.match(
//       /\b(TAX\s+INVOICE|INVOICE|CREDIT\s+NOTE|DEBIT\s+NOTE)\b/i
//     );

//   const invoiceType =
//     invoiceTypeMatch?.[1]?.trim() ||
//     "INVOICE";

//   // --------------------------------
//   // CURRENCY
//   // --------------------------------

//   let currency = "INR";

//   if (
//     /USD|\$/i.test(cleanText)
//   ) {
//     currency = "USD";
//   }

//   if (
//     /EUR|€/i.test(cleanText)
//   ) {
//     currency = "EUR";
//   }

//   // --------------------------------
//   // BALANCE
//   // --------------------------------

//   const amountPaid = 0;

//   const balanceDue =
//     totalAmount - amountPaid;

//   // --------------------------------
//   // RETURN
//   // --------------------------------

//   return {
//     invoiceNumber,

//     invoiceType,

//     invoiceDate,

//     dueDate,

//     poNumber,

//     currency,

//     vendor: {
//       name: vendorName,
//       address: getVendorAddress(lines),
//       gstin,
//       pan: "",
//       email,
//       phone,
//     },

//     customer: {
//       name: "",
//       address: "",
//       gstin: "",
//       pan: "",
//       email: "",
//       phone: "",
//     },

//     payment: {
//       terms: paymentTerms,
//       reference: paymentReference,
//       method: "",
//     },

//     items: [],

//     amounts: {
//       subtotal,

//       gstRate,

//       gstAmount,

//       cgst: 0,

//       sgst: 0,

//       igst: 0,

//       totalTax: gstAmount,

//       totalAmount,

//       amountPaid,

//       balanceDue,
//     },

//     amountInWords: extractAmountInWords(
//       cleanText
//     ),
//   };
// };

// const extractPhone = (text) => {
//   const phoneMatch = text.match(
//     /(?:phone|mobile|contact|tel|telephone)\s*[:|]?\s*(\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})/i
//   );

//   if (!phoneMatch) {
//     return "";
//   }

//   return (
//     (phoneMatch[1] || "") +
//     phoneMatch[2]
//   ).replace(/\s+/g, "");
// };

// const extractGSTIN = (text) => {
//   const gstMatch = text.match(
//     /GSTIN\s*[:|]?\s*([0-9]{2}[A-Z0-9\s]{13,20})/i
//   );

//   if (!gstMatch) {
//     return "";
//   }

//   let gstin = gstMatch[1]
//     .split(/\n/)[0]
//     .trim()
//     .replace(/[^A-Z0-9]/gi, "")
//     .toUpperCase();

//   /*
//    * GSTIN should normally be 15 characters.
//    * Return it only if it looks like a GSTIN.
//    */

//   if (gstin.length === 15) {
//     return gstin;
//   }

//   return "";
// };
// // ====================================
// // AMOUNT PARSER
// // ====================================

// const parseAmount = (value) => {
//   if (!value) {
//     return 0;
//   }

//   return (
//     parseFloat(
//       value.replace(/,/g, "")
//     ) || 0
//   );
// };

// // ====================================
// // DATE CONVERTER
// // ====================================

// const convertDate = (value) => {
//   if (!value) {
//     return null;
//   }

//   const parts = value.split(
//     /[\/\-\.]/
//   );

//   if (parts.length !== 3) {
//     return null;
//   }

//   let [day, month, year] = parts;

//   if (year.length === 2) {
//     year = `20${year}`;
//   }

//   return `${year}-${month.padStart(
//     2,
//     "0"
//   )}-${day.padStart(2, "0")}`;
// };

// // ====================================
// // ADDRESS
// // ====================================

// const getVendorAddress = (lines) => {
//   if (lines.length < 2) {
//     return "";
//   }

//   const addressLine = lines[1];

//   if (
//     /GSTIN|TAX INVOICE|INVOICE/i.test(
//       addressLine
//     )
//   ) {
//     return "";
//   }

//   return addressLine;
// };

// // ====================================
// // AMOUNT IN WORDS
// // ====================================

// const extractAmountInWords = (text) => {
//   const match = text.match(
//     /Amount\s+in\s+Words\s*:\s*(.+)/i
//   );

//   return match?.[1]?.trim() || "";
// };

// module.exports = {
//   extractInvoiceData,
// };

const extractInvoiceData = (text) => {
  const cleanText = text
    .replace(/\r/g, "")
    .replace(/\t/g, " ");

  const lines = cleanText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // ====================================
  // INVOICE NUMBER
  // ====================================

  let invoiceNumber = "";

  const invoiceNumberMatch = cleanText.match(
    /(?:invoice\s*(?:no|number|#)?|invoios\s*(?:no|number|#)?|ivoios\s*(?:no|number|#)?)[\s:|#-]*([A-Z]{2,10}[-/][A-Z0-9-]+|[A-Z]{2,10}-\d+|\d{3,})/i
  );

  if (invoiceNumberMatch) {
    invoiceNumber = invoiceNumberMatch[1].trim();
  }

  // ====================================
  // PO NUMBER
  // ====================================

  const poNumberMatch = cleanText.match(
    /(?:PO|P\.O\.|Purchase Order)\s*(?:No|Number|#)?[\s:|#-]*([A-Z0-9-]+)/i
  );

  const poNumber =
    poNumberMatch?.[1]?.trim() || "";

  // ====================================
  // VENDOR
  // ====================================

  const vendorName = extractVendorName(lines);

  // ====================================
  // VENDOR ADDRESS
  // ====================================

  const vendorAddress = getVendorAddress(
    lines,
    vendorName
  );

  // ====================================
  // EMAIL
  // ====================================

  const emailMatch = cleanText.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  );

  const email =
    emailMatch?.[0]?.trim() || "";

  // ====================================
  // PHONE
  // ====================================

  const phone = extractPhone(cleanText);

  // ====================================
  // GSTIN
  // ====================================

  const gstin = extractGSTIN(cleanText);

  // ====================================
  // INVOICE DATE
  // ====================================

  const invoiceDateMatch = cleanText.match(
    /(?:invoice\s*date|invoios\s*date|ivoios\s*date)\s*[:|#-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
  );

  const invoiceDate = convertDate(
    invoiceDateMatch?.[1]
  );

  // ====================================
  // DUE DATE
  // ====================================

  const dueDateMatch = cleanText.match(
    /(?:due\s*date|due)\s*[:|#-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
  );

  const dueDate = convertDate(
    dueDateMatch?.[1]
  );

  // ====================================
  // SUBTOTAL
  // ====================================

  const subtotalMatch = cleanText.match(
    /(?:subtotal|sub\s*total)\s*[:|₹$]?\s*([\d,]+(?:\.\d{1,2})?)(?![\d.,A-Za-z])/i
  );

  const subtotal = parseAmount(
    subtotalMatch?.[1]
  );

  // ====================================
  // GST RATE
  // ====================================

  const gstRateMatch = cleanText.match(
    /GST\s*\((\d+(?:\.\d+)?)%\)/i
  );

  const gstRate = parseFloat(
    gstRateMatch?.[1] || 0
  );

  // ====================================
  // GST AMOUNT
  // ====================================

  const gstMatch = cleanText.match(
    /GST\s*(?:\(\d+(?:\.\d+)?%\))?\s*[:|₹$]?\s*([\d,]+(?:\.\d{1,2})?)(?![\d.,A-Za-z])/i
  );

  const gstAmount = parseAmount(
    gstMatch?.[1]
  );

  // ====================================
  // TOTAL
  // ====================================

  const totalMatch = cleanText.match(
    /(?:grand\s*total|total\s*amount|total)\s*[:|₹$]?\s*([A-Z]?[\d,]+(?:\.\d{1,2})?)(?![\d.,A-Za-z])/i
  );

  let totalAmount = parseAmount(
    totalMatch?.[1]
  );

  // ------------------------------------
  // Validate total
  // ------------------------------------
  //
  // OCR may read:
  //
  // H14,160.00
  //
  // instead of:
  //
  // 14,160.00
  //
  // If subtotal + GST gives a sensible total,
  // use the calculated value.
  //

  const calculatedTotal =
    subtotal + gstAmount;

  if (
    calculatedTotal > 0 &&
    (
      totalAmount === 0 ||
      Math.abs(
        totalAmount - calculatedTotal
      ) > 0.01
    )
  ) {
    totalAmount = calculatedTotal;
  }

  // ====================================
  // LINE ITEMS
  // ====================================

  const items = extractItems(lines);

  // ====================================
  // PAYMENT TERMS
  // ====================================

  const paymentTermsMatch =
    cleanText.match(
      /Payment\s*T(?:e|c)rms?\s*[:|]?\s*(.+)/i
    );

  const paymentTerms =
    paymentTermsMatch?.[1]?.trim() || "";

  // ====================================
  // PAYMENT REFERENCE
  // ====================================

  const paymentReferenceMatch =
    cleanText.match(
      /Payment\s*Reference\s*:\s*(.+)/i
    );

  const paymentReference =
    paymentReferenceMatch?.[1]?.trim() || "";

  // ====================================
  // INVOICE TYPE
  // ====================================

  const invoiceTypeMatch =
    cleanText.match(
      /\b(TAX\s+INVOICE|INVOICE|CREDIT\s+NOTE|DEBIT\s+NOTE)\b/i
    );

  const invoiceType =
    invoiceTypeMatch?.[1]?.trim() ||
    "INVOICE";

  // ====================================
  // CURRENCY
  // ====================================

  let currency = "INR";

  if (/USD|\$/i.test(cleanText)) {
    currency = "USD";
  }

  if (/EUR|€/i.test(cleanText)) {
    currency = "EUR";
  }

  // ====================================
  // PAYMENT
  // ====================================

  const amountPaid = 0;

  const balanceDue = Math.max(
    totalAmount - amountPaid,
    0
  );

  // ====================================
  // RETURN
  // ====================================

  return {
    invoiceNumber,

    invoiceType,

    invoiceDate,

    dueDate,

    poNumber,

    currency,

    vendor: {
      name: vendorName,
      address: vendorAddress,
      gstin,
      pan: "",
      email,
      phone,
    },

    customer: {
      name: "",
      address: "",
      gstin: "",
      pan: "",
      email: "",
      phone: "",
    },

    payment: {
      terms: paymentTerms,
      reference: paymentReference,
      method: "",
    },

    items,

    amounts: {
      subtotal,

      gstRate,

      gstAmount,

      cgst: 0,

      sgst: 0,

      igst: 0,

      totalTax: gstAmount,

      totalAmount,

      extraction: {
        subtotal: Boolean(subtotalMatch),
        gstAmount: Boolean(gstMatch),
        totalAmount: Boolean(totalMatch),
      },

      amountPaid,

      balanceDue,
    },

    amountInWords:
      extractAmountInWords(cleanText),
  };
};


// ====================================
// VENDOR NAME
// ====================================

const extractVendorName = (lines) => {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip obvious non-vendor lines
    if (
      /amount\s+in\s+words/i.test(line) ||
      /payment\s+reference/i.test(line) ||
      /thank\s+you/i.test(line) ||
      /invoice\s+number/i.test(line) ||
      /invoice\s+date/i.test(line) ||
      /po\s+number/i.test(line) ||
      /due\s+date/i.test(line) ||
      /vendor\s+email/i.test(line) ||
      /description/i.test(line) ||
      /subtotal/i.test(line) ||
      /gst\s*\(/i.test(line) ||
      /total\s+amount/i.test(line)
    ) {
      continue;
    }

    // GSTIN itself is not vendor name
    if (/^GSTIN/i.test(line)) {
      continue;
    }

    // Invoice headings are not vendor name
    if (/^(TAX\s+)?INVOICE$/i.test(line)) {
      continue;
    }

    // If this looks like an address, skip it
    if (
      /\d{2,}/.test(line) &&
      /(road|street|park|hyderabad|telangana|india|pvt|ltd)/i.test(
        line
      ) &&
      !/@/.test(line)
    ) {
      continue;
    }

    // The vendor name in this invoice is before the address
    // and contains company-like words.
    if (
      /(pvt|private|ltd|limited|technologies|solutions|services|company|corporation|enterprises|industries)/i.test(
        line
      )
    ) {
      return line;
    }
  }

  return "";
};


// ====================================
// ADDRESS
// ====================================

const getVendorAddress = (
  lines,
  vendorName
) => {
  if (!vendorName) {
    return "";
  }

  const vendorIndex =
    lines.findIndex(
      (line) => line === vendorName
    );

  if (vendorIndex === -1) {
    return "";
  }

  const addressLines = [];

  for (
    let i = vendorIndex + 1;
    i < lines.length;
    i++
  ) {
    const line = lines[i];

    if (
      /^GSTIN/i.test(line) ||
      /^TAX\s+INVOICE$/i.test(line) ||
      /^INVOICE$/i.test(line) ||
      /Invoice\s+Number/i.test(line)
    ) {
      break;
    }

    if (
      /invoice\s+date/i.test(line) ||
      /po\s+number/i.test(line) ||
      /due\s+date/i.test(line)
    ) {
      break;
    }

    addressLines.push(line);

    // Usually invoice address is only one/two lines
    if (addressLines.length >= 2) {
      break;
    }
  }

  return addressLines.join(", ");
};


// ====================================
// PHONE
// ====================================

const extractPhone = (text) => {
  const phoneMatch = text.match(
    /(?:phone|mobile|contact|tel|telephone)\s*[:|]?\s*(\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})/i
  );

  if (!phoneMatch) {
    return "";
  }

  return (
    (phoneMatch[1] || "") +
    phoneMatch[2]
  ).replace(/\s+/g, "");
};


// ====================================
// GSTIN
// ====================================

const extractGSTIN = (text) => {
  const gstMatch = text.match(
    /GSTIN\s*[:|]?\s*([0-9]{2}[A-Z0-9\s]{13,20})/i
  );

  if (!gstMatch) {
    return "";
  }

  const gstin = gstMatch[1]
    .split(/\n/)[0]
    .trim()
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();

  if (gstin.length === 15) {
    return gstin;
  }

  return "";
};


// ====================================
// LINE ITEMS
// ====================================

const extractItems = (lines) => {
  const items = [];

  const descriptionIndex =
    lines.findIndex((line) =>
      /description/i.test(line)
    );

  if (descriptionIndex === -1) {
    return items;
  }

  for (
    let i = descriptionIndex + 1;
    i < lines.length;
    i++
  ) {
    const line = lines[i];

    // Stop when financial summary starts
    if (
      /^(subtotal|sub\s*total|gst\s*\(|total\s+amount|grand\s+total)/i.test(
        line
      )
    ) {
      break;
    }

    // Ignore empty/non-item lines
    if (
      !/\d/.test(line)
    ) {
      continue;
    }

    /*
     * Expected OCR structure:
     *
     * Software Development Services
     * 2
     * 5,000.00
     * 10,000.00
     *
     * OCR may collapse them into one line,
     * so we extract the numeric values from
     * the end of the line.
     */

    const amountMatches =
      line.match(
        /[\d,]+(?:\.\d{1,2})?/g
      );

    if (
      !amountMatches ||
      amountMatches.length < 3
    ) {
      continue;
    }

    const numbers =
      amountMatches.map(parseAmount);

    const quantity =
      numbers[numbers.length - 3];

    const unitPrice =
      numbers[numbers.length - 2];

    const amount =
      numbers[numbers.length - 1];

    let description =
      line
        .replace(
          /[\d,]+(?:\.\d{1,2})?/g,
          " "
        )
        .replace(/\s+/g, " ")
        .trim();

    if (!description) {
      continue;
    }

    items.push({
      description,
      quantity,
      unitPrice,
      amount,
    });
  }

  return items;
};


// ====================================
// AMOUNT PARSER
// ====================================

const parseAmount = (value) => {
  if (!value) {
    return 0;
  }

  return (
    parseFloat(
      String(value)
        .replace(/,/g, "")
        .replace(/[^\d.-]/g, "")
    ) || 0
  );
};


// ====================================
// DATE CONVERTER
// ====================================

const convertDate = (value) => {
  if (!value) {
    return null;
  }

  const parts = value.split(
    /[\/\-\.]/
  );

  if (parts.length !== 3) {
    return null;
  }

  let [day, month, year] = parts;

  if (year.length === 2) {
    year = `20${year}`;
  }

  if (!isValidCalendarDate(year, month, day)) {
    return null;
  }

  return `${year}-${month.padStart(
    2,
    "0"
  )}-${day.padStart(
    2,
    "0"
  )}`;
};

const isValidCalendarDate = (year, month, day) => {
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);

  if (
    !Number.isInteger(yearNumber) ||
    yearNumber < 1 ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1
  ) {
    return false;
  }

  const daysInMonth = [
    31,
    isLeapYear(yearNumber) ? 29 : 28,
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

  return dayNumber <= daysInMonth[monthNumber - 1];
};

const isLeapYear = (year) =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);


// ====================================
// AMOUNT IN WORDS
// ====================================

const extractAmountInWords = (text) => {
  const match = text.match(
    /Amount\s+in\s+Words\s*:\s*(.+)/i
  );

  return (
    match?.[1]?.trim() || ""
  );
};


module.exports = {
  extractInvoiceData,
};