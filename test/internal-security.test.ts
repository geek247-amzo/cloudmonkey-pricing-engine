import crypto from "node:crypto";

import { describe, expect, test } from "bun:test";

import {
  createSignedRequestToken,
  verifyInternalAdminSecondFactor,
  verifyInternalSqlConsoleAccess,
  verifyMailjetWebhookSignature,
  verifySignedRequestToken,
} from "../src/lib/internal-security";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const snapshot = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    snapshot.set(key, process.env[key]);
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    fn();
  } finally {
    for (const [key, value] of snapshot) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("internal security helpers", () => {
  test("signed request tokens round-trip", () => {
    const request = new Request("https://cloudmonkey.co.za/api/internal/admin/sql", {
      method: "POST",
    });
    const bodyText = JSON.stringify({ query: "select 1" });
    const token = createSignedRequestToken("test-secret", request, bodyText);

    expect(verifySignedRequestToken(token, "test-secret", request, bodyText).ok).toBe(true);
    expect(verifySignedRequestToken(token, "wrong-secret", request, bodyText).ok).toBe(false);
  });

  test("internal SQL console stays disabled unless explicitly enabled", () => {
    withEnv(
      {
        INTERNAL_SQL_CONSOLE_ENABLED: undefined,
        INTERNAL_SQL_SECOND_FACTOR_SECRET: "test-secret",
      },
      () => {
        const request = new Request("https://cloudmonkey.co.za/api/internal/admin/sql", {
          method: "POST",
          headers: {
            "x-cloudmonkey-admin-reauth": createSignedRequestToken(
              "test-secret",
              new Request("https://cloudmonkey.co.za/api/internal/admin/sql", { method: "POST" }),
              JSON.stringify({ query: "select 1" }),
            ),
          },
        });

        expect(
          verifyInternalSqlConsoleAccess(request, JSON.stringify({ query: "select 1" })).status,
        ).toBe(404);
      },
    );
  });

  test("internal admin second factor rejects missing or invalid tokens", () => {
    withEnv(
      {
        INTERNAL_ADMIN_SECOND_FACTOR_SECRET: "admin-secret",
      },
      () => {
        const request = new Request("https://cloudmonkey.co.za/api/internal/admin/send-reminder", {
          method: "POST",
        });

        expect(verifyInternalAdminSecondFactor(request).ok).toBe(false);
      },
    );
  });

  test("mailjet webhook signature must match the body", () => {
    withEnv(
      {
        MAILJET_WEBHOOK_SIGNATURE_SECRET: "mailjet-secret",
      },
      () => {
        const bodyText = JSON.stringify([{ CustomID: "proposal:123", event: "sent", time: 123 }]);
        const signature = crypto
          .createHmac("sha256", "mailjet-secret")
          .update(bodyText)
          .digest("hex");
        const request = new Request("https://cloudmonkey.co.za/api/webhooks/mailjet", {
          method: "POST",
          headers: { "x-mailjet-signature": signature },
        });

        expect(verifyMailjetWebhookSignature(request, bodyText).ok).toBe(true);
        expect(
          verifyMailjetWebhookSignature(
            new Request("https://cloudmonkey.co.za/api/webhooks/mailjet", {
              method: "POST",
              headers: { "x-mailjet-signature": "bad" },
            }),
            bodyText,
          ).ok,
        ).toBe(false);
      },
    );
  });
});
