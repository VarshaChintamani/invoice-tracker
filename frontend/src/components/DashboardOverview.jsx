import SummaryCard from "./common/SummaryCard";
import InvoiceTable from "./invoices/InvoiceTable";
import { formatAmount } from "../utils/formatters";

export default function DashboardOverview({ stats, invoices, onView, onNavigate }) {
  return (
    <>
      <div className="welcome-strip"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>Keep every invoice in view.</h2><p>Extract invoice data, review key details, and stay on top of outstanding payments.</p></div><div className="welcome-illustration"><div className="illustration-paper"><span /><span /><span /><b>₹</b></div><div className="illustration-check">✓</div></div></div>
      <div className="summary-grid overview-summary">
        <SummaryCard label="Total invoices" value={stats.count.toLocaleString("en-IN")} caption="Saved records" icon="▤" tone="indigo" />
        <SummaryCard label="Invoice value" value={`₹${formatAmount(stats.total)}`} caption="Across all invoices" icon="₹" tone="blue" />
        <SummaryCard label="Amount paid" value={`₹${formatAmount(stats.paid)}`} caption="Recorded payments" icon="✓" tone="green" />
        <SummaryCard label="Outstanding" value={`₹${formatAmount(stats.outstanding)}`} caption={`${stats.pending} invoice${stats.pending === 1 ? "" : "s"} not marked paid`} icon="↗" tone="amber" />
      </div>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">LATEST RECORDS</span><h2>Recent invoices</h2><p>Your latest saved invoice records.</p></div><button className="btn btn-secondary" onClick={() => onNavigate("invoices")}>View all invoices <span>→</span></button></div><InvoiceTable invoices={invoices} onView={onView} compact /></section>
    </>
  );
}
