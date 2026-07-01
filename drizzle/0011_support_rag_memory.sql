CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "support_knowledge_source" (
  "id" text PRIMARY KEY,
  "userId" text REFERENCES "user"("id"),
  "sourceType" text NOT NULL,
  "title" text NOT NULL,
  "visibility" text NOT NULL DEFAULT 'customer',
  "status" text NOT NULL DEFAULT 'active',
  "metadata" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "support_knowledge_chunk" (
  "id" text PRIMARY KEY,
  "sourceId" text NOT NULL REFERENCES "support_knowledge_source"("id"),
  "userId" text REFERENCES "user"("id"),
  "chunkText" text NOT NULL,
  "embedding" vector(768) NOT NULL,
  "tokenEstimate" integer NOT NULL DEFAULT 0,
  "confidence" integer NOT NULL DEFAULT 70,
  "status" text NOT NULL DEFAULT 'active',
  "metadata" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "support_learning_event" (
  "id" text PRIMARY KEY,
  "userId" text REFERENCES "user"("id"),
  "sessionId" text REFERENCES "support_chat_session"("id"),
  "ticketId" text REFERENCES "support_ticket"("id"),
  "sourceId" text REFERENCES "support_knowledge_source"("id"),
  "eventType" text NOT NULL,
  "summary" text NOT NULL,
  "status" text NOT NULL DEFAULT 'stored',
  "metadata" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "support_knowledge_source_user_idx" ON "support_knowledge_source" ("userId");
CREATE INDEX IF NOT EXISTS "support_knowledge_source_status_idx" ON "support_knowledge_source" ("status", "visibility");
CREATE INDEX IF NOT EXISTS "support_knowledge_chunk_source_idx" ON "support_knowledge_chunk" ("sourceId");
CREATE INDEX IF NOT EXISTS "support_knowledge_chunk_user_idx" ON "support_knowledge_chunk" ("userId");
CREATE INDEX IF NOT EXISTS "support_knowledge_chunk_status_idx" ON "support_knowledge_chunk" ("status");
CREATE INDEX IF NOT EXISTS "support_knowledge_chunk_embedding_idx" ON "support_knowledge_chunk" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "support_learning_event_user_idx" ON "support_learning_event" ("userId");
