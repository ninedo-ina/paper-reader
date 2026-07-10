-- Add category, extra_fields, storage_config_id to pr_papers
ALTER TABLE pr_papers
    ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'JOURNAL',
    ADD COLUMN extra_fields JSONB,
    ADD COLUMN storage_config_id BIGINT;

-- Paper versions for manual publish tracking
CREATE TABLE pr_paper_versions (
    id BIGSERIAL PRIMARY KEY,
    paper_id BIGINT NOT NULL REFERENCES pr_papers(id),
    version VARCHAR(50) NOT NULL,
    remark TEXT,
    storage_push_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_paper_versions_paper_id ON pr_paper_versions(paper_id);

-- Storage configurations per user
CREATE TABLE pr_storage_configs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    name VARCHAR(200) NOT NULL,
    storage_type VARCHAR(20) NOT NULL,
    config JSONB NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_storage_configs_user_id ON pr_storage_configs(user_id);
