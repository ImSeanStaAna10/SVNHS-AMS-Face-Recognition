import { useState } from "react";

import AppButton from "../../../components/ui/AppButton";
import FormInput from "../../../components/ui/FormInput";
import AuthBrandPanel from "../components/AuthBrandPanel";

import "../styles/auth.css";

const initialForm = {
  email: "",
  password: "",
};

function LoginPage() {
  const [form, setForm] = useState(initialForm);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    console.log(form);
  };

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <AuthBrandPanel />

        <section className="auth-form-section">
          <div className="auth-form-container">
            <div className="auth-mobile-brand d-lg-none">
              <span>SVNHS</span>
              <small>Attendance Management System</small>
            </div>

            <div className="auth-heading">
              <span className="auth-eyebrow text-primary">Welcome back</span>

              <h2>Sign in to your account</h2>

              <p>
                Enter your credentials to access the attendance management
                system.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <FormInput
                label="Email Address"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Enter your email"
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

              <AppButton type="submit" className="w-100 btn-lg mt-2">
                Sign In
              </AppButton>
            </form>

            <p className="auth-footer-text">
              Signal Village National High School
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default LoginPage;
