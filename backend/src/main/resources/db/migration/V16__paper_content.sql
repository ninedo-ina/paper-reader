-- REQ-202609-0257（W1 正文数据模型与持久化）：
-- 手动创建的论文此前只能编辑元数据，正文没有任何落库的地方 —— 编辑器把 abstractText
-- （摘要）当正文用，也没有保存接口，刷新即丢。这里给 pr_papers 补上正文列：
--   content_json    权威内容，编辑器序列化结果（保留节点结构，可无损还原）
--   content_html    派生内容，由 JSON 渲染，便于预览/导出，可随时重建
--   content_version 每次保存自增，供前端判断并发覆盖（后写覆盖需能察觉）
-- 正文与 abstractText 彻底分离：摘要仍然只由 PATCH 元数据接口维护。
-- 全部可空且无默认值，对已有行是元数据级变更（PG 11+ 不重写表），不需要回填。
ALTER TABLE pr_papers
    ADD COLUMN content_json TEXT,
    ADD COLUMN content_html TEXT,
    ADD COLUMN content_version INTEGER;
