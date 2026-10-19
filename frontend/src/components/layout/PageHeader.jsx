export default function PageHeader({ title, subtitle, action }) {
  return (
    <header className="page-header">
      <div><div className="breadcrumb">WORKSPACE <span>/</span> {title.toUpperCase()}</div><h1>{title}</h1><p>{subtitle}</p></div>
      {action && <button className="btn btn-primary" onClick={action.onClick}><span className="button-plus">+</span>{action.label}</button>}
    </header>
  );
}
