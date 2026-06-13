CREATE TABLE IF NOT EXISTS "LoginAttempt" (
  "key"          TEXT PRIMARY KEY,
  "count"        INTEGER NOT NULL DEFAULT 0,
  "firstAt"      BIGINT NOT NULL DEFAULT 0,
  "blockedUntil" BIGINT NOT NULL DEFAULT 0,
  "updatedAt"    BIGINT NOT NULL DEFAULT 0
);
