ALTER TABLE pr_papers
    ADD COLUMN IF NOT EXISTS parse_status VARCHAR(20) NOT NULL DEFAULT 'NOT_APPLICABLE',
    ADD COLUMN IF NOT EXISTS parse_error TEXT;

ALTER TABLE pr_papers
    ALTER COLUMN grobid_result TYPE TEXT
    USING CASE
        WHEN grobid_result IS NULL THEN NULL
        WHEN jsonb_typeof(grobid_result) = 'string' THEN grobid_result #>> '{}'
        ELSE grobid_result::text
    END;

CREATE TABLE IF NOT EXISTS pr_paper_chunks (
    id BIGSERIAL PRIMARY KEY,
    paper_id BIGINT NOT NULL REFERENCES pr_papers(id) ON DELETE CASCADE,
    section_title VARCHAR(500),
    ordinal INTEGER NOT NULL,
    content TEXT NOT NULL,
    page_start INTEGER,
    page_end INTEGER,
    UNIQUE (paper_id, ordinal)
);

CREATE INDEX IF NOT EXISTS idx_pr_paper_chunks_paper_ordinal
    ON pr_paper_chunks (paper_id, ordinal);
