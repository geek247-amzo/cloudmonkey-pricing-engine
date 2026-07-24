UPDATE "token_feature_rate"
SET
  "active" = false,
  "notes" = 'Included CloudMonkey copilot usage; funded by the internal CloudMonkey API token',
  "updatedAt" = now()
WHERE "featureKey" IN ('support_chat', 'admin_chat');
