import crypto from "node:crypto";

export function createSecureToken(bytes = 32) {
  const raw = crypto.randomBytes(bytes).toString("base64url");
  return { raw, hash: crypto.createHash("sha256").update(raw).digest("hex") };
}

export function hashSecureToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function isUnexpired(expiresAt: Date | string, now = Date.now()) {
  return new Date(expiresAt).getTime() > now;
}
