import { clearAuthSession, getAccessToken } from "./authStorage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const token = getAccessToken();
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData
      ? {}
      : {
          "Content-Type": "application/json",
        }),

    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),

    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") ?? "";

  let data = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text || null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
    }

    const message = data?.message || data?.error || "Something went wrong.";

    throw new ApiError(message, response.status, data);
  }

  return data;
}

export const apiClient = {
  get(endpoint, options = {}) {
    return request(endpoint, {
      ...options,
      method: "GET",
    });
  },

  post(endpoint, body, options = {}) {
    return request(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  put(endpoint, body, options = {}) {
    return request(endpoint, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  patch(endpoint, body = null, options = {}) {
    return request(endpoint, {
      ...options,
      method: "PATCH",
      ...(body !== null && {
        body: body instanceof FormData ? body : JSON.stringify(body),
      }),
    });
  },

  delete(endpoint, options = {}) {
    return request(endpoint, {
      ...options,
      method: "DELETE",
    });
  },
};
