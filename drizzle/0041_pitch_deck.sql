CREATE TABLE IF NOT EXISTS "pitch_deck" (
  "id" text PRIMARY KEY NOT NULL,
  "customerUserId" text,
  "leadId" text,
  "createdByUserId" text,
  "slug" text NOT NULL,
  "publicToken" text NOT NULL,
  "title" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "content" text NOT NULL,
  "publishedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "pitch_deck_slug_unique" UNIQUE("slug"),
  CONSTRAINT "pitch_deck_public_token_unique" UNIQUE("publicToken"),
  CONSTRAINT "pitch_deck_customer_user_fk" FOREIGN KEY ("customerUserId") REFERENCES "user"("id") ON DELETE set null,
  CONSTRAINT "pitch_deck_lead_fk" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE set null,
  CONSTRAINT "pitch_deck_created_by_fk" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE set null
);
