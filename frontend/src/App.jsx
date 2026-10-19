import { useEffect, useMemo, useState } from "react";
import "./App.css";
import AppLayout from "./components/layout/AppLayout";
import PageHeader from "./components/layout/PageHeader";
import DashboardOverview from "./components/DashboardOverview";
import InvoiceUpload from "./components/invoices/InvoiceUpload";
import InvoiceForm from "./components/invoices/InvoiceForm";
import InvoiceTable from "./components/invoices/InvoiceTable";
import InvoiceDetailsModal from "./components/invoices/InvoiceDetailsModal";
import ValidationPanel from "./components/common/ValidationPanel";

const API_URL = "http://localhost:5000/api";

const emptyInvoice = {
  invoiceNumber: "", invoiceType: "", invoiceDate: "", dueDate: "", poNumber: "",
  currency: "INR", vendorName: "", vendorAddress: "", vendorGSTIN: "",
  vendorEmail: "", vendorPhone: "", subtotal: 0, gstRate: 0, tax: 0,
  totalAmount: 0, amountPaid: 0, balanceDue: 0, paymentTerms: "",
  paymentReference: "",
  amountExtraction: { subtotal: false, gstAmount: false, totalAmount: false },
  items: [], ocrText: "",
};

function App() {
  const [activePage, setActivePage] = useState("overview");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState({ ...emptyInvoice, amountExtraction: { ...emptyInvoice.amountExtraction } });
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [validation, setValidation] = useState(null);
  const [notice, setNotice] = useState("");

  const loadInvoices = async () => {
    try {
      const response = await fetch(`${API_URL}/invoices`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load invoices");
      setInvoices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setNotice(error.message || "Failed to load invoices.");
    }
  };

  useEffect(() => { loadInvoices(); }, []);

  const stats = useMemo(() => {
    const total = invoices.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const paid = invoices.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
    const pending = invoices.filter((row) => {
      const status = String(row.status || "").toLowerCase();
      return status !== "paid";
    }).length;
    return { count: invoices.length, total, paid, outstanding: total - paid, pending };
  }, [invoices]);

  const handleFileChange = (selectedFile) => {
    setFile(selectedFile);
    setNotice("");
  };

  const uploadInvoice = async () => {
    if (!file) {
      setNotice("Please select an invoice image.");
      return;
    }
    const formData = new FormData();
    formData.append("invoice", file);
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/invoices/upload`, { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "OCR processing failed");
      const data = result.data || {};
      setInvoice({
        invoiceNumber: data.invoiceNumber || "",
        invoiceType: data.invoiceType || "",
        invoiceDate: data.invoiceDate || "",
        dueDate: data.dueDate || "",
        poNumber: data.poNumber || "",
        currency: data.currency || "INR",
        vendorName: data.vendor?.name || "",
        vendorAddress: data.vendor?.address || "",
        vendorGSTIN: data.vendor?.gstin || "",
        vendorEmail: data.vendor?.email || "",
        vendorPhone: data.vendor?.phone || "",
        subtotal: Number(data.amounts?.subtotal || 0),
        gstRate: Number(data.amounts?.gstRate || 0),
        tax: Number(data.amounts?.totalTax || data.amounts?.gstAmount || 0),
        totalAmount: Number(data.amounts?.totalAmount || 0),
        amountPaid: Number(data.amounts?.amountPaid || 0),
        balanceDue: Number(data.amounts?.balanceDue || 0),
        paymentTerms: data.payment?.terms || "",
        paymentReference: data.payment?.reference || "",
        amountExtraction: data.amounts?.extraction || { subtotal: false, gstAmount: false, totalAmount: false },
        items: data.items || [],
        ocrText: result.ocrText || "",
      });
      setValidation(result.validation || null);
      setActivePage("new");
      setNotice(
        result.validation?.status === "Invalid"
          ? "OCR completed, but invoice data needs correction."
          : result.validation?.status === "Review Required"
            ? "OCR completed; review the extracted fields."
            : "OCR completed successfully."
      );
    } catch (error) {
      console.error(error);
      setNotice(error.message || "Something went wrong while processing the invoice.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    const extractionField = { subtotal: "subtotal", tax: "gstAmount", totalAmount: "totalAmount" }[name];
    setInvoice((previous) => {
      const next = { ...previous, [name]: value };
      if (extractionField) {
        next.amountExtraction = { ...previous.amountExtraction, [extractionField]: value.trim() !== "" };
      }
      return next;
    });
  };

  const saveInvoice = async () => {
    if (!invoice.invoiceNumber) { setNotice("Invoice number is required."); return; }
    if (!invoice.vendorName) { setNotice("Vendor name is required."); return; }
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          invoiceType: invoice.invoiceType,
          vendorName: invoice.vendorName,
          currency: invoice.currency,
          vendorAddress: invoice.vendorAddress,
          vendorGSTIN: invoice.vendorGSTIN,
          vendorEmail: invoice.vendorEmail,
          vendorPhone: invoice.vendorPhone,
          invoiceDate: invoice.invoiceDate || null,
          dueDate: invoice.dueDate || null,
          subtotal: Number(invoice.subtotal || 0),
          tax: Number(invoice.tax || 0),
          gstRate: Number(invoice.gstRate || 0),
          totalAmount: Number(invoice.totalAmount || 0),
          amountPaid: Number(invoice.amountPaid || 0),
          poNumber: invoice.poNumber,
          paymentTerms: invoice.paymentTerms,
          paymentReference: invoice.paymentReference,
          amountExtraction: invoice.amountExtraction,
          items: invoice.items,
          ocrText: invoice.ocrText,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.validation) setValidation(result.validation);
        throw new Error(result.message || "Failed to save invoice");
      }
      if (result.validation) setValidation(result.validation);
      setNotice(result.validation?.status === "Review Required" ? "Invoice saved for review." : "Invoice saved successfully.");
      await loadInvoices();
      setInvoice({ ...emptyInvoice, amountExtraction: { ...emptyInvoice.amountExtraction } });
      setFile(null);
      setActivePage("invoices");
    } catch (error) {
      console.error(error);
      setNotice(error.message || "Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  };

  const viewInvoice = async (id) => {
    try {
      const response = await fetch(`${API_URL}/invoices/${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load invoice");
      setSelectedInvoice(data);
    } catch (error) {
      console.error(error);
      setNotice(error.message || "Failed to load invoice.");
    }
  };

  const startNewInvoice = () => {
    setActivePage("new");
    setNotice("");
  };

  return (
    <AppLayout activePage={activePage} onNavigate={setActivePage} onNewInvoice={startNewInvoice}>
      <PageHeader
        title={activePage === "overview" ? "Overview" : activePage === "new" ? "New invoice" : "All invoices"}
        subtitle={activePage === "overview"
          ? "A clear view of your invoices and payment status."
          : activePage === "new"
            ? "Upload an invoice, review the extracted details, and save it."
            : "Search and review invoices saved in your workspace."}
        action={activePage !== "new" ? { label: "New invoice", onClick: startNewInvoice } : null}
      />
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}
      {activePage === "overview" && (
        <DashboardOverview stats={stats} invoices={invoices} onView={viewInvoice} onNavigate={setActivePage} />
      )}
      {activePage === "new" && (
        <>
          <InvoiceUpload file={file} loading={loading} onFileChange={handleFileChange} onUpload={uploadInvoice} />
          {validation && <ValidationPanel validation={validation} />}
          <InvoiceForm invoice={invoice} saving={saving} onChange={handleChange} onSave={saveInvoice} />
          {invoice.ocrText && (
            <section className="panel">
              <div className="panel-heading">
                <div><span className="eyebrow">SOURCE TEXT</span><h2>Raw OCR text</h2></div>
                <span className="tag">Tesseract OCR</span>
              </div>
              <textarea className="ocr-text" value={invoice.ocrText} readOnly rows="12" />
            </section>
          )}
        </>
      )}
      {activePage === "invoices" && <section className="panel"><div className="panel-heading"><div><span className="eyebrow">RECORDS</span><h2>Invoices</h2></div><button className="btn btn-secondary" onClick={loadInvoices}>Refresh</button></div><InvoiceTable invoices={invoices} onView={viewInvoice} /></section>}
      {selectedInvoice && <InvoiceDetailsModal data={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
    </AppLayout>
  );
}

export default App;
