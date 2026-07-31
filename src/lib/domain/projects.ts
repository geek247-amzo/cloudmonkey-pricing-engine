/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

const projectStatuses = ["planned", "active", "on_hold", "completed", "cancelled"] as const;
const taskStatuses = ["backlog", "todo", "in_progress", "blocked", "review", "done"] as const;

const projectUpdateSchema = z.object({
  name: z.string().min(2).max(180).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(projectStatuses).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  targetDate: z.string().optional().nullable(),
});

const taskCreateSchema = z.object({
  title: z.string().min(2).max(240),
  description: z.string().max(5000).optional().nullable(),
  milestoneId: z.string().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  status: z.enum(taskStatuses).default("backlog"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueDate: z.string().optional().nullable(),
});

const taskUpdateSchema = taskCreateSchema.partial();
const milestoneSchema = z.object({
  name: z.string().min(2).max(180),
  description: z.string().max(3000).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  status: z.enum(["not_started", "in_progress", "complete"]).default("not_started"),
});
const deliverableSchema = z.object({
  name: z.string().min(2).max(180),
  description: z.string().max(3000).optional().nullable(),
  milestoneId: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
  status: z.enum(["planned", "in_progress", "ready", "approved"]).default("planned"),
});
const commentSchema = z.object({ body: z.string().min(1).max(5000), taskId: z.string().optional().nullable(), isInternal: z.boolean().default(false) });
const noteSchema = z.object({ body: z.string().min(1).max(5000) });

type ProjectDeps = {
  db: any;
  json: (data: unknown, init?: ResponseInit | number) => Response;
  parseBody: <T>(request: Request, schema: any) => Promise<T>;
  requireAdmin: (request: Request) => Promise<{ session?: any; response?: Response }>;
  requireSession: (request: Request) => Promise<{ session?: any; response?: Response }>;
  recordAudit: (input: Record<string, unknown>) => Promise<void>;
  sendEmail: (input: Record<string, unknown>) => Promise<void>;
  makeId: (prefix: string) => string;
  project: any;
  projectMember: any;
  projectMilestone: any;
  projectTask: any;
  projectDeliverable: any;
  projectComment: any;
  projectActivity: any;
  userNotification: any;
  subscription: any;
  servicePlan: any;
  service: any;
  user: any;
};

function asDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function eligible(serviceName: string, planName: string, explicit: boolean) {
  if (explicit) return true;
  return /website|ecommerce|build|development|managed it|hosting|cloud|voice|pbx|sip|microsoft|workspace|security|automation|ai agent|consult|strategy|seo|intelligence/i.test(`${serviceName} ${planName}`);
}

function templateFor(serviceName: string, planName: string, explicit?: string | null) {
  if (explicit) return explicit;
  const value = `${serviceName} ${planName}`.toLowerCase();
  if (/ecommerce|online store|shop/.test(value)) return "ecommerce-launch";
  if (/website|web build|development/.test(value)) return "website-build";
  if (/voice|pbx|sip/.test(value)) return "voice-implementation";
  if (/hosting|cloud|server/.test(value)) return "managed-cloud-setup";
  if (/microsoft|workspace|security|managed it/.test(value)) return "business-technology";
  if (/ai|automation|seo|intelligence/.test(value)) return "ai-automation";
  return "service-implementation";
}

function templateSteps(template: string) {
  const steps: Record<string, { milestone: string; tasks: string[] }[]> = {
    "ecommerce-launch": [
      { milestone: "Store foundation", tasks: ["Confirm store structure and brand inputs", "Configure storefront and commerce engine"] },
      { milestone: "Catalogue and payments", tasks: ["Import products, images, pricing and stock", "Configure payments, shipping and tax"] },
      { milestone: "Review and launch", tasks: ["Complete customer review and UAT", "Publish storefront and hand over access"] },
    ],
    "website-build": [
      { milestone: "Discovery and content", tasks: ["Confirm scope, sitemap and content", "Collect brand assets and approvals"] },
      { milestone: "Build and configuration", tasks: ["Build pages and integrations", "Configure domain, SSL and analytics"] },
      { milestone: "Review and launch", tasks: ["Complete customer UAT", "Publish and hand over the website"] },
    ],
    "voice-implementation": [
      { milestone: "Voice discovery", tasks: ["Confirm numbers, users and call flows", "Confirm devices and integrations"] },
      { milestone: "Configuration and testing", tasks: ["Configure PBX, queues and IVR", "Test inbound, outbound and failover flows"] },
      { milestone: "Go-live and handover", tasks: ["Train users and confirm acceptance", "Complete go-live handover"] },
    ],
    "managed-cloud-setup": [
      { milestone: "Infrastructure discovery", tasks: ["Confirm hosting, security and backup requirements", "Document access and deployment plan"] },
      { milestone: "Provision and secure", tasks: ["Provision runtime and services", "Configure backups, SSL, monitoring and security"] },
      { milestone: "Validation and handover", tasks: ["Complete health and restore checks", "Deliver access and operating notes"] },
    ],
    "business-technology": [
      { milestone: "Audit and roadmap", tasks: ["Inventory current tools and workflows", "Agree priority improvements and success measures"] },
      { milestone: "Implementation", tasks: ["Implement the agreed improvements", "Validate security, access and operating processes"] },
      { milestone: "Handover", tasks: ["Train the customer team", "Deliver documentation and next-step recommendations"] },
    ],
    "ai-automation": [
      { milestone: "Use case and data", tasks: ["Confirm goals, data sources and guardrails", "Approve workflow and model plan"] },
      { milestone: "Build and test", tasks: ["Configure the automation or agent", "Run test cases and capture approvals"] },
      { milestone: "Launch and measure", tasks: ["Launch the approved workflow", "Set up reporting and improvement cadence"] },
    ],
  };
  return steps[template] || steps["website-build"];
}

async function createProjectForSubscription(deps: ProjectDeps, sub: any) {
  const [row] = await deps.db
    .select({ subscription: deps.subscription, plan: deps.servicePlan, service: deps.service, customer: deps.user })
    .from(deps.subscription)
    .leftJoin(deps.servicePlan, eq(deps.subscription.planId, deps.servicePlan.id))
    .leftJoin(deps.service, eq(deps.servicePlan.serviceId, deps.service.id))
    .leftJoin(deps.user, eq(deps.subscription.userId, deps.user.id))
    .where(eq(deps.subscription.id, sub.id));
  if (!row?.subscription || !row.customer || !eligible(row.service?.name || "", row.plan?.name || row.subscription.name, row.plan?.projectEligible)) return null;
  const existing = await deps.db.select().from(deps.project).where(eq(deps.project.subscriptionId, sub.id)).limit(1);
  if (existing[0]) return existing[0];
  const template = templateFor(row.service?.name || "", row.plan?.name || row.subscription.name, row.plan?.projectTemplate);
  const [created] = await deps.db.insert(deps.project).values({
    id: deps.makeId("project"), userId: row.subscription.userId, subscriptionId: sub.id, planId: row.subscription.planId,
    name: `${row.service?.name || row.subscription.name} implementation`, serviceName: row.service?.name || row.subscription.name,
    template, description: row.plan?.tagline || row.plan?.serviceNote || null, status: ["active", "trialing"].includes(row.subscription.status) ? "active" : "planned",
    startDate: new Date(), updatedAt: new Date(),
  }).returning();
  const steps = templateSteps(template);
  for (let milestoneIndex = 0; milestoneIndex < steps.length; milestoneIndex += 1) {
    const step = steps[milestoneIndex];
    const [milestone] = await deps.db.insert(deps.projectMilestone).values({ id: deps.makeId("milestone"), projectId: created.id, name: step.milestone, sortOrder: milestoneIndex, updatedAt: new Date() }).returning();
    for (let taskIndex = 0; taskIndex < step.tasks.length; taskIndex += 1) {
      await deps.db.insert(deps.projectTask).values({ id: deps.makeId("task"), projectId: created.id, milestoneId: milestone.id, title: step.tasks[taskIndex], sortOrder: taskIndex, status: "backlog", updatedAt: new Date() });
    }
  }
  await deps.db.insert(deps.projectActivity).values({ id: deps.makeId("activity"), projectId: created.id, action: "project.created", message: "Project created from the signed service subscription.", metadata: { subscriptionId: sub.id, template } });
  return created;
}

async function notifyCustomer(deps: ProjectDeps, projectRow: any, title: string, body: string, type: string) {
  await deps.db.insert(deps.userNotification).values({ id: deps.makeId("notification"), userId: projectRow.userId, projectId: projectRow.id, type, title, body });
  const customer = await deps.db.select().from(deps.user).where(eq(deps.user.id, projectRow.userId)).limit(1);
  if (customer[0]?.email) {
    await deps.sendEmail({ template: "support_notification", to: customer[0].email, subject: title, data: { firstName: customer[0].name, summary: body, emailIntro: title, emailBody: body, primaryCtaText: "Open project workspace", primaryCtaUrl: `${process.env.BETTER_AUTH_URL || "https://cloudmonkey.co.za"}/dashboard/projects` }, idempotencyKey: `project:${projectRow.id}:${type}:${Date.now()}` }).catch(() => undefined);
  }
}

export function createProjectHandlers(deps: ProjectDeps) {
  async function handleAdmin(request: Request) {
    const access = await deps.requireAdmin(request); if (access.response) return access.response;
    const url = new URL(request.url); const parts = url.pathname.split("/").filter(Boolean); const projectId = parts[3]; const resource = parts[4]; const resourceId = parts[5];
    try {
      if (!projectId && request.method === "GET") {
        const subs = await deps.db.select().from(deps.subscription).where(inArray(deps.subscription.status, ["active", "trialing"]));
        for (const sub of subs) await createProjectForSubscription(deps, sub);
        const rows = await deps.db.select({ project: deps.project, customer: deps.user, plan: deps.servicePlan }).from(deps.project).leftJoin(deps.user, eq(deps.project.userId, deps.user.id)).leftJoin(deps.servicePlan, eq(deps.project.planId, deps.servicePlan.id)).orderBy(desc(deps.project.updatedAt));
        return deps.json(rows.map((r: any) => ({ ...r.project, customer: r.customer, plan: r.plan })));
      }
      if (!projectId) return deps.json({ error: "Project id is required" }, 400);
      const projectRows = await deps.db.select().from(deps.project).where(eq(deps.project.id, projectId)).limit(1); const projectRow = projectRows[0]; if (!projectRow) return deps.json({ error: "Project not found" }, 404);
      if (request.method === "GET" && !resource) {
        const [tasks, milestones, deliverables, comments, activities, members] = await Promise.all([
          deps.db.select({ task: deps.projectTask, assignee: deps.user }).from(deps.projectTask).leftJoin(deps.user, eq(deps.projectTask.assignedToUserId, deps.user.id)).where(eq(deps.projectTask.projectId, projectId)).orderBy(asc(deps.projectTask.sortOrder)),
          deps.db.select().from(deps.projectMilestone).where(eq(deps.projectMilestone.projectId, projectId)).orderBy(asc(deps.projectMilestone.sortOrder)),
          deps.db.select().from(deps.projectDeliverable).where(eq(deps.projectDeliverable.projectId, projectId)),
          deps.db.select({ comment: deps.projectComment, author: deps.user }).from(deps.projectComment).leftJoin(deps.user, eq(deps.projectComment.authorUserId, deps.user.id)).where(eq(deps.projectComment.projectId, projectId)).orderBy(desc(deps.projectComment.createdAt)),
          deps.db.select({ activity: deps.projectActivity, actor: deps.user }).from(deps.projectActivity).leftJoin(deps.user, eq(deps.projectActivity.actorUserId, deps.user.id)).where(eq(deps.projectActivity.projectId, projectId)).orderBy(desc(deps.projectActivity.createdAt)).limit(40),
          deps.db.select({ member: deps.projectMember, user: deps.user }).from(deps.projectMember).leftJoin(deps.user, eq(deps.projectMember.userId, deps.user.id)).where(eq(deps.projectMember.projectId, projectId)),
        ]);
        const formattedComments = comments.map((r: any) => ({ ...r.comment, author: r.author }));
        return deps.json({ project: projectRow, tasks: tasks.map((r: any) => ({ ...r.task, assignee: r.assignee })), milestones, deliverables, comments: formattedComments.filter((item: any) => !item.isInternal), notes: formattedComments.filter((item: any) => item.isInternal), activities: activities.map((r: any) => ({ ...r.activity, actor: r.actor })), members: members.map((r: any) => ({ ...r.member, user: r.user })) });
      }
      if (request.method === "PATCH" && !resource) {
        const body = await deps.parseBody(request, projectUpdateSchema); const [updated] = await deps.db.update(deps.project).set({ ...body, targetDate: body.targetDate === undefined ? undefined : asDate(body.targetDate), updatedAt: new Date() }).where(eq(deps.project.id, projectId)).returning();
        if (body.status) { await deps.db.insert(deps.projectActivity).values({ id: deps.makeId("activity"), projectId, actorUserId: access.session?.user.id, action: "project.status_changed", message: `Project status changed to ${body.status}.`, metadata: { status: body.status } }); await notifyCustomer(deps, updated, "Project status updated", `Your ${updated.name} project is now ${body.status.replaceAll("_", " ")}.`, "project_status"); }
        return deps.json(updated);
      }
      if (resource === "tasks" && request.method === "POST" && !resourceId) {
        const body = await deps.parseBody(request, taskCreateSchema); const [task] = await deps.db.insert(deps.projectTask).values({ ...body, id: deps.makeId("task"), projectId, dueDate: asDate(body.dueDate), updatedAt: new Date() }).returning(); return deps.json(task, 201);
      }
      if (resource === "tasks" && resourceId && request.method === "PATCH") {
        const body = await deps.parseBody(request, taskUpdateSchema); const [task] = await deps.db.update(deps.projectTask).set({ ...body, dueDate: body.dueDate === undefined ? undefined : asDate(body.dueDate), updatedAt: new Date() }).where(and(eq(deps.projectTask.id, resourceId), eq(deps.projectTask.projectId, projectId))).returning(); if (!task) return deps.json({ error: "Task not found" }, 404);
        if (body.status) { await deps.db.insert(deps.projectActivity).values({ id: deps.makeId("activity"), projectId, actorUserId: access.session?.user.id, action: "task.status_changed", message: `${task.title} moved to ${body.status}.`, metadata: { taskId: resourceId, status: body.status } }); await notifyCustomer(deps, projectRow, "Project task updated", `${task.title} is now ${body.status.replaceAll("_", " ")}.`, "task_status"); }
        return deps.json(task);
      }
      if (resource === "milestones" && request.method === "POST") { const body = await deps.parseBody(request, milestoneSchema); const [row] = await deps.db.insert(deps.projectMilestone).values({ ...body, id: deps.makeId("milestone"), projectId, dueDate: asDate(body.dueDate), updatedAt: new Date() }).returning(); return deps.json(row, 201); }
      if (resource === "deliverables" && request.method === "POST") { const body = await deps.parseBody(request, deliverableSchema); const [row] = await deps.db.insert(deps.projectDeliverable).values({ ...body, id: deps.makeId("deliverable"), projectId, createdAt: new Date(), updatedAt: new Date() }).returning(); return deps.json(row, 201); }
      if (resource === "comments" && request.method === "POST") { const body = await deps.parseBody(request, commentSchema); const [comment] = await deps.db.insert(deps.projectComment).values({ ...body, id: deps.makeId("comment"), projectId, authorUserId: access.session?.user.id }).returning(); await deps.db.insert(deps.projectActivity).values({ id: deps.makeId("activity"), projectId, actorUserId: access.session?.user.id, action: "project.comment_added", message: "A project comment was added.", metadata: { commentId: comment.id } }); if (!body.isInternal) await notifyCustomer(deps, projectRow, "New update on your CloudMonkey project", body.body, "project_comment"); return deps.json(comment, 201); }
      if (resource === "notes" && request.method === "POST" && !resourceId) { const body = await deps.parseBody(request, noteSchema); const [note] = await deps.db.insert(deps.projectComment).values({ id: deps.makeId("note"), projectId, authorUserId: access.session?.user.id, body: body.body, isInternal: true }).returning(); await deps.db.insert(deps.projectActivity).values({ id: deps.makeId("activity"), projectId, actorUserId: access.session?.user.id, action: "project.internal_note_added", message: "An internal project note was added.", metadata: { noteId: note.id } }); return deps.json(note, 201); }
      if (resource === "notes" && resourceId && request.method === "DELETE") { const [note] = await deps.db.delete(deps.projectComment).where(and(eq(deps.projectComment.id, resourceId), eq(deps.projectComment.projectId, projectId), eq(deps.projectComment.isInternal, true))).returning(); if (!note) return deps.json({ error: "Note not found" }, 404); await deps.db.insert(deps.projectActivity).values({ id: deps.makeId("activity"), projectId, actorUserId: access.session?.user.id, action: "project.internal_note_deleted", message: "An internal project note was deleted.", metadata: { noteId: resourceId } }); return deps.json({ ok: true }); }
      return deps.json({ error: "Method not allowed" }, 405);
    } catch (error: any) { return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500); }
  }

  async function handleUserNotifications(request: Request) {
    const access = await deps.requireSession(request); if (access.response) return access.response; const url = new URL(request.url); const notificationId = url.pathname.split("/").filter(Boolean)[3];
    if (request.method === "GET") return deps.json(await deps.db.select().from(deps.userNotification).where(eq(deps.userNotification.userId, access.session!.user.id)).orderBy(desc(deps.userNotification.createdAt)).limit(50));
    if (request.method === "PATCH" && notificationId) { await deps.db.update(deps.userNotification).set({ readAt: new Date() }).where(and(eq(deps.userNotification.id, notificationId), eq(deps.userNotification.userId, access.session!.user.id))); return deps.json({ ok: true }); }
    return deps.json({ error: "Method not allowed" }, 405);
  }
  return { handleAdmin, handleUserNotifications, createProjectForSubscription: (sub: any) => createProjectForSubscription(deps, sub) };
}
