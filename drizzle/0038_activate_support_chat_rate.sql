UPDATE "token_feature_rate"
SET "active" = true,
    "updatedAt" = now()
WHERE "featureKey" = 'support_chat';
