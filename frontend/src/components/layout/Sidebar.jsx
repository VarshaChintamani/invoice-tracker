const navItems = [
  { id: "overview", label: "Overview", icon: "◫" },
  { id: "new", label: "New invoice", icon: "+" },
  { id: "invoices", label: "All invoices", icon: "▤" },
];

export default function Sidebar({ activePage, onNavigate, onNewInvoice }) {
  const handleNavigate = (id) => {
    if (id === "new") onNewInvoice();
    else onNavigate(id);
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">i<span>.</span></div>
        <div><strong>Invoice Tracker</strong><small>PAYABLES WORKSPACE</small></div>
      </div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <button key={item.id} className={`nav-item ${activePage === item.id ? "active" : ""}`} onClick={() => handleNavigate(item.id)}>
            <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
            {activePage === item.id && <span className="nav-active-dot" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-help"><span className="help-icon">?</span><div><strong>Invoice workspace</strong><p>Extract, review and track payments.</p></div></div>
        <div className="profile-row"><div className="profile-avatar">IT</div><div><strong>Invoice Tracker</strong><small>Local workspace</small></div></div>
      </div>
    </aside>
  );
}
