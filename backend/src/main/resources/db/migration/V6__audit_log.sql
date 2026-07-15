CREATE TABLE pr_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    event VARCHAR(50) NOT NULL,
    operator VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON pr_audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON pr_audit_logs(created_at DESC);
