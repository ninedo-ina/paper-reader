-- REQ-202609-0267（上传论文限制）：
-- 上传配额需要「单用户单日累计」「单用户累计」「全应用单日累计」三个口径的用量，
-- 这三个数都必须是可累加的历史事实，不能靠 pr_papers 现有行推——论文被删除后行就没了，
-- 删掉再传即可绕过限制。所以这里建一张只增不删的上传台账，每次成功落盘记一行：
--   user_id    上传者
--   paper_id   关联论文（故意不加外键：论文删除必须保留台账，否则删论文=退配额）
--   bytes      本次落盘字节数
--   created_at 记账时刻，单日口径按 Asia/Shanghai 自然日切分
-- 台账只增不减，所以「累计上传量 ≥ 当前存储量」恒成立，用它同时约束存储总量不会放过任何人。
CREATE TABLE pr_upload_records (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    paper_id BIGINT NOT NULL,
    bytes BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 用户维度：单用户单日 / 单用户累计（user_id 是前导列，两个查询共用）
CREATE INDEX idx_upload_records_user_created ON pr_upload_records(user_id, created_at);
-- 应用维度：全应用单日累计
CREATE INDEX idx_upload_records_created_at ON pr_upload_records(created_at);
