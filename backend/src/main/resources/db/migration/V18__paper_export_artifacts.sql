-- REQ-202609-0261（W5 导入、导出与投稿）：
-- 服务端把论文正文导出成 Markdown / HTML / LaTeX / BibTeX / DOCX / PDF 后，产物需要
-- 「回挂」到已有的版本记录（pr_paper_versions / PublishDialog），而不是另起一套版本系统。
-- 这里新增一张 pr_paper_versions 的子表来登记每次导出的产物：
--   version_id      可空外键 → pr_paper_versions；发布版本导出时挂到对应版本行，
--                   草稿（当前正文）导出时为空。删除版本不删产物，仅置空（SET NULL）。
--   format          导出格式：markdown/html/latex/bibtex/docx/pdf
--   engine          实际使用的引擎（pandoc / typst），便于排查保真度问题
--   file_path       产物落盘的相对路径（相对 app.export.output-dir），供二次下载
--   byte_size       产物字节数
--   content_version 导出时论文的 content_version 快照（当前正文的版本号，非发布版本号）
--   status          success / failed
-- 注意：本表登记的是「导出产物」，不是正文快照（正文快照属 W6，另建表）。
-- 论文删除时子表随 pr_papers 级联清除（PaperDeletionService 另负责删磁盘文件）。
CREATE TABLE pr_paper_export_artifacts (
    id BIGSERIAL PRIMARY KEY,
    paper_id BIGINT NOT NULL REFERENCES pr_papers(id) ON DELETE CASCADE,
    version_id BIGINT REFERENCES pr_paper_versions(id) ON DELETE SET NULL,
    format VARCHAR(20) NOT NULL,
    engine VARCHAR(40),
    file_path VARCHAR(500),
    byte_size BIGINT,
    content_version INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_export_artifacts_paper_id ON pr_paper_export_artifacts(paper_id);
CREATE INDEX idx_export_artifacts_version_id ON pr_paper_export_artifacts(version_id);
