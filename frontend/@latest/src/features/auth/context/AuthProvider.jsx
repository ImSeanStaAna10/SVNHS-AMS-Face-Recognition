import { useState } from "react";

import AuthContext from "./AuthContext";

import {
  clearAuthSession,
  getAuthSession,
  saveAuthSession,
} from "../../../services/authStorage";

import { login as loginRequest } from "../services/authService";

function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => getAuthSession());

  const login = async (credentials) => {
    const session = await loginRequest(credentials);

    saveAuthSession(session);
    setAuth(session);

    return session;
  };

  const logout = () => {
    clearAuthSession();
    setAuth(null);
  };

  const value = {
    userId: auth?.userId ?? null,
    role: auth?.role ?? null,
    token: auth?.token ?? null,

    isAuthenticated: Boolean(auth?.token),

    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
