export const CAESAR_SESSION_STORAGE_KEY = "cloudmonkey:caesar-session";

export type StoredCaesarSession = {
  sessionId: string;
  sessionToken: string;
};

export function loadCaesarSession(): StoredCaesarSession | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(CAESAR_SESSION_STORAGE_KEY) ?? "null");
    return parsed?.sessionId && parsed?.sessionToken ? parsed : null;
  } catch {
    return null;
  }
}

export function storeCaesarSession(session: StoredCaesarSession) {
  localStorage.setItem(CAESAR_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearCaesarSession() {
  localStorage.removeItem(CAESAR_SESSION_STORAGE_KEY);
}

export async function claimCaesarSession() {
  const session = loadCaesarSession();
  if (!session) return null;
  const response = await fetch("/api/user/caesar/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    if (response.status === 403 || response.status === 409) clearCaesarSession();
    return null;
  }
  return response.json();
}
