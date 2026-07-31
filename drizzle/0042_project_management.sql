ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "projectEligible" boolean NOT NULL DEFAULT false;
ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "projectTemplate" text;
UPDATE "service_plan" p SET "projectEligible" = true
FROM "service" s
WHERE p."serviceId" = s."id"
  AND lower(concat_ws(' ', s."name", p."name")) ~ '(website|ecommerce|build|development|managed it|hosting|cloud|voice|pbx|sip|microsoft|workspace|security|automation|ai agent|consult|strategy|seo|intelligence)';

CREATE TABLE IF NOT EXISTS "project" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id"),
  "subscriptionId" text REFERENCES "subscription"("id"),
  "planId" text REFERENCES "service_plan"("id"),
  "name" text NOT NULL,
  "serviceName" text NOT NULL,
  "template" text NOT NULL DEFAULT 'service-implementation',
  "description" text,
  "status" text NOT NULL DEFAULT 'planned',
  "priority" text NOT NULL DEFAULT 'medium',
  "startDate" timestamp DEFAULT now(),
  "targetDate" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "project_subscription_unique" ON "project" ("subscriptionId") WHERE "subscriptionId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "project_member" (
  "id" text PRIMARY KEY NOT NULL,
  "projectId" text NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES "user"("id"),
  "role" text NOT NULL DEFAULT 'member',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "project_member_project_user_unique" UNIQUE("projectId", "userId")
);
CREATE TABLE IF NOT EXISTS "project_milestone" (
  "id" text PRIMARY KEY NOT NULL,
  "projectId" text NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'not_started',
  "dueDate" timestamp,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "project_task" (
  "id" text PRIMARY KEY NOT NULL,
  "projectId" text NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "milestoneId" text REFERENCES "project_milestone"("id") ON DELETE SET NULL,
  "assignedToUserId" text REFERENCES "user"("id"),
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'backlog',
  "priority" text NOT NULL DEFAULT 'medium',
  "sortOrder" integer NOT NULL DEFAULT 0,
  "dueDate" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "project_deliverable" (
  "id" text PRIMARY KEY NOT NULL,
  "projectId" text NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "milestoneId" text REFERENCES "project_milestone"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'planned',
  "url" text,
  "approvedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "project_comment" (
  "id" text PRIMARY KEY NOT NULL,
  "projectId" text NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "taskId" text REFERENCES "project_task"("id") ON DELETE CASCADE,
  "authorUserId" text NOT NULL REFERENCES "user"("id"),
  "body" text NOT NULL,
  "isInternal" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "project_activity" (
  "id" text PRIMARY KEY NOT NULL,
  "projectId" text NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "actorUserId" text REFERENCES "user"("id"),
  "action" text NOT NULL,
  "message" text NOT NULL,
  "metadata" jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "user_notification" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "projectId" text REFERENCES "project"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "readAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "project_task_project_status_idx" ON "project_task" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "user_notification_user_created_idx" ON "user_notification" ("userId", "createdAt");
