import { useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { ROLES } from "../../../constants/roles";

import AppButton from "../../../components/ui/AppButton";
import FormInput from "../../../components/ui/FormInput";

import AuthBrandPanel from "../components/AuthBrandPanel";
import useAuth from "../hooks/useAuth";

import "../styles/auth.css";

const initialForm = {
  email: "",
  password: "",
};

function LoginPage() {
  const navigate = useNavigate();

  const { login, isAuthenticated, role } = useAuth();

  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const session = await login({
        email: form.email.trim(),
        password: form.password,
      });

      if (session.role === ROLES.COUNCILOR) {
        navigate("/councilor/dashboard", {
          replace: true,
        });

        return;
      }

      if (session.role === ROLES.ADVISER) {
        setError("Adviser dashboard is not available yet.");
        return;
      }

      setError("Unable to determine account role.");
    } catch (error) {
      setError(error.message || "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated && role === ROLES.COUNCILOR) {
    return <Navigate to="/councilor/dashboard" replace />;
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <AuthBrandPanel />

        <section
          className="auth-form-section"
          aria-labelledby="auth-login-heading"
        >
          <div className="auth-form-shell">
            <div className="auth-form-card">
              <header className="auth-heading">
                <span className="auth-eyebrow">
                  <span className="auth-eyebrow-indicator" aria-hidden="true" />
                  Authorized Personnel
                </span>

                <h2 id="auth-login-heading">Welcome back</h2>

                <p>
                  Sign in using your authorized school account to continue to
                  the attendance management system.
                </p>
              </header>

              {error && (
                <div className="auth-alert" role="alert" aria-live="polite">
                  <div className="auth-alert-icon" aria-hidden="true">
                    !
                  </div>

                  <div className="auth-alert-content">
                    <strong>Sign in failed</strong>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="auth-form"
                aria-busy={isSubmitting}
              >
                <FormInput
                  label="Email address"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@school.edu.ph"
                  autoComplete="email"
                  required
                />

                <FormInput
                  label="Password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />

                <AppButton
                  type="submit"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  className="w-100 auth-submit-button"
                >
                  <span>Sign in</span>

                  {!isSubmitting && (
                    <span className="auth-submit-arrow" aria-hidden="true">
                      →
                    </span>
                  )}
                </AppButton>
              </form>

              <div className="auth-security-note">
                <span className="auth-security-indicator" aria-hidden="true" />

                <span>Secure access to the SVNHS attendance system</span>
              </div>
            </div>

            <footer className="auth-footer">
              <span>Signal Village National High School</span>

              <span className="auth-footer-divider" aria-hidden="true">
                •
              </span>

              <span>Attendance Management System</span>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}

export default LoginPage;
