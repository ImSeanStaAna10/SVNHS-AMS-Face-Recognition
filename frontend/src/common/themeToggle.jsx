import useTheme from "../hooks/useTheme";

function ThemeToggle() {
  const {
    isDark,
    toggleTheme,
  } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={
        isDark
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      aria-pressed={isDark}
      title={
        isDark
          ? "Light mode"
          : "Dark mode"
      }
    >
      <span
        className="theme-toggle-track"
        aria-hidden="true"
      >
        <span className="theme-toggle-sun">
          ☀
        </span>

        <span className="theme-toggle-moon">
          ☾
        </span>

        <span className="theme-toggle-thumb">
          {isDark ? "☾" : "☀"}
        </span>
      </span>
    </button>
  );
}

export default ThemeToggle;