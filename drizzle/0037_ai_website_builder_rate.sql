INSERT INTO "token_feature_rate" ("featureKey", "displayName", "baseTokenCost", "multiplierBps", "active", "notes")
VALUES ('ai_website_builder', 'AI website builder generation', 5000, 10000, true, 'Estimated reservation; final wallet settlement uses actual Anthropic token usage plus platform markup.')
ON CONFLICT ("featureKey") DO UPDATE SET "displayName" = EXCLUDED."displayName", "notes" = EXCLUDED."notes", "updatedAt" = now();
