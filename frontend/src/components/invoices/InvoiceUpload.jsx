export default function InvoiceUpload({ file, loading, onFileChange, onUpload }) {
  return (
    <section className="panel upload-panel">
      <div className="panel-heading"><div><span className="eyebrow">STEP 01</span><h2>Upload invoice</h2><p>Choose an invoice image and extract its details with OCR.</p></div><div className="step-number">01</div></div>
      <div className="upload-area">
        <div className="upload-symbol">↑</div>
        <strong>Choose an invoice image</strong>
        <p>PNG, JPEG, WebP, TIFF or GIF</p>
        <label className="btn btn-secondary file-picker">Browse files<input type="file" accept="image/png,image/jpeg,image/webp,image/tiff,image/gif" onChange={(event) => onFileChange(event.target.files?.[0] || null)} /></label>
        {file && <div className="selected-file"><span className="file-chip">IMG</span><span>{file.name}</span><small>{file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : ""}</small></div>}
        <button className="btn btn-primary" onClick={onUpload} disabled={loading || !file}>{loading ? <><span className="spinner" /> Processing OCR…</> : "Extract invoice details →"}</button>
      </div>
    </section>
  );
}
