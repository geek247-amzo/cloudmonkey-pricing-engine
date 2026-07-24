import { auth } from "./auth";

export type AppSession = Awaited<ReturnType<typeof auth.api.getSession>>;

const adminRoles = new Set(["admin", "owner"]);

export function isAdmin(session: AppSession) {
  return !!session && adminRoles.has(session.user.role);
}

export async function requireSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { response: new Response("Unauthorized", { status: 401 }) };
  return { session };
}

export async function requireAdmin(request: Request) {
  const adminToken =
    process.env.CLOUDMONKEY_API_TOKEN ?? process.env.N8N_ADMIN_AGENT_WEBHOOK_SECRET;
  const requestToken =
    request.headers.get("X-CloudMonkey-API-Token") ??
    request.headers.get("X-CloudMonkey-Admin-Token") ??
    request.headers.get("Authorization")?.replace("Bearer ", "");

  if (adminToken && requestToken === adminToken) {
    return {
      session: {
        user: {
          id: "admin_agent",
          role: "admin",
          name: "Admin Agent",
          email: "agent@cloudmonkey.co.za",
        },
        session: {
          id: "admin_agent_session",
          userId: "admin_agent",
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          token: adminToken,
        },
      } as unknown as AppSession,
    };
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!isAdmin(session)) return { response: new Response("Unauthorized", { status: 401 }) };
  return { session };
}
