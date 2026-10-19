export default function StatusBadge({ status = "Pending" }) {
  const normalized = String(status).toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
  return <span className={`status-badge status-${normalized}`}>{status}</span>;
}
