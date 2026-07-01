CREATE TABLE IF NOT EXISTS "support_chat_attachment" (
  "id" text PRIMARY KEY,
  "sessionId" text NOT NULL REFERENCES "support_chat_session"("id"),
  "messageId" text REFERENCES "support_chat_message"("id"),
  "userId" text NOT NULL REFERENCES "user"("id"),
  "kind" text NOT NULL,
  "mimeType" text NOT NULL,
  "fileName" text NOT NULL,
  "sizeBytes" integer NOT NULL,
  "storagePath" text NOT NULL,
  "transcript" text,
  "metadata" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

