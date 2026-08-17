import { useState } from "react";
import { useNavigate } from "react-router-dom";

import authService from "../../services/authService";

import schoolBackground from "../../assets/school-background.png";
import bagongPilipinasLogo from "../../assets/bagong-pilipinas-logo.svg";
import depedLogo from "../../assets/kagawaran-educ-logo.svg";
import schoolDivisionLogo from "../../assets/school-division-logo.svg";
import shsLogo from "../../assets/shs-logo.svg";

import "./auth.css";

const INITIAL_FORM = {
  email: "",
  password: "",
};

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const email = formData.email.trim();
    const password = formData.password;

    if (!email || !password) {
      setError("Please enter your email address and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await authService.login({
        email,
        password,
      });

      const user = authService.saveSession(data);

      switch (user.role) {
        case "COUNCILOR":
          navigate("/councilor/dashboard", { replace: true });
          break;

        case "ADVISER":
          navigate("/adviser/dashboard", { replace: true });
          break;

        default:
          navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      if (!err.response) {
        setError(
          "Unable to connect to the server. Please check if the backend is running."
        );
        return;
      }

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Invalid email address or password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      {/* Background */}
      <img
        src={schoolBackground}
        alt=""
        className="auth-background"
        aria-hidden="true"
      />

      <div className="auth-background-overlay" aria-hidden="true" />

      {/* Decorative institutional waves */}
      <div
        className="auth-decoration auth-decoration-left"
        aria-hidden="true"
      >
        <span className="auth-wave auth-wave-red" />
        <span className="auth-wave auth-wave-blue" />
      </div>

      <div
        className="auth-decoration auth-decoration-right"
        aria-hidden="true"
      >
        <span className="auth-wave auth-wave-red" />
        <span className="auth-wave auth-wave-blue" />
      </div>

      {/* Main content */}
      <div className="auth-container">
        {/* BRANDING */}
        <section className="auth-brand">
          <div className="auth-institutional">
            <p className="auth-republic">
              REPUBLIC OF THE PHILIPPINES
            </p>

            <div className="auth-logos">
              <img
                src={depedLogo}
                alt="Department of Education"
              />

              <img
                src={bagongPilipinasLogo}
                alt="Bagong Pilipinas"
              />

              <img
                src={schoolDivisionLogo}
                alt="Schools Division"
              />

              <img
                src={shsLogo}
                alt="Signal Village National High School"
                className="auth-school-logo"
              />
            </div>
          </div>

          <div className="auth-school-title">
            <span className="auth-location">
              TAGUIG CITY
            </span>

            <h1>
              <span>SIGNAL VILLAGE</span>
              NATIONAL HIGH SCHOOL
            </h1>

            <div className="auth-title-divider">
              <span />
              <strong>SVNHS</strong>
              <span />
            </div>

            <p>ATTENDANCE MANAGEMENT SYSTEM</p>
          </div>
        </section>

        {/* LOGIN CARD */}
        <section className="auth-login-section">
          <div className="auth-login-card">
            <div className="auth-card-top-line" />

            <header className="auth-login-header">
              <span className="auth-welcome">
                WELCOME BACK!
              </span>

              <h2>
                Sign in to your account
              </h2>

              <p>
                Enter your school account credentials
                to continue to the attendance system.
              </p>
            </header>

            <form
              className="auth-form"
              onSubmit={handleSubmit}
              noValidate
            >
              {/* EMAIL */}
              <div className="auth-field">
                <label htmlFor="email">
                  Email Address
                </label>

                <div className="auth-input-wrapper">
                  <span
                    className="auth-input-icon"
                    aria-hidden="true"
                  >
                    @
                  </span>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your school email"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div className="auth-field">
                <label htmlFor="password">
                  Password
                </label>

                <div className="auth-input-wrapper">
                  <span
                    className="auth-input-icon"
                    aria-hidden="true"
                  >
                    •
                  </span>

                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* ERROR */}
              {error && (
                <div
                  className="auth-error"
                  role="alert"
                >
                  <span>!</span>
                  <p>{error}</p>
                </div>
              )}

              {/* SUBMIT */}
              <button
                type="submit"
                className="auth-submit"
                disabled={loading}
              >
                {loading && (
                  <span className="auth-spinner" />
                )}

                {loading
                  ? "Signing In..."
                  : "Login"}
              </button>
            </form>

            <footer className="auth-login-footer">
              <span>SVNHS</span>

              <span className="auth-footer-divider" />

              <span>
                Attendance Management System
              </span>
            </footer>
          </div>
        </section>
      </div>

      {/* Bottom institutional label */}
      <div className="auth-bottom-label">
        <span>Department of Education</span>

        <strong>•</strong>

        <span>
          Schools Division of Taguig City and Pateros
        </span>
      </div>
    </main>
  );
}

export default Login;