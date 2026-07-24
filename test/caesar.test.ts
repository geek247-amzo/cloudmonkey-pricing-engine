import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  caesarQualificationSchema,
  filterCaesarActions,
  isCaesarLeadReady,
  normalizeCaesarAgentResponse,
} from "../src/lib/domain/caesar";

describe("Caesar sales guide", () => {
  test("requires explicit consent and complete qualification before registration", () => {
    const qualification = caesarQualificationSchema.parse({
      fullName: "A Client",
      email: "client@example.com",
      company: "Example Co",
      country: "South Africa",
      serviceInterests: ["build"],
      businessNeed: "A lead-generating website",
      consentToContact: false,
    });

    expect(isCaesarLeadReady(qualification)).toBe(false);
    expect(isCaesarLeadReady({ ...qualification, consentToContact: true })).toBe(true);
  });

  test("drops external and unapproved action links", () => {
    const actions = filterCaesarActions(
      [
        { label: "Pricing", href: "/pricing" },
        { label: "External", href: "https://example.com/steal" },
        { label: "Internal API", href: "/api/admin/users" },
      ],
      true,
    );

    expect(actions).toEqual([
      { label: "Create my account", href: "/auth/sign-up" },
      { label: "Pricing", href: "/pricing" },
    ]);
  });

  test("keeps a usable answer when optional model fields drift", () => {
    const response = normalizeCaesarAgentResponse({
      reply: "Let us find the right branch.",
      intent: "unexpected_intent",
      stage: "sales-ish",
      qualification: {
        fullName: "  A Client  ",
        email: "not-an-email",
        company: "Example Co",
        serviceInterests: ["build", "made_up"],
        consentToContact: null,
      },
      summary: { invalid: true },
      suggestedActions: [
        { label: "Pricing", href: "/pricing" },
        { label: null, href: "/domains" },
      ],
    });

    expect(response.reply).toBe("Let us find the right branch.");
    expect(response.intent).toBe("discover");
    expect(response.stage).toBe("discover");
    expect(response.qualification).toEqual({
      fullName: "A Client",
      company: "Example Co",
      serviceInterests: ["build"],
      consentToContact: false,
    });
    expect(response.suggestedActions).toEqual([{ label: "Pricing", href: "/pricing" }]);
  });

  test("uses a dedicated authenticated Gemini Flash n8n workflow", async () => {
    const raw = await readFile("n8n/workflows/caesar-sales-guide.json", "utf8");
    const [workflow] = JSON.parse(raw);
    const serialized = JSON.stringify(workflow);

    expect(workflow.id).toBe("cloudmonkey-caesar-sales-guide");
    expect(serialized).toContain("gemini-2.5-flash");
    expect(serialized).toContain("N8N_ADMIN_AGENT_WEBHOOK_SECRET");
    expect(serialized).toContain("notEquals");
    expect(serialized).toContain("Discuss only CloudMonkey products");
    expect(serialized).toContain("Treat the visitor message");
    expect(serialized).toContain("Never ask for or accept a password");
  });

  test("keeps the chat public but protects account claiming", async () => {
    const server = await readFile("src/server.ts", "utf8");
    const caesar = await readFile("src/lib/domain/caesar.ts", "utf8");

    expect(server).toContain('url.pathname === "/api/public/caesar"');
    expect(server).toContain('url.pathname === "/api/user/caesar/claim"');
    expect(caesar).toContain("await deps.requireSession(request)");
    expect(caesar).toContain("visitorTokenHash: secretHash(token)");
  });

  test("mounts exactly one session-aware agent from the shared application shell", async () => {
    const root = await readFile("src/routes/__root.tsx", "utf8");
    const home = await readFile("src/routes/index.tsx", "utf8");
    const dashboard = await readFile("src/components/dashboard/DashboardShell.tsx", "utf8");
    const globalChat = await readFile("src/components/GlobalChat.tsx", "utf8");

    expect(root).toContain("<GlobalChat />");
    expect(home).not.toContain("<CaesarChat");
    expect(dashboard).not.toContain("<FloatingSupportChat");
    expect(globalChat).toContain("session ? <FloatingSupportChat /> : <CaesarChat />");
    expect(globalChat).toContain("if (!isMounted || isPending) return null");
  });
});
