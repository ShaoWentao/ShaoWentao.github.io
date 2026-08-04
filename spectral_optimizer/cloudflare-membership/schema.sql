CREATE TABLE IF NOT EXISTS memberships (
    email TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'professional',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memberships_status_expiry
ON memberships(status, expires_at);
