CREATE TABLE IF NOT EXISTS "pitch_deck_audio" (
  "id" text PRIMARY KEY NOT NULL,
  "pitchDeckId" text NOT NULL REFERENCES "pitch_deck"("id") ON DELETE CASCADE,
  "slideId" text NOT NULL,
  "audioData" text NOT NULL,
  "mimeType" text NOT NULL DEFAULT 'audio/wav',
  "provider" text NOT NULL DEFAULT 'gemini',
  "model" text NOT NULL,
  "voice" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "pitch_deck_audio_deck_slide_unique" UNIQUE ("pitchDeckId", "slideId")
);

ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "engagementCode" text;
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "billingCostCentre" text;
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "contractingEntity" text;
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "dataBoundary" text;

CREATE INDEX IF NOT EXISTS "pitch_deck_audio_deck_idx" ON "pitch_deck_audio" ("pitchDeckId");
CREATE INDEX IF NOT EXISTS "project_engagement_code_idx" ON "project" ("engagementCode");
