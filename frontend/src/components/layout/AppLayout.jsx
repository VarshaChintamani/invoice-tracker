import Sidebar from "./Sidebar";

export default function AppLayout({ activePage, onNavigate, onNewInvoice, children }) {
  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={onNavigate} onNewInvoice={onNewInvoice} />
      <main className="main-content">
        <div className="main-inner">{children}</div>
        <footer className="app-footer">Invoice OCR &amp; Payment Tracker <span>·</span> Workspace</footer>
      </main>
    </div>
  );
}
