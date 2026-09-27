-- REQ-202609-0262（W6 版本历史与快照）：
-- 「写作是可回退的」需要一个按时间线可查、可对比、可回滚的正文快照。
-- 注意不要复用 pr_paper_versions：那张表的语义是「storage push 状态」（发布记录，
-- 带 version/remark/storage_push_status，用于推送到外部存储平台），它的行不承载正文，
-- 混入正文快照会让「发布记录」和「正文历史」两件事互相污染。故新建本表。
--
--   label            手动标签（「初稿」「投稿版」）；null 表示未打标签
--   source           快照来源：MANUAL（用户手动创建）/ ROLLBACK（回滚前自动留下的当前态）
--   content_version  快照时刻 pr_papers.content_version 的值，用于和正文版本号对齐
--   content_json     快照的权威正文（编辑器 JSON），与 pr_papers.content_json 同格式
--   content_html     快照的派生 HTML，便于找回无需重建
--   created_by       操作人（未来协作用；当前即论文所有者）
--
-- content_json 不加外键约束到 pr_papers，但 paper_id 保留 REFERENCES，删论文时由
-- PaperDeletionService 先按 paper_id 清理本表再删主行（与 pr_paper_versions 一致的做法）。
CREATE TABLE pr_paper_content_versions (
    id BIGSERIAL PRIMARY KEY,
    paper_id BIGINT NOT NULL REFERENCES pr_papers(id),
    label VARCHAR(100),
    source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    content_version INTEGER NOT NULL DEFAULT 0,
    content_json TEXT NOT NULL,
    content_html TEXT,
    created_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 时间线按「某篇论文 + 时间倒序」取，走这个复合索引。
CREATE INDEX idx_paper_content_versions_paper_time
    ON pr_paper_content_versions(paper_id, created_at DESC, id DESC);
