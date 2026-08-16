import { apiClient } from "../../../services/apiClient";

export async function login(credentials) {
  const response = await apiClient.post("/api/auth/login", credentials);

  return {
    token: response.token,
    userId: response.userId,
    name: response.name,
    email: response.email,
    role: response.role,
  };
}
