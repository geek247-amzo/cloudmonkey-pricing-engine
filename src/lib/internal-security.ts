import crypto from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type RequestLike = Pick<Request, "headers" | "method" | "url">;

type SignedRequestToken = {
  timestamp: number;
  nonce: string;
  signature: string;
};

type InternalAccessCheck =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

const DEFAULT_AUDIT_LOG_PATH =
  process.env.INTERNAL_SQL_AUDIT_LOG_PATH ?? "/app/logs/internal-sql-audit.jsonl";

function readBooleanEnv(name: string, fallback = false) {
  const value = process.env[name];
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function getRequestIp(request: RequestLike) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

export function getRequestUserAgent(request: RequestLike) {
  return request.headers.get("user-agent") ?? null;
}

export function createSignedRequestToken(
  secret: string,
  request: RequestLike,
  bodyText = "",
  timestamp = Date.now(),
  nonce = crypto.randomBytes(16).toString("hex"),
) {
  const pathname = new URL(request.url).pathname;
  const payload = `${timestamp}.${nonce}.${request.method}.${pathname}.${bodyText}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${timestamp}.${nonce}.${signature}`;
}

export function verifySignedRequestToken(
  token: string,
  secret: string,
  request: RequestLike,
  bodyText = "",
  maxAgeMs = 5 * 60 * 1000,
): InternalAccessCheck {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { ok: false, status: 403, error: "Invalid second-factor token" };
  }

  const [timestampText, nonce, signature] = parts;
  const timestamp = Number(timestampText);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, status: 403, error: "Invalid second-factor token" };
  }

  if (Math.abs(Date.now() - timestamp) > maxAgeMs) {
    return { ok: false, status: 403, error: "Second-factor token expired" };
  }

  const pathname = new URL(request.url).pathname;
  const payload = `${timestamp}.${nonce}.${request.method}.${pathname}.${bodyText}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (!timingSafeEqualString(expectedSignature, signature)) {
    return { ok: false, status: 403, error: "Invalid second-factor token" };
  }

  return { ok: true };
}

export function verifyInternalSqlConsoleAccess(
  request: RequestLike,
  bodyText = "",
): InternalAccessCheck {
  if (!readBooleanEnv("INTERNAL_SQL_CONSOLE_ENABLED", false)) {
    return { ok: false, status: 404, error: "Not found" };
  }

  const secret = process.env.INTERNAL_SQL_SECOND_FACTOR_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "Internal SQL console is not configured",
    };
  }

  const token = request.headers.get("x-cloudmonkey-admin-reauth");
  if (!token) {
    return { ok: false, status: 403, error: "Second-factor token is required" };
  }

  return verifySignedRequestToken(token, secret, request, bodyText);
}

export function verifyInternalAdminSecondFactor(
  request: RequestLike,
  bodyText = "",
): InternalAccessCheck {
  const secret =
    process.env.INTERNAL_ADMIN_SECOND_FACTOR_SECRET ??
    process.env.INTERNAL_SQL_SECOND_FACTOR_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "Internal admin second factor is not configured",
    };
  }

  const token = request.headers.get("x-cloudmonkey-admin-reauth");
  if (!token) {
    return { ok: false, status: 403, error: "Second-factor token is required" };
  }

  return verifySignedRequestToken(token, secret, request, bodyText);
}

export function verifyMailjetWebhookSignature(
  request: RequestLike,
  bodyText: string,
): InternalAccessCheck {
  const secret = process.env.MAILJET_WEBHOOK_SIGNATURE_SECRET ?? process.env.MAILJET_WEBHOOK_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "Mailjet webhook signature secret is not configured",
    };
  }

  const provided =
    request.headers.get("x-mailjet-signature") ??
    request.headers.get("x-cloudmonkey-webhook-secret");
  if (!provided) {
    return { ok: false, status: 401, error: "Missing Mailjet signature" };
  }

  const expected = crypto.createHmac("sha256", secret).update(bodyText).digest("hex");
  if (!timingSafeEqualString(expected, provided)) {
    return { ok: false, status: 401, error: "Invalid Mailjet signature" };
  }

  return { ok: true };
}

export async function recordInternalToolAudit(entry: Record<string, unknown>) {
  const targetPath = process.env.INTERNAL_SQL_AUDIT_LOG_PATH ?? DEFAULT_AUDIT_LOG_PATH;
  const record = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  await mkdir(path.dirname(targetPath), { recursive: true });
  await appendFile(targetPath, `${JSON.stringify(record)}\n`, { encoding: "utf8" });
}
