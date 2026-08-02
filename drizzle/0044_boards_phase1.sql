CREATE TABLE IF NOT EXISTS board (
  id text PRIMARY KEY NOT NULL,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'custom',
  visibility text NOT NULL DEFAULT 'internal',
  "archivedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS board_column (
  id text PRIMARY KEY NOT NULL,
  "boardId" text NOT NULL REFERENCES board(id) ON DELETE CASCADE,
  name text NOT NULL,
  key text NOT NULL,
  position numeric(20,10) NOT NULL,
  "wipLimit" integer,
  "isTerminal" boolean NOT NULL DEFAULT false,
  "automationKey" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT board_column_board_key_unique UNIQUE ("boardId", key)
);

CREATE TABLE IF NOT EXISTS task (
  id text PRIMARY KEY NOT NULL,
  "boardId" text NOT NULL REFERENCES board(id) ON DELETE CASCADE,
  "columnId" text NOT NULL REFERENCES board_column(id),
  position numeric(20,10) NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  visibility text NOT NULL DEFAULT 'internal',
  "assigneeUserId" text REFERENCES "user"(id),
  "customerUserId" text REFERENCES "user"(id),
  "dueDate" timestamp,
  billable boolean NOT NULL DEFAULT false,
  "estimateMinutes" integer,
  "loggedMinutes" integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  "createdByUserId" text NOT NULL REFERENCES "user"(id),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "completedAt" timestamp
);

CREATE TABLE IF NOT EXISTS task_link (
  id text PRIMARY KEY NOT NULL,
  "taskId" text NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  "entityType" text NOT NULL,
  "entityId" text NOT NULL,
  CONSTRAINT task_link_entity_unique UNIQUE ("taskId", "entityType", "entityId")
);

CREATE TABLE IF NOT EXISTS task_label (
  id text PRIMARY KEY NOT NULL,
  "boardId" text NOT NULL REFERENCES board(id) ON DELETE CASCADE,
  name text NOT NULL,
  colour text NOT NULL,
  CONSTRAINT task_label_board_name_unique UNIQUE ("boardId", name)
);

CREATE TABLE IF NOT EXISTS task_label_map (
  "taskId" text NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  "labelId" text NOT NULL REFERENCES task_label(id) ON DELETE CASCADE,
  CONSTRAINT task_label_map_unique UNIQUE ("taskId", "labelId")
);

CREATE TABLE IF NOT EXISTS task_activity (
  id text PRIMARY KEY NOT NULL,
  "taskId" text NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  "actorUserId" text REFERENCES "user"(id),
  "actorType" text NOT NULL DEFAULT 'user',
  action text NOT NULL,
  "fromValue" text,
  "toValue" text,
  "metadataJson" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

INSERT INTO board (id, key, name, type, visibility)
VALUES ('board_operations', 'operations', 'Operations', 'ops', 'internal')
ON CONFLICT (key) DO NOTHING;

INSERT INTO board_column (id, "boardId", name, key, position, "isTerminal") VALUES
  ('boardcol_ops_inbox', 'board_operations', 'Inbox', 'inbox', 100, false),
  ('boardcol_ops_triage', 'board_operations', 'Triage', 'triage', 200, false),
  ('boardcol_ops_ready', 'board_operations', 'Ready', 'ready', 300, false),
  ('boardcol_ops_progress', 'board_operations', 'In progress', 'in_progress', 400, false),
  ('boardcol_ops_review', 'board_operations', 'Review', 'review', 500, false),
  ('boardcol_ops_blocked', 'board_operations', 'Blocked', 'blocked', 600, false),
  ('boardcol_ops_done', 'board_operations', 'Done', 'done', 700, true)
ON CONFLICT ("boardId", key) DO NOTHING;

CREATE INDEX IF NOT EXISTS board_column_board_position_idx ON board_column("boardId", position);
CREATE INDEX IF NOT EXISTS task_board_column_position_idx ON task("boardId", "columnId", position);
CREATE INDEX IF NOT EXISTS task_activity_task_created_idx ON task_activity("taskId", "createdAt");
