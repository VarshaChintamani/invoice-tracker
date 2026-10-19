import StatusBadge from "../common/StatusBadge";
import SummaryCard from "../common/SummaryCard";
import { formatAmount, formatDate } from "../../utils/formatters";

export default function InvoiceDetailsModal({ data, onClose }) {
  const invoice = data?.invoice;
  if (!invoice) return null;
  const payments = data.payments || [];
  const total = Number(invoice.total_amount || 0);
  const paid = Number(invoice.amount_paid || 0) + payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const balance = total - paid;
  const fields = [
    ["Invoice number", invoice.invoice_number], ["Vendor", invoice.vendor_name],
    ["Invoice date", formatDate(invoice.invoice_date)], ["Due date", formatDate(invoice.due_date)],
    ["PO number", invoice.po_number], ["Subtotal", `₹${formatAmount(invoice.subtotal)}`],
    ["Tax", `₹${formatAmount(invoice.tax)}`], ["Total", `₹${formatAmount(invoice.total_amount)}`],
  ];
  return (
    <div className="modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title">
        <div className="modal-header"><div><span className="eyebrow">INVOICE RECORD</span><h2 id="invoice-modal-title">Invoice details</h2><p>{invoice.invoice_number}</p></div><button className="close-btn" onClick={onClose} aria-label="Close details">×</button></div>
        <div className="detail-status-row"><span>Current status</span><StatusBadge status={invoice.status || "Pending"} /></div>
        <div className="summary-grid">
          <SummaryCard label="Total amount" value={`₹${formatAmount(total)}`} icon="₹" tone="indigo" />
          <SummaryCard label="Total paid" value={`₹${formatAmount(paid)}`} icon="✓" tone="green" />
          <SummaryCard label="Balance due" value={`₹${formatAmount(balance)}`} icon="↗" tone="amber" />
        </div>
        <h3 className="modal-section-title">Invoice information</h3>
        <div className="detail-grid">{fields.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || "-"}</strong></div>)}</div>
        <h3 className="modal-section-title">Payment history <span className="count-pill">{payments.length}</span></h3>
        {!payments.length ? <div className="empty-state compact-empty">No payments recorded for this invoice.</div> : <div className="table-container"><table><thead><tr><th>Reference</th><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.payment_reference || "-"}</td><td>{formatDate(payment.payment_date)}</td><td className="amount-cell">₹{formatAmount(payment.amount)}</td><td>{payment.payment_method || "-"}</td><td>{payment.status || "Completed"}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
