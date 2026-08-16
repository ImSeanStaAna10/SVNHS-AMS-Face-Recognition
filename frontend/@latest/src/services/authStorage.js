import { STORAGE_KEYS } from "../constants/storageKeys";

export function getAuthSession() {
  const storedSession = sessionStorage.getItem(STORAGE_KEYS.AUTH);

  if (!storedSession) {
    return null;
  }

  try {
    return JSON.parse(storedSession);
  } catch {
    clearAuthSession();
    return null;
  }
}

export function saveAuthSession(authSession) {
  sessionStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(authSession));
}

export function clearAuthSession() {
  sessionStorage.removeItem(STORAGE_KEYS.AUTH);
}

export function getAccessToken() {
  return getAuthSession()?.token ?? null;
}
