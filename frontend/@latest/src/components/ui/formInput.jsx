function FormInput({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  autoComplete,
  error,
}) {
  return (
    <div className="mb-3">
      <label htmlFor={name} className="form-label fw-semibold">
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className={`form-control form-control-lg ${error ? "is-invalid" : ""}`}
      />

      {error && <div className="invalid-feedback">{error}</div>}
    </div>
  );
}

export default FormInput;
