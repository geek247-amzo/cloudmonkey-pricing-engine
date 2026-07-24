const SENSITIVE_KEYS = /(?:password|secret|token|authorization|cookie|api[_-]?key|refresh|access[_-]?token|ssn|id[_-]?number)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

/** Returns a JSON-safe copy with direct identifiers and credential-like fields removed. */
export function stripPii(value: unknown, options: { maxStringLength?: number } = {}): unknown {
  const max = options.maxStringLength ?? 2000;
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    return value.slice(0, max).replace(EMAIL, "[email]").replace(IPV4, "[ip]").replace(PHONE, "[phone]");
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => stripPii(item, options));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).slice(0, 200).map(([key, item]) => [
        key,
        SENSITIVE_KEYS.test(key) ? "[redacted]" : stripPii(item, options),
      ]),
    );
  }
  return "[redacted]";
}

export function stripPiiJson(value: unknown): string {
  return JSON.stringify(stripPii(value));
}
