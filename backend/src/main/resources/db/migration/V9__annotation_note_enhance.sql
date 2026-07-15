-- 批注表：新增原文引用字段
ALTER TABLE pr_annotations ADD COLUMN IF NOT EXISTS quoted_text TEXT;
ALTER TABLE pr_annotations ADD COLUMN IF NOT EXISTS start_offset INTEGER;
ALTER TABLE pr_annotations ADD COLUMN IF NOT EXISTS end_offset INTEGER;
ALTER TABLE pr_annotations ADD COLUMN IF NOT EXISTS images TEXT;

-- 笔记表：新增原文引用字段 + 图片
ALTER TABLE pr_notes ADD COLUMN IF NOT EXISTS quoted_text TEXT;
ALTER TABLE pr_notes ADD COLUMN IF NOT EXISTS start_offset INTEGER;
ALTER TABLE pr_notes ADD COLUMN IF NOT EXISTS end_offset INTEGER;
ALTER TABLE pr_notes ADD COLUMN IF NOT EXISTS images TEXT;

-- 批注评论表
CREATE TABLE IF NOT EXISTS pr_annotation_comments (
    id BIGSERIAL PRIMARY KEY,
    annotation_id BIGINT NOT NULL REFERENCES pr_annotations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    content TEXT NOT NULL,
    parent_id BIGINT REFERENCES pr_annotation_comments(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_annotation_comments_aid ON pr_annotation_comments(annotation_id);
CREATE INDEX IF NOT EXISTS idx_annotation_comments_pid ON pr_annotation_comments(parent_id);
