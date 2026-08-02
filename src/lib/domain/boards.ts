/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

const boardType = z.enum(["ops", "product", "sales", "support", "custom"]);
const boardCreate = z.object({ key: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,60}$/), name: z.string().min(2).max(160), type: boardType.default("custom"), visibility: z.literal("internal").default("internal") });
const columnCreate = z.object({ name: z.string().min(1).max(120), key: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,60}$/), position: z.coerce.number().finite().optional(), wipLimit: z.number().int().positive().optional().nullable(), isTerminal: z.boolean().default(false), automationKey: z.string().max(120).optional().nullable() });
const taskCreate = z.object({ columnId: z.string().min(1), title: z.string().min(1).max(240), description: z.string().max(10000).optional().nullable(), status: z.string().max(60).default("open"), priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"), visibility: z.literal("internal").default("internal"), assigneeUserId: z.string().optional().nullable(), customerUserId: z.string().optional().nullable(), dueDate: z.string().optional().nullable(), billable: z.boolean().default(false), estimateMinutes: z.number().int().nonnegative().optional().nullable(), loggedMinutes: z.number().int().nonnegative().default(0), position: z.coerce.number().finite().optional() });
const taskPatch = taskCreate.partial().extend({ version: z.number().int().positive() });
const moveSchema = z.object({ columnId: z.string().min(1), position: z.coerce.number().finite(), version: z.number().int().positive() });
const linkSchema = z.object({ entityType: z.enum(["proposal", "invoice", "website", "websiteProject", "supportTicket", "subscription", "document", "lead"]), entityId: z.string().min(1) });

type BoardDeps = { db: any; json: (data: unknown, init?: ResponseInit | number) => Response; parseBody: <T>(request: Request, schema: any) => Promise<T>; requireAdmin: (request: Request) => Promise<{ session?: any; response?: Response }>; recordAudit: (input: any) => Promise<unknown>; makeId: (prefix: string) => string; board: any; boardColumn: any; task: any; taskLink: any; taskLabel: any; taskLabelMap: any; taskActivity: any; };

function num(value: unknown) { return Number(value ?? 0); }
function taskPayload(row: any) { return { ...row, position: num(row.position) }; }

export function createBoardHandlers(deps: BoardDeps) {
  async function handleAdmin(request: Request) {
    const access = await deps.requireAdmin(request);
    if (access.response) return access.response;
    const parts = new URL(request.url).pathname.split("/").filter(Boolean);
    const boardId = parts[3];
    const resource = parts[4];
    const resourceId = parts[5];
    try {
      if (!boardId && request.method === "GET") {
        const boards = await deps.db.select().from(deps.board).where(sql`${deps.board.archivedAt} is null`).orderBy(asc(deps.board.name));
        return deps.json(boards);
      }
      if (!boardId && request.method === "POST") {
        const body = await deps.parseBody(request, boardCreate);
        const [created] = await deps.db.insert(deps.board).values({ id: deps.makeId("board"), ...body, createdAt: new Date(), updatedAt: new Date() }).returning();
        await deps.recordAudit({ actorUserId: access.session?.user.id, action: "board.created", entityType: "board", entityId: created.id, message: `Board created: ${created.name}` });
        return deps.json(created, 201);
      }
      if (!boardId) return deps.json({ error: "Board id is required" }, 400);
      const boardRow = (await deps.db.select().from(deps.board).where(eq(deps.board.id, boardId)).limit(1))[0];
      if (!boardRow) return deps.json({ error: "Board not found" }, 404);
      if (request.method === "GET" && !resource) {
        const [columns, tasks] = await Promise.all([
          deps.db.select().from(deps.boardColumn).where(eq(deps.boardColumn.boardId, boardId)).orderBy(asc(deps.boardColumn.position)),
          deps.db.select().from(deps.task).where(eq(deps.task.boardId, boardId)).orderBy(asc(deps.task.position)),
        ]);
        return deps.json({ board: boardRow, columns: columns.map((column: any) => ({ ...column, position: num(column.position) })), tasks: tasks.map(taskPayload) });
      }
      if (resource === "columns" && request.method === "POST" && !resourceId) {
        const body = await deps.parseBody(request, columnCreate);
        const position = body.position ?? (num((await deps.db.select({ position: deps.boardColumn.position }).from(deps.boardColumn).where(eq(deps.boardColumn.boardId, boardId)).orderBy(desc(deps.boardColumn.position)).limit(1))[0]?.position) + 100);
        const [created] = await deps.db.insert(deps.boardColumn).values({ id: deps.makeId("boardcol"), boardId, ...body, position: String(position), createdAt: new Date(), updatedAt: new Date() }).returning();
        return deps.json({ ...created, position: num(created.position) }, 201);
      }
      if (resource === "tasks" && request.method === "POST" && !resourceId) {
        const body = await deps.parseBody(request, taskCreate);
        const column = (await deps.db.select().from(deps.boardColumn).where(and(eq(deps.boardColumn.id, body.columnId), eq(deps.boardColumn.boardId, boardId))).limit(1))[0];
        if (!column) return deps.json({ error: "Column not found on this board" }, 404);
        const position = body.position ?? (num((await deps.db.select({ position: deps.task.position }).from(deps.task).where(and(eq(deps.task.boardId, boardId), eq(deps.task.columnId, body.columnId))).orderBy(desc(deps.task.position)).limit(1))[0]?.position) + 100);
        const [created] = await deps.db.insert(deps.task).values({ id: deps.makeId("task"), boardId, ...body, position: String(position), dueDate: body.dueDate ? new Date(body.dueDate) : null, createdByUserId: access.session!.user.id, createdAt: new Date(), updatedAt: new Date() }).returning();
        await deps.db.insert(deps.taskActivity).values({ id: deps.makeId("taskact"), taskId: created.id, actorUserId: access.session?.user.id, actorType: "user", action: "created", toValue: created.columnId, metadataJson: JSON.stringify({ boardId }), createdAt: new Date() });
        return deps.json(taskPayload(created), 201);
      }
      if (resource === "tasks" && resourceId && request.method === "GET") {
        const row = (await deps.db.select().from(deps.task).where(and(eq(deps.task.id, resourceId), eq(deps.task.boardId, boardId))).limit(1))[0];
        if (!row) return deps.json({ error: "Task not found" }, 404);
        const activity = await deps.db.select().from(deps.taskActivity).where(eq(deps.taskActivity.taskId, resourceId)).orderBy(desc(deps.taskActivity.createdAt));
        return deps.json({ task: taskPayload(row), activity });
      }
      if (resource === "tasks" && resourceId && parts[6] === "move" && request.method === "POST") {
        const body = await deps.parseBody(request, moveSchema);
        const current = (await deps.db.select().from(deps.task).where(and(eq(deps.task.id, resourceId), eq(deps.task.boardId, boardId))).limit(1))[0];
        if (!current) return deps.json({ error: "Task not found" }, 404);
        const column = (await deps.db.select().from(deps.boardColumn).where(and(eq(deps.boardColumn.id, body.columnId), eq(deps.boardColumn.boardId, boardId))).limit(1))[0];
        if (!column) return deps.json({ error: "Column not found on this board" }, 404);
        if (current.version !== body.version) {
          if (current.version === body.version + 1 && current.columnId === body.columnId && num(current.position) === body.position) return deps.json(taskPayload(current));
          return deps.json({ error: "Task was changed by another actor", current: taskPayload(current) }, 409);
        }
        const [updated] = await deps.db.update(deps.task).set({ columnId: body.columnId, position: String(body.position), status: column.key, version: current.version + 1, updatedAt: new Date(), completedAt: column.isTerminal ? new Date() : null }).where(and(eq(deps.task.id, resourceId), eq(deps.task.version, body.version))).returning();
        if (!updated) return deps.json({ error: "Task was changed by another actor" }, 409);
        await deps.db.insert(deps.taskActivity).values({ id: deps.makeId("taskact"), taskId: resourceId, actorUserId: access.session?.user.id, actorType: "user", action: "moved", fromValue: current.columnId, toValue: body.columnId, metadataJson: JSON.stringify({ fromPosition: num(current.position), toPosition: body.position, version: body.version }), createdAt: new Date() });
        return deps.json(taskPayload(updated));
      }
      if (resource === "tasks" && resourceId && request.method === "PATCH") {
        const body = await deps.parseBody(request, taskPatch);
        const current = (await deps.db.select().from(deps.task).where(and(eq(deps.task.id, resourceId), eq(deps.task.boardId, boardId))).limit(1))[0];
        if (!current) return deps.json({ error: "Task not found" }, 404);
        if (current.version !== body.version) return deps.json({ error: "Task was changed by another actor", current: taskPayload(current) }, 409);
        const { version: _version, position: _position, columnId: _columnId, ...fields } = body;
        const [updated] = await deps.db.update(deps.task).set({ ...fields, dueDate: fields.dueDate === undefined ? undefined : fields.dueDate ? new Date(fields.dueDate) : null, version: current.version + 1, updatedAt: new Date() }).where(and(eq(deps.task.id, resourceId), eq(deps.task.version, body.version))).returning();
        return deps.json(taskPayload(updated));
      }
      if (resource === "tasks" && resourceId && parts[6] === "links" && request.method === "POST") {
        const body = await deps.parseBody(request, linkSchema);
        const taskRow = (await deps.db.select().from(deps.task).where(and(eq(deps.task.id, resourceId), eq(deps.task.boardId, boardId))).limit(1))[0];
        if (!taskRow) return deps.json({ error: "Task not found" }, 404);
        const [link] = await deps.db.insert(deps.taskLink).values({ id: deps.makeId("tasklink"), taskId: resourceId, ...body }).onConflictDoNothing().returning();
        return deps.json(link ?? { ok: true });
      }
      return deps.json({ error: "Method not allowed" }, 405);
    } catch (error: any) {
      return deps.json({ error: error.message, issues: error.issues }, error.status ?? 500);
    }
  }
  return { handleAdmin };
}
