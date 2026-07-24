type RecaptchaConfig = {
  enabled: boolean;
  siteKey: string | null;
};

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

let configPromise: Promise<RecaptchaConfig> | null = null;
let scriptPromise: Promise<void> | null = null;

export async function getRecaptchaToken(action = "auth_email") {
  if (typeof window === "undefined") return null;
  const config = await getRecaptchaConfig();
  if (!config.enabled || !config.siteKey) return null;
  await loadRecaptchaScript(config.siteKey);
  await new Promise<void>((resolve) => window.grecaptcha?.ready(resolve));
  return window.grecaptcha?.execute(config.siteKey, { action }) ?? null;
}

export function captchaFetchOptions(token: string | null) {
  return token
    ? {
        headers: {
          "x-captcha-response": token,
        },
      }
    : undefined;
}

async function getRecaptchaConfig() {
  configPromise ??= fetch("/api/public/auth-security-config")
    .then((response) => {
      if (!response.ok) throw new Error("Unable to load security configuration");
      return response.json();
    })
    .then((value) => ({
      enabled: Boolean(value.recaptcha?.enabled),
      siteKey: typeof value.recaptcha?.siteKey === "string" ? value.recaptcha.siteKey : null,
    }))
    .catch(() => ({ enabled: false, siteKey: null }));
  return configPromise;
}

function loadRecaptchaScript(siteKey: string) {
  if (window.grecaptcha) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-cloudmonkey-recaptcha]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("reCAPTCHA failed to load")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.cloudmonkeyRecaptcha = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("reCAPTCHA failed to load"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}
