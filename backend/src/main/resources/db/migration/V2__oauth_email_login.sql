ALTER TABLE pr_users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE pr_users ADD COLUMN github_id BIGINT UNIQUE;
ALTER TABLE pr_users ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'local';
CREATE INDEX idx_users_github_id ON pr_users(github_id);
