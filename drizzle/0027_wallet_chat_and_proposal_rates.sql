INSERT INTO "token_feature_rate" ("featureKey", "displayName", "baseTokenCost", "multiplierBps", "active", "notes")
VALUES
  ('support_chat', 'Customer support chat assistant', 40, 10000, true, 'AI assistant responses for customer support conversations'),
  ('admin_chat', 'Admin copilot chat assistant', 35, 10000, true, 'AI assistant responses for internal admin conversations'),
  ('proposal_generation', 'Proposal content generation', 30, 10000, true, 'Gemini-backed generation of proposal introductions, summaries, and terms')
ON CONFLICT ("featureKey") DO UPDATE
SET "displayName" = EXCLUDED."displayName",
    "baseTokenCost" = EXCLUDED."baseTokenCost",
    "multiplierBps" = EXCLUDED."multiplierBps",
    "active" = EXCLUDED."active",
    "notes" = EXCLUDED."notes",
    "updatedAt" = now();
