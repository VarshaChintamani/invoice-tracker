export default function SummaryCard({ label, value, caption, icon, tone = "indigo" }) {
  return (
    <article className="summary-card">
      <div className={`summary-icon tone-${tone}`}>{icon}</div>
      <div className="summary-copy"><span>{label}</span><strong>{value}</strong>{caption && <small>{caption}</small>}</div>
    </article>
  );
}
