CREATE TABLE IF NOT EXISTS website_growth_agent (
  id text PRIMARY KEY NOT NULL,
  "websiteId" text NOT NULL REFERENCES website(id) ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  schedule text NOT NULL DEFAULT 'daily',
  "nextRunAt" timestamp NOT NULL DEFAULT now(),
  kpi text NOT NULL DEFAULT 'qualified_leads',
  "dailyBudgetTokens" integer NOT NULL DEFAULT 50000,
  "maxChangesPerRun" integer NOT NULL DEFAULT 10,
  "lastRunAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT website_growth_agent_website_unique UNIQUE ("websiteId")
);

CREATE TABLE IF NOT EXISTS website_growth_run (
  id text PRIMARY KEY NOT NULL,
  "agentId" text NOT NULL REFERENCES website_growth_agent(id) ON DELETE CASCADE,
  "websiteId" text NOT NULL REFERENCES website(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  "scheduledAt" timestamp NOT NULL DEFAULT now(),
  "claimedAt" timestamp,
  "heartbeatAt" timestamp,
  "completedAt" timestamp,
  error text,
  "proposalId" text,
  provider text,
  model text,
  "inputTokens" integer NOT NULL DEFAULT 0,
  "outputTokens" integer NOT NULL DEFAULT 0,
  "totalTokens" integer NOT NULL DEFAULT 0,
  "providerCostMicrousd" integer NOT NULL DEFAULT 0,
  "usageAvailable" boolean NOT NULL DEFAULT false,
  "metadataJson" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS website_growth_message (
  id text PRIMARY KEY NOT NULL,
  "agentId" text NOT NULL REFERENCES website_growth_agent(id) ON DELETE CASCADE,
  "websiteId" text NOT NULL REFERENCES website(id) ON DELETE CASCADE,
  "runId" text REFERENCES website_growth_run(id) ON DELETE SET NULL,
  "userId" text REFERENCES "user"(id) ON DELETE SET NULL,
  "senderRole" text NOT NULL,
  body text NOT NULL,
  "metadataJson" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS website_growth_proposal (
  id text PRIMARY KEY NOT NULL,
  "agentId" text NOT NULL REFERENCES website_growth_agent(id) ON DELETE CASCADE,
  "websiteId" text NOT NULL REFERENCES website(id) ON DELETE CASCADE,
  "runId" text NOT NULL REFERENCES website_growth_run(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text NOT NULL,
  "diffJson" text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  "decidedByUserId" text REFERENCES "user"(id) ON DELETE SET NULL,
  "decisionNote" text,
  "decidedAt" timestamp,
  "deploymentStatus" text NOT NULL DEFAULT 'not_started',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE platform_api_usage ADD COLUMN IF NOT EXISTS "growthAgentRunId" text REFERENCES website_growth_run(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS website_growth_run_due_idx ON website_growth_run(status, "scheduledAt");
CREATE INDEX IF NOT EXISTS website_growth_message_agent_idx ON website_growth_message("agentId", "createdAt");
CREATE INDEX IF NOT EXISTS website_growth_proposal_agent_idx ON website_growth_proposal("agentId", status);
