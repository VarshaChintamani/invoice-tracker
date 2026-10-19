import StatusBadge from "../common/StatusBadge";
import { formatAmount, formatDate } from "../../utils/formatters";

export default function InvoiceTable({ invoices = [], onView, compact = false }) {
  if (!invoices.length) return <div className="empty-state"><div className="empty-icon">▤</div><strong>No invoices yet</strong><p>Upload and save an invoice to see it listed here.</p></div>;
  return (
    <div className="table-container"><table><thead><tr><th>Invoice</th><th>Vendor</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th /></tr></thead>
      <tbody>{invoices.slice(0, compact ? 5 : undefined).map((invoice) => {
        const total = Number(invoice.total_amount || 0);
        const paid = Number(invoice.paid_amount || 0);
        const balance = total - paid;
        const status = invoice.status || "Pending";
        return <tr key={invoice.id}>
          <td><strong className="invoice-number">{invoice.invoice_number || "-"}</strong><small className="table-subtext">INV record</small></td>
          <td>{invoice.vendor_name || "-"}</td><td>{formatDate(invoice.invoice_date)}</td>
          <td className="amount-cell">₹{formatAmount(total)}</td><td>₹{formatAmount(paid)}</td><td>₹{formatAmount(balance)}</td>
          <td><StatusBadge status={status} /></td><td><button className="table-action" onClick={() => onView(invoice.id)}>View <span>↗</span></button></td>
        </tr>;
      })}</tbody>
    </table></div>
  );
}
