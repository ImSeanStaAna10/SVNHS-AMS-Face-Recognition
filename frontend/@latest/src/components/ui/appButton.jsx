function AppButton({
  children,
  type = "button",
  loading = false,
  disabled = false,
  className = "",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`btn btn-primary ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <span
            className="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          />
          Please wait...
        </>
      ) : (
        children
      )}
    </button>
  );
}

export default AppButton;
