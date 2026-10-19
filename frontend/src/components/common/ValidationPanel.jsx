export default function ValidationPanel({ validation }) {
  if (!validation) return null;
  return (
    <section className="validation-panel">
      <div className="validation-heading"><div><span className="eyebrow">OCR CHECKS</span><h2>Validation status</h2></div><span className={`status-badge status-${String(validation.status || "unknown").toLowerCase().replace(/\s+/g, "-")}`}>{validation.status || "Unknown"}</span></div>
      {validation.errors?.length > 0 && <div className="validation-section"><h3>Errors</h3>{validation.errors.map((error, index) => <div className="validation-error" key={`${error.message}-${index}`}><strong>{error.message}</strong>{error.description && <p>Item: {error.description}</p>}{error.expected !== undefined && <p>Expected: ₹{error.expected}</p>}{error.extracted !== undefined && <p>Extracted: ₹{error.extracted}</p>}</div>)}</div>}
      {validation.warnings?.length > 0 && <div className="validation-section"><h3>Warnings</h3>{validation.warnings.map((warning, index) => <div className="validation-warning" key={`${warning.message}-${index}`}>{warning.message}</div>)}</div>}
      {!validation.errors?.length && !validation.warnings?.length && <p className="validation-clean">No validation issues were returned.</p>}
    </section>
  );
}
