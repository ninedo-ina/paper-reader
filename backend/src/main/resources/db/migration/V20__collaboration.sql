-- REQ-202609-0263（W7 协作与分享）：多人协同写作 / 导师改稿 + 只读分享。
-- 本轮四张新表，全部以 paper_id 关联，随论文删除一起清除（PaperDeletionService 显式删 + 外键级联双保险）。
--
-- 设计要点（详见 docs/W7_COLLABORATION_TECHNICAL_SOLUTION.md）：
--   * 实时协同不引入独立的 Hocuspocus/Node 服务，而是复用现有 Spring STOMP /ws 通道
--     （已被 Apache 反代、无需新基础设施）中转 Yjs 更新，服务端不解析 CRDT，只做鉴权中转 + 全量快照持久化。
--   * participants 仍是自由文本署名，不做身份判定；真正能读写的协作者落在 pr_paper_collaborators。

-- 结构化协作者：把某个真实注册用户授予某篇论文的读写/只读权限。
-- 论文作者（pr_papers.user_id）是隐式 EDITOR，不落这张表。
CREATE TABLE pr_paper_collaborators (
    id BIGSERIAL PRIMARY KEY,
    paper_id BIGINT NOT NULL REFERENCES pr_papers(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES pr_users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,          -- EDITOR | VIEWER
    created_by BIGINT NOT NULL,         -- 添加该协作者的作者
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(paper_id, user_id)
);
CREATE INDEX idx_paper_collaborators_paper ON pr_paper_collaborators(paper_id);
CREATE INDEX idx_paper_collaborators_user ON pr_paper_collaborators(user_id);

-- Yjs 文档全量状态。服务端把它当不透明 base64 存储，不解析 CRDT。
-- 每篇论文一行（paper_id 即主键）：新加入的客户端先拉这份状态还原文档，再接实时增量。
-- 首次协作由「谁先抢到插入谁为准」（应用层 seed-if-absent），此后按最后写入者覆盖（LWW），
-- 因为并发方经 Yjs 已收敛，各自的全量快照等价。
CREATE TABLE pr_paper_collab_state (
    paper_id BIGINT PRIMARY KEY REFERENCES pr_papers(id) ON DELETE CASCADE,
    state TEXT NOT NULL,                -- base64(Y.encodeStateAsUpdate(doc))
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 只读分享链接。凭 token 免登录读取论文正文（只读），供没有账号的导师/合作者查看。
-- role 预留 EDITOR 以便将来做"可编辑邀请链接"，本轮只签发 VIEWER。
CREATE TABLE pr_paper_shares (
    id BIGSERIAL PRIMARY KEY,
    paper_id BIGINT NOT NULL REFERENCES pr_papers(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'VIEWER',
    created_by BIGINT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,     -- 空 = 永不过期
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paper_shares_paper ON pr_paper_shares(paper_id);

-- 稿件批注/评论（区别于 pr_annotation_comments：那是 PDF 阅读标注下的回复；这是编辑器正文里的批注）。
-- anchor 是编辑器里 comment 标记的 id，quote 是被批注的原文片段（供上下文展示，锚点失效时仍可读）。
CREATE TABLE pr_paper_comments (
    id BIGSERIAL PRIMARY KEY,
    paper_id BIGINT NOT NULL REFERENCES pr_papers(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES pr_users(id) ON DELETE CASCADE,
    anchor VARCHAR(64),                 -- 编辑器 comment 标记 id；无锚点的整篇评论为空
    quote TEXT,                         -- 被批注的原文片段
    body TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paper_comments_paper ON pr_paper_comments(paper_id);
