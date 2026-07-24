const DASHBOARD_ROOT = "/dashboard";

export function safeDashboardCallback(
  value: string | null | undefined,
  fallback = DASHBOARD_ROOT,
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const parsed = new URL(value, "https://cloudmonkey.local");
    if (parsed.origin !== "https://cloudmonkey.local") return fallback;
    if (
      parsed.pathname !== DASHBOARD_ROOT &&
      !parsed.pathname.startsWith(`${DASHBOARD_ROOT}/`)
    ) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function signInPath(callbackURL: string) {
  return `/auth/sign-in?callbackURL=${encodeURIComponent(
    safeDashboardCallback(callbackURL),
  )}`;
}
