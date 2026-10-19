import FormField from "../common/FormField";

export default function InvoiceForm({ invoice, saving, onChange, onSave }) {
  const balance = Number(invoice.totalAmount || 0) - Number(invoice.amountPaid || 0);
  return (
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">STEP 02</span><h2>Review invoice details</h2><p>Check the extracted values and correct anything that needs attention.</p></div><span className="tag tag-green">{invoice.invoiceNumber ? "OCR data loaded" : "Manual entry supported"}</span></div>
      <div className="form-section"><h3><span>01</span>Basic information</h3><div className="form-grid">
        <FormField label="Invoice number *" name="invoiceNumber" value={invoice.invoiceNumber} onChange={onChange} placeholder="INV-1001" />
        <FormField label="Invoice type" name="invoiceType" value={invoice.invoiceType} onChange={onChange} placeholder="TAX INVOICE" />
        <FormField label="Invoice date" name="invoiceDate" type="date" value={invoice.invoiceDate} onChange={onChange} />
        <FormField label="Due date" name="dueDate" type="date" value={invoice.dueDate} onChange={onChange} />
        <FormField label="PO number" name="poNumber" value={invoice.poNumber} onChange={onChange} placeholder="PO-5001" />
        <FormField label="Currency" name="currency" value={invoice.currency} onChange={onChange} placeholder="INR" />
      </div></div>
      <div className="form-section"><h3><span>02</span>Vendor information</h3><div className="form-grid">
        <FormField label="Vendor name *" name="vendorName" value={invoice.vendorName} onChange={onChange} placeholder="Vendor name" />
        <FormField label="Vendor email" name="vendorEmail" type="email" value={invoice.vendorEmail} onChange={onChange} placeholder="vendor@example.com" />
        <FormField label="GSTIN" name="vendorGSTIN" value={invoice.vendorGSTIN} onChange={onChange} placeholder="GSTIN" />
        <FormField label="Phone" name="vendorPhone" value={invoice.vendorPhone} onChange={onChange} placeholder="Phone number" />
        <div className="form-group full-span"><label htmlFor="vendorAddress">Vendor address</label><textarea id="vendorAddress" name="vendorAddress" value={invoice.vendorAddress} onChange={onChange} placeholder="Vendor address" rows="3" /></div>
      </div></div>
      <div className="form-section"><h3><span>03</span>Invoice amount</h3><div className="form-grid">
        <FormField label="Subtotal (₹)" name="subtotal" type="number" value={invoice.subtotal} onChange={onChange} />
        <FormField label="GST rate (%)" name="gstRate" type="number" value={invoice.gstRate} onChange={onChange} />
        <FormField label="GST / tax amount (₹)" name="tax" type="number" value={invoice.tax} onChange={onChange} />
        <FormField label="Total amount (₹)" name="totalAmount" type="number" value={invoice.totalAmount} onChange={onChange} />
      </div></div>
      <div className="form-section"><h3><span>04</span>Payment information</h3><div className="form-grid">
        <FormField label="Payment terms" name="paymentTerms" value={invoice.paymentTerms} onChange={onChange} placeholder="Net 15 Days" />
        <FormField label="Payment reference" name="paymentReference" value={invoice.paymentReference} onChange={onChange} placeholder="Payment reference" />
        <FormField label="Amount paid (₹)" name="amountPaid" type="number" value={invoice.amountPaid} onChange={onChange} />
        <FormField label="Balance due (₹)" name="balanceDue" type="number" value={balance} onChange={() => {}} readOnly />
      </div></div>
      <div className="form-footer"><p><strong>*</strong> Required fields</p><button className="btn btn-primary btn-save" onClick={onSave} disabled={saving}>{saving ? <><span className="spinner" /> Saving…</> : "Save invoice"} <span>→</span></button></div>
    </section>
  );
}
