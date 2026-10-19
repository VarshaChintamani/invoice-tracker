export default function FormField({ label, name, type = "text", value, onChange, placeholder = "", readOnly = false, ...props }) {
  return (
    <div className="form-group">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder} readOnly={readOnly} {...props} />
    </div>
  );
}
