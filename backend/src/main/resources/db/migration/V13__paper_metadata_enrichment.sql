-- External metadata enrichment snapshots are deliberately separate from the
-- paper row. A preview can expire without changing user-owned metadata.
CREATE TABLE pr_paper_metadata_resolutions (
    id BIGSERIAL PRIMARY KEY,
    paper_id BIGINT NOT NULL REFERENCES pr_papers(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES pr_users(id) ON DELETE CASCADE,
    expected_updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'READY',
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_paper_metadata_resolutions_owner
    ON pr_paper_metadata_resolutions (paper_id, user_id, created_at DESC);

CREATE TABLE pr_paper_metadata_sources (
    id BIGSERIAL PRIMARY KEY,
    paper_id BIGINT NOT NULL REFERENCES pr_papers(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES pr_users(id) ON DELETE CASCADE,
    resolution_id BIGINT REFERENCES pr_paper_metadata_resolutions(id) ON DELETE SET NULL,
    provider VARCHAR(40) NOT NULL,
    external_id VARCHAR(500),
    record_url VARCHAR(1000),
    match_method VARCHAR(40) NOT NULL,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    error_code VARCHAR(80),
    payload JSONB,
    fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_paper_metadata_sources_paper
    ON pr_paper_metadata_sources (paper_id, fetched_at DESC);

CREATE TABLE pr_paper_metadata_field_provenance (
    id BIGSERIAL PRIMARY KEY,
    paper_id BIGINT NOT NULL REFERENCES pr_papers(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES pr_users(id) ON DELETE CASCADE,
    resolution_id BIGINT REFERENCES pr_paper_metadata_resolutions(id) ON DELETE SET NULL,
    field_name VARCHAR(120) NOT NULL,
    value_text TEXT NOT NULL,
    provider VARCHAR(40) NOT NULL,
    record_url VARCHAR(1000),
    match_method VARCHAR(40) NOT NULL,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    user_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_paper_metadata_provenance_paper
    ON pr_paper_metadata_field_provenance (paper_id, field_name, applied_at DESC);
