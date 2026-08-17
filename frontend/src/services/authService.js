import api from "./api";

const login = async ({ email, password }) => {
  const response = await api.post("/auth/login", {
    email,
    password,
  });

  return response.data;
};

const saveSession = (data) => {
  if (!data?.token) {
    throw new Error("Login response does not contain a token.");
  }

  const user = {
    userId: data.userId,
    name: data.name,
    email: data.email,
    role: data.role,
  };

  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(user));

  return user;
};

const getToken = () => {
  return localStorage.getItem("token");
};

const getUser = () => {
  const user = localStorage.getItem("user");

  if (!user) {
    return null;
  }

  try {
    return JSON.parse(user);
  } catch {
    return null;
  }
};

const isAuthenticated = () => {
  return Boolean(getToken());
};

const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

const authService = {
  login,
  saveSession,
  getToken,
  getUser,
  isAuthenticated,
  logout,
};

export default authService;
