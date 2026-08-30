# PaperHelper 外部论文元数据补全方案

> 方案版本：v0.1.23（已部署；单篇最小闭环已完成线上验收）
> 编写及核对日期：2026-08-26（UTC）
> 示例论文：arXiv `1706.03762`，*Attention Is All You Need*

## 1. 背景与目标

PaperHelper 当前主要依赖 GROBID 从 PDF 中提取标题、作者、摘要、DOI、年份和期刊/会议名称。PDF 首页、文件元数据和 GROBID 结果可能缺失、过时或混入机构名，卷号、期号、出版页码、出版社、ISSN/ISBN、预印本编号等字段也没有稳定来源。

本方案建立一条可追溯的补全链路：

```text
导入 URL / PDF / 已有 GROBID TEI
  -> 提取 DOI、arXiv ID 等直接标识
  -> 使用直接标识精确查询权威数据源
  -> 必要时查询正式发表版本
  -> 生成逐字段候选、来源和冲突
  -> 用户预览确认
  -> 默认只填空值并记录来源
```

目标：

- 对上传、URL 导入和已有论文统一识别 DOI、arXiv ID 等稳定标识。
- 使用 arXiv 官方接口补全预印本元数据和版本信息。
- 使用 DOI 注册机构、出版社/会议站和领域书目源补充正式发表信息。
- 严格区分预印本、正式发表版本、PDF 物理页数和出版页码。
- 所有自动值可解释、可预览、可拒绝，不静默覆盖人工数据。
- 为后续批量补全留出缓存、限流、幂等和来源审计能力。

本方案不把“搜到相同标题”视为唯一论文证明，也不承诺仅靠公开接口自动判定 SCI、EI、SSCI、CSSCI 或北大核心等收录状态。

## 1.1 当前实现核对（2026-08-26 UTC）

本文件同时记录目标设计和当前实现状态，不能把目标模型误读为已完成能力。`feature/v0.1.23` 已按 `feature -> dev -> main` 流程合并并部署生产，当前已上线：

- Reader 论文信息面板的手动“补全/刷新元数据”入口，以及 arXiv ID/DOI 可选输入。
- `POST /api/papers/{id}/metadata/resolve`、resolution 查询、候选 apply 和来源查询四个接口。
- arXiv Atom 精确查询、DataCite/Crossref 精确 DOI 查询；进程内成功/失败缓存、arXiv 三秒节流和安全 XML 大小限制。
- 逐字段候选、当前值、来源、置信度、冲突和默认选择；默认只填空字段，正式版本候选不默认选择。
- Flyway V13 的短期 resolution、source snapshot、field provenance 三张表，均按论文/用户级联删除。
- GROBID 保存结果时只填空字段，不覆盖已有非空人工值。

当前尚未完成或不应宣称完成：

- 完整 `manifestation`、多标识 `identifier` 和 preferred manifestation 数据模型；V13 不是该模型的替代品。
- arXiv OAI-PMH、分布式缓存/限流、退避和后台批量任务。当前已有用户显式刷新时触发的严格 DBLP 标题+第一作者候选，并排除 CoRR；它只生成默认不勾选的候选。
- 历史论文批量刷新，以及自动判断 SCI/EI/SSCI/CSSCI/北大核心。

本轮已完成生产迁移与部署；生产版本为 `0.1.23`。发布过程未批量修改既有论文数据，历史论文批量刷新仍不在范围内。

## 2. Attention 示例核对结果

### 2.1 arXiv 预印本记录

| 字段 | 值 | 说明 |
| --- | --- | --- |
| arXiv ID | `1706.03762` | arXiv 预印本记录的稳定标识 |
| 当前版本 | `v7` | arXiv 第 7 个修订版本，不是卷号 |
| 首次提交 | `2017-06-12T17:57:34Z` | Atom `published` / Raw v1 |
| 最后修订 | `2023-08-02T00:41:18Z` | Atom `updated` / Raw v7 |
| 主分类 | `cs.CL` | Computation and Language |
| 其他分类 | `cs.LG` | Machine Learning |
| 说明 | `15 pages, 5 figures` | 预印本备注，不是出版页码 |
| arXiv DOI | `10.48550/arXiv.1706.03762` | arXiv 页面展示、DataCite 注册的仓储 DOI，不是正式出版 DOI |

arXiv 还能提供标题、八位作者、摘要、许可、abs/PDF 地址和版本历史。此条记录没有 `journal-ref`、正式出版 DOI、卷期页或作者单位，因此这些字段不能从 arXiv 猜测。Atom 响应本身也没有返回 `10.48550` DOI；实现时应通过规范 arXiv ID 对 DataCite 做精确校验后再保存，不能只拼接字符串并假定 DOI 一定存在。

### 2.2 正式会议记录

NeurIPS 官方页面与 DBLP 记录给出：

| 字段 | 值 |
| --- | --- |
| 发表类型 | Conference paper |
| 会议/载体 | Advances in Neural Information Processing Systems |
| 会议年份 | NIPS/NeurIPS 2017 |
| 卷号 | `30` |
| 期号 | 无；会议论文没有期号是正常结果 |
| 出版页码 | `5998–6008` |
| 出版者 | Curran Associates, Inc. |
| 正式出版 DOI | 未发现，不填写、不猜测 |

这说明一篇论文可能同时有“arXiv 预印本记录”和“会议正式发表记录”。两个记录的标识、日期、版本和字段角色必须分开保存。

### 2.3 已验证的数据污染风险

按标题和作者模糊搜索 Crossref 时，当前可命中多个 2025 年的同名异常 DOI；OpenAlex 也可能把这些记录与真实的卷 30、页码 5998–6008 混合聚合。因此：

- 标题搜索结果只能作为候选，不能自动写入 DOI。
- 新增正式 DOI 必须有直接标识关系、官方页面，或至少两个相互独立的可信来源交叉确认。
- 聚合源之间可能复用相同上游数据，不能把“三个聚合源一致”机械视为三个独立证据。

## 3. 当前项目差距与已落地部分

以下清单区分“当前开发分支已落地的最小闭环”和“目标设计仍待后续迁移”。目标设计中的完整模型不能作为当前数据库结构使用。

### 3.1 数据结构

`pr_papers` 已有正式列：

- `title`、`authors`、`abstract_text`
- `doi`、`year`、`journal`
- `category`、`extra_fields`
- `source_type`、`source_url`
- `page_count`、`grobid_result`、解析状态

仍存在以下差距：

- 没有 arXiv ID、arXiv 版本、仓储 DOI、出版类型、出版社、卷、期、出版页码、文章号、ISSN/ISBN、正式发表日期等规范字段。
- 已有字段级 provenance 和可复核的短期补全 resolution 存储，但还没有把同一研究工作的预印本、会议版和期刊版分开的 manifestation 记录。
- 现有 `pr_paper_versions` 用于手工版本发布/外部存储推送状态，不是学术出版版本表，不能复用来保存 arXiv v7、会议版或期刊版。
- `extra_fields.journalName` 与正式列 `journal` 重复，形成双数据源。
- `extra_fields.volume/issue/pages/issnIsbn/indexing` 只在部分前端表单中使用，列表与通用出版信息读取不到。
- `page_count` 是 PDF 物理页数，不能承载 `5998–6008` 这类出版页码。
- `issnIsbn` 混合两种标识；`indexing` 是单选值，但真实收录可能多选、带年份和来源。
- 后端 `year` 是字符串，前端详情类型却声明为数字，类型不一致。
- `extraFields` 更新是整包替换；分类切换还可能清空 JSON，不能把结构化外部快照直接塞进去。

### 3.2 现有提取链路

GROBID 当前只消费标题、作者、摘要、DOI、年份、期刊/会议名称和 PDF 页数。元数据补全服务可以从论文 URL、现有 DOI 和 GROBID XML 文本识别 arXiv/DOI，并在预览中提出扩展字段；TEI 中的卷期页等尚未进入独立 manifestation 结构。解析成功后当前已改为只填空字段，不覆盖已有非空值；外部补全仍通过 `expectedUpdatedAt` 防止过期快照覆盖并发修改。

URL 导入当前假定目标 URL 直接返回 PDF。`https://arxiv.org/abs/...` 返回 HTML，不能直接复用现有下载逻辑；后续必须识别 arXiv 页面并转换成受信任的 PDF URL，同时校验 Content-Type、文件头、大小和重定向目标。

## 4. 元数据概念模型

### 4.1 必须区分的概念

- `sourceType`：PaperHelper 如何得到记录，现有值为 UPLOAD / URL / MANUAL。
- `paper/work`：用户库中“这篇研究工作”的阅读记录、文件、批注和人工展示信息。
- `manifestation`：同一研究工作的具体公开形态，例如 arXiv 预印本、accepted manuscript、会议版或期刊正式版。
- `publicationType`：具体形态的载体类型，例如 REPOSITORY_RECORD / JOURNAL_ARTICLE / CONFERENCE_PAPER。
- `pageCount`：当前 PDF 文件物理页数。
- `publicationPages`：正式出版页码范围或文章号。
- `arxivVersion`：arXiv 修订版本，例如 `7`。
- `volume`：期刊或会议论文集卷号，例如 `30`。
- `repositoryDoi`：仓储/预印本 DOI，例如 `10.48550/arXiv.1706.03762`。
- `publicationDoi`：出版社正式版本 DOI；兼容改造完成后，现有 `doi` 展示字段只投影已验证的此类标识，迁移前旧值仍需逐条判定角色。

### 4.2 Work 与 manifestation 分层

不能只在 `pr_papers` 上增加一套扁平的卷期页字段。同一篇工作可能同时存在 arXiv v7 和 NeurIPS 正式版；如果共用一套日期、DOI、版本和 venue 字段，后写入的数据必然覆盖先前记录。

`pr_papers` 继续代表用户拥有的阅读记录，保留文件、解析状态、收藏、分类和人工展示字段。建议新增 `pr_paper_manifestations` 表保存具体版本：

```text
id
paper_id                    FK -> pr_papers ON DELETE CASCADE
manifestation_type          PREPRINT / ACCEPTED_MANUSCRIPT / VERSION_OF_RECORD
publication_type            REPOSITORY_RECORD / CONFERENCE_PAPER / JOURNAL_ARTICLE / ...
title
authors_json
abstract_text
version_label               例如 arXiv v7
first_submitted_at
last_revised_at
publication_date
venue_name
venue_type                  REPOSITORY / CONFERENCE / JOURNAL / BOOK_SERIES
publisher
year
volume
issue
publication_pages
article_number
journal_reference
license_url
is_preferred
created_at / updated_at
```

预印本记录使用 `version_label`、提交/修订时间和仓储信息；正式版使用 venue、出版日期、卷期页等字段。不适用于某一形态的字段保持为空，不能从另一形态复制。`volume`、`issue`、`publication_pages` 和 `article_number` 均使用字符串，兼容 `S1`、`Spring`、`e12345` 等非整数值。

`is_preferred` 只能有一个有效首选记录；实施时应为每个 `paper_id` 建 `WHERE is_preferred = TRUE` 的部分唯一索引，并在应用层用事务保护切换。若用户尚未选择，所有 manifestation 都保留原始角色，兼容投影不得擅自把预印本当成正式版。

兼容期内，`pr_papers.title/authors/abstract_text/year/journal/doi` 作为旧 API 和列表页的展示投影：人工值优先，其次读取用户选择的 preferred manifestation。旧 `extra_fields` 仍可读但停止新增双写；完成前后端切换和线上审计后，再单独迁移或移除旧键。

### 4.3 多标识与旧 DOI 迁移

标识不建议继续堆在一个 DOI 字段中。建议新增 `pr_paper_identifiers`：

```text
id
paper_id               FK -> pr_papers ON DELETE CASCADE
manifestation_id       可空 FK -> pr_paper_manifestations ON DELETE CASCADE
identifier_scope       WORK / MANIFESTATION / VENUE
identifier_type        ARXIV / DOI / PMID / PMCID / DBLP / ACL / ...
identifier_role        PREPRINT / REPOSITORY / PUBLICATION / EXTERNAL / UNCLASSIFIED
identifier_value       原始展示值
normalized_value       规范化比较值
source                  值来自哪个 Provider
verified_at
created_at
```

对有 manifestation 的标识，至少建立 `(paper_id, manifestation_id, identifier_type, identifier_role, normalized_value)` 唯一约束；对 `manifestation_id IS NULL` 的 work 级标识另建部分唯一索引，不能依赖 PostgreSQL 对 NULL 的默认唯一语义。跨用户不能简单全局唯一，因为不同用户可以收藏同一论文；未来去重约束需按产品语义另行设计。ISSN、eISSN、ISBN 等 venue 标识也应结构化保存并标注 scope，不能继续混在 `issnIsbn` 字符串中。

arXiv ID、仓储 DOI、正式出版 DOI 默认都属于具体 manifestation；只有真正跨版本稳定的内部 work 标识才使用 WORK scope。不能因为 arXiv ID 很稳定就把它误当成所有正式版本共享的出版标识。

现有 `pr_papers.doi` 不能不经审计就批量认定为正式出版 DOI：`10.48550/arXiv.*` 应归为 REPOSITORY，已精确核验的出版社 DOI 归为 PUBLICATION，无法确定角色的旧值先标为 UNCLASSIFIED 并保留原值。只有已验证的 publication DOI 才能投影回兼容字段；迁移不得静默丢失现有 DOI。

多值分类、作者结构和来源也应保留结构化形式，不拼成不可解析字符串。为兼容当前 UI，可以先由 DTO 生成旧的逗号分隔作者字符串。

### 4.4 来源、候选与字段级溯源

建议新增 `pr_paper_metadata_sources`，记录一次解析/查询的规范化快照，而不是把第三方原始大对象写入 `extra_fields`：

```text
id
paper_id               FK -> pr_papers ON DELETE CASCADE
manifestation_id       可空 FK -> pr_paper_manifestations ON DELETE CASCADE
provider                GROBID / ARXIV / DATACITE / CROSSREF / DBLP / ...
external_id
record_url
match_method            EXACT_ID / EXPLICIT_RELATION / FUZZY_SEARCH / USER_SELECTED
confidence
fetched_at
normalized_payload      经过大小限制和字段白名单的 JSONB
status / error_code
```

仅保存 source snapshot 还不能回答“当前卷号到底来自哪里”。建议再增加 `pr_paper_field_provenance`，在字段被应用时记录 target、field name、value hash/受限值、source、匹配方式、置信度、是否经用户确认、应用与被替代时间。候选中的每个字段同时携带 `source`、`confidence`、`currentValue`、`suggestedValue` 和 `conflict`，以支持预览及逐字段选择。

当前实现使用短期的 `pr_paper_metadata_resolutions`（保存用户、paper、候选快照、expectedUpdatedAt、状态和过期时间）复核候选没有被客户端篡改；后续若改为 manifestation apply，仍必须保留同等的快照/签名校验，不能只把候选放在浏览器后直接接受回传值。

不得在快照或字段溯源中保存用户 PDF 正文、完整 Prompt、认证信息或第三方 API Key。展示值变化时保留被替代记录，不把 provenance 覆盖成“最后一个 Provider”。

## 5. 标识提取与归一化

### 5.1 提取顺序

1. 用户输入的 DOI、arXiv ID 或导入 URL。
2. PDF 文件名、PDF Info/XMP。
3. GROBID TEI header 的明确标识字段。
4. PDF 首页可验证的 DOI/arXiv 标识。

不要从全文参考文献中取“第一个 DOI”，否则很容易把被引用论文识别为当前论文。

### 5.2 arXiv 归一化

需要支持：

- `1706.03762`
- `1706.03762v7`
- `arXiv:1706.03762v7`
- `https://arxiv.org/abs/1706.03762`
- `https://arxiv.org/pdf/1706.03762v7.pdf`
- `https://doi.org/10.48550/arXiv.1706.03762`
- 2007 年以前的旧式 ID，例如 `hep-th/9901001v2`

规范化后分别保存基础 ID 和版本号。无版本 URL 表示“当前最新版本”，不能固定解释为查询时的 vN。

### 5.3 DOI 归一化

- 去除 `doi:`、`https://doi.org/`、URL 编码、空白和尾部标点。
- 比较时不区分大小写，展示时保留规范字符串。
- 先通过 DOI 注册机构确定查询 DataCite 还是 Crossref。
- 即使 DOI 可解析，也要核对返回标题与作者，防止 PDF 首页或 TEI 取到勘误、补充材料或引用 DOI。

## 6. 数据源与字段裁决

| 优先级 | 数据源 | 主要用途 | 自动写入条件 |
| --- | --- | --- | --- |
| 1 | arXiv Atom API | 精确 arXiv ID、标题、作者、摘要、日期、分类、comment、链接 | 精确 ID 且与本地标题/作者无明显冲突 |
| 1 | Crossref / DataCite 精确 DOI | DOI 注册元数据、正式/仓储 DOI 角色 | 精确 DOI，返回对象校验通过 |
| 1 | 出版社或会议官方站 | 正式 venue、卷期页、出版社 | 固定允许域名上的明确官方记录或显式版本关系 |
| 2 | arXiv OAI-PMH | license、journal-ref、report-no、版本历史、批量增量同步 | 精确 arXiv ID |
| 2 | DBLP 精确 ID / Europe PMC 等领域源 | 领域内正式书目信息和版本关联 | 精确领域 ID 或高可信交叉确认 |
| 3 | DBLP 标题候选 / Semantic Scholar | arXiv 到正式版本的候选桥接 | 用户主动触发；只生成候选，选择后仍需官方记录核对 |
| 3 | OpenAlex | 候选发现、主题、OA 位置辅助 | 只生成候选，不单独覆盖 DOI/年份 |
| 4 | 标题/作者模糊搜索 | 没有任何直接标识时找候选 | 永不静默应用，必须用户选择 |

Unpaywall 仅在已有 DOI 时补充开放获取状态和合法全文位置，不用于论文身份识别，也不作为卷期页主来源。

### 6.1 字段来源边界

| 字段 | arXiv | DataCite/Crossref 精确 DOI | 官方 proceedings / 领域书目源 | 模糊聚合源 |
| --- | --- | --- | --- | --- |
| 标题、作者、摘要 | 预印本记录 | DOI 对应记录 | 正式版本记录 | 仅候选和交叉核对 |
| arXiv ID、版本、首投/修订时间、分类、许可 | 主要来源 | 可通过关联标识核对 | 通常不提供 | 不作为主来源 |
| 正式 venue、卷、期、出版页 | 通常不提供；`journal-ref` 也需核验 | 已知正式 DOI 时可提供 | 主要来源 | 不能单独写入 |
| 仓储 DOI `10.48550/arXiv.*` | 页面可能展示 | DataCite 精确记录 | 通常不提供 | 不能从标题猜测 |
| 正式出版 DOI | 通常不提供 | 已知 DOI 时精确查询 | 官方页面可能提供 | 标题命中不足以确认 |
| SCI/EI/SSCI/CSSCI/北大核心 | 不提供 | 不提供 | 不等于收录证明 | 不提供可靠证明 |

因此，*Attention Is All You Need* 的卷 `30`、页 `5998–6008` 只能来自 NeurIPS 官方记录或 DBLP 等领域书目源；不能把 arXiv 的 `v7` 或 `15 pages` 映射到这些字段。该 arXiv 记录本身也没有 NeurIPS/DBLP 的直接关联，首期必须通过用户主动触发的正式版本候选搜索建立关系，用户选中候选后再读取固定允许的官方 proceedings 或 DBLP 精确记录。DBLP 结果保留其书目来源身份，不冒充出版社官方数据。

### 6.2 arXiv 接口选择

单篇在线查询优先：

```text
https://export.arxiv.org/api/query?id_list=1706.03762
```

该 Atom 接口返回当前版本、标题、作者、摘要、首次提交/最后更新时间、分类、comment 和链接。需要许可、自由文本 `journal-ref` 或版本历史时，再分别请求 `arXiv` 和 `arXivRaw`：

```text
https://oaipmh.arxiv.org/oai?verb=GetRecord
  &identifier=oai:arXiv.org:1706.03762
  &metadataPrefix=arXiv

https://oaipmh.arxiv.org/oai?verb=GetRecord
  &identifier=oai:arXiv.org:1706.03762
  &metadataPrefix=arXivRaw
```

常规流程不解析 arXiv HTML；HTML citation meta 只作为人工排障或受控故障兜底。

## 7. 匹配、置信度与合并规则

### 7.1 精确标识匹配

精确 ID 查询也要做最低一致性校验：

- 规范化标题不能完全不相关。
- 第一作者或主要作者集合应有交集。
- 年份冲突时，要确认是否属于预印本与正式版本差异。

校验失败时返回冲突，不自动应用。

### 7.2 无标识的候选搜索

本地评分建议以标题、作者、年份、venue/摘要指纹组合计算：

- 标题权重约 50%。
- 作者集合与第一作者约 25%。
- 年份约 15%。
- venue、摘要指纹约 10%。

初始阈值：

- 标题相似度低于 0.95 不自动选择。
- 第一作者不一致时拒绝自动选择。
- 第一、第二候选分差小于 0.10 时必须人工确认。
- 总分 0.93 以上且无硬冲突，才可标为“高置信候选”；仍只默认填空。
- 0.75–0.93 仅展示候选；低于 0.75 不建议。
- 新增 `publicationDoi` 时，即使总分高，也要求显式标识关系、官方记录或两个可信来源交叉确认。

阈值必须通过真实正负样例测试后再固化，不能只用 Attention 单一样例调参。

### 7.3 写入策略

默认策略为 `FILL_MISSING`：

- 空字段可以由已确认的高可信候选补齐。
- 用户手工填写的非空字段永不静默覆盖。
- 外部值与现值冲突时，在预览中并列展示并默认不勾选。
- 用户可逐字段选择应用建议值。
- 多次执行必须幂等，相同候选不得重复生成标识或来源记录。
- 写入时携带 `expectedUpdatedAt` 或版本号；论文已被其他操作更新时要求重新预览。
- 外部补全与 GROBID 解析使用字段级合并，不能用整行 `copy` 或整包 `extraFields` 覆盖。

来源优先级应按字段裁决，而不是选一条“全局最佳记录”。例如 arXiv 负责预印本提交日期，NeurIPS 官方站负责正式卷页，人工确认值优先于两者。

## 8. 后端设计

### 8.1 组件边界

```text
MetadataIdentifierExtractor
  -> DOI / arXiv 规范化与候选标识

MetadataProvider
  -> ArxivProvider
  -> DataciteProvider
  -> CrossrefProvider
  -> ProceedingsProvider（固定官方来源适配器）
  -> DblpProvider（领域书目核对）
  -> SemanticScholarProvider / OpenAlexProvider（可降级候选源）

MetadataResolutionService
  -> 调度精确查询
  -> 校验身份与版本关系
  -> 按 manifestation 合并逐字段候选
  -> 生成预览

MetadataApplicationService
  -> 校验用户所有权与预览版本
  -> 只应用用户选择字段
  -> 保存 manifestation / identifiers / source snapshot / field provenance
```

Provider 必须使用固定允许域名和固定路径，不能复用接受任意目标的通用网络代理。XML 使用禁用外部实体的安全解析器；所有响应均设置超时、最大字节数和字段长度限制。

### 8.2 API 草案

第一阶段采用显式预览与应用两步：

```text
POST /api/papers/{paperId}/metadata/resolve
GET  /api/papers/{paperId}/metadata/resolutions/{resolutionId}
POST /api/papers/{paperId}/metadata/resolutions/{resolutionId}/apply
GET  /api/papers/{paperId}/metadata/sources
```

`resolve` 接受可选的用户输入标识，未提供时从论文现有 URL、文件名和 TEI header 提取。响应/任务结果包含：

- 识别出的规范标识。
- 查询过的数据源及状态。
- 按预印本/正式版分组的 manifestation 候选、匹配方式与置信度。
- 每个字段的当前值、建议值、来源和冲突标记。
- 未能补全的原因，例如“arXiv 未提供正式卷期页”。

`apply` 当前只接受 resolution 快照中已存在的候选字段名，不接受客户端随意伪造 Provider 原始值；后端再次校验论文所有权、resolution 所属用户、过期时间和并发版本。完整 manifestation ID 选择会在后续模型迁移后加入。

单篇精确查询可以同步返回；涉及多源、重试或批量历史补全时转为后台任务。批量功能不进入第一阶段 UI。

### 8.3 缓存与限流

arXiv 官方要求所有受控机器合计：单连接、每三秒最多一次 legacy API 请求。实现必须：

- 按规范 arXiv ID 批量请求并建立持久缓存。
- 使用全局限流器；多实例时改为 Redis 分布式锁/时间窗。
- 尊重 `Retry-After`，对 429/5xx 使用带抖动的指数退避。
- 缓存成功结果，并对明确不存在的 ID 做较短负缓存。
- 页面刷新不重复请求；同一 ID 的并发查询合并为一次。
- 批量历史库使用 OAI-PMH 或分批 `id_list`，不能逐论文并发轰击 arXiv。

其他 Provider 也要设置独立配额、熔断和降级，不能因为 Semantic Scholar 429 而让 arXiv 精确补全整体失败。

## 9. 前端交互

论文信息面板增加“补全元数据”入口：

1. 显示正在识别的标识，例如 `arXiv:1706.03762`。
2. 显示数据源查询进度，不阻塞 PDF 阅读。
3. 以字段差异表展示“当前值 / 建议值 / 来源 / 置信度”。
4. 空字段且高可信时默认勾选；冲突字段默认不勾选。
5. 区分“arXiv 预印本”和“正式发表”两个分组。
6. 应用后展示来源与最后核验时间，可进入来源详情。
7. 没有卷号、期号或 DOI 时明确显示“该来源未提供/该出版类型不适用”，而不是统一显示为解析失败。

上传或 URL 导入时，第一阶段只在后台准备补全建议，不自动覆盖。后续可增加：

- 粘贴 arXiv abs/PDF URL 时识别 ID、预览元数据并导入官方 PDF。
- 对已有库进行可暂停、可重试的批量扫描。
- 用户偏好中控制是否允许用标题/作者向第三方进行模糊查询。

## 10. 数据迁移顺序

项目使用 Flyway，已应用的 V1–V12 不可修改。当前开发分支的 V13 只增加最小补全闭环表；完整模型仍需后续 V14+ 迁移：

1. 先只读审计 `pr_papers` 数量、`journal` 与 `extra_fields.journalName` 冲突、旧 DOI 角色和 JSON 卷期页格式，输出可回滚的报告。
2. V13 已新增 `pr_paper_metadata_sources`、`pr_paper_field_provenance` 和短期 resolution 存储；后续 V14+ 再新增可空的 `pr_paper_manifestations`、`pr_paper_identifiers`，必要的规范字段挂在 manifestation，不立即添加破坏性约束。
3. 为新表添加 `ON DELETE CASCADE`、检查约束和分开处理 NULL 的唯一索引；先完成 DOI/arXiv 规范化和重复审计，再启用约束。
4. 将旧 `journal`、`extra_fields.journalName/volume/issue/pages` 只读兼容映射到候选 manifestation；仅在明确、无冲突且用户确认时创建正式/预印本记录。
5. `issnIsbn` 只有在格式明确时才拆分；无法判断的原值继续保留并标记待确认，不强行拆成 ISSN 或 ISBN。
6. 应用层先双读规范结构与旧 JSON，写入只写规范结构；兼容投影由 preferred manifestation 生成，人工非空值优先。
7. 完成线上数据核验后，再考虑移除旧 JSON 键；不在同一迁移中删除原值。新增论文关联表时同步检查 `PaperDeletionService`。

`volume`、`issue`、`publication_pages` 和 `article_number` 使用字符串，兼容 `S1`、`e12345`、季刊名称等值。不要把出版页码拆成整数后丢失格式。V13 不应把 `page_count` 重命名或复用为出版页码。

## 11. 隐私、安全与合规

- 精确 ID 查询只发送公开标识；模糊查询会把标题、作者等信息发给第三方，私密论文场景必须由用户显式触发或配置允许。
- 不向外部元数据服务发送 PDF 正文、GROBID 全文、批注、笔记或 AI 对话。
- 日志只记录 Provider、规范标识、状态、耗时和错误类型；不记录第三方密钥或完整响应正文。
- arXiv 描述性元数据按 CC0 可存储、转换和展示；PDF/源码版权独立判断，不能因为拿到元数据就任意转载全文。
- 产品不得暗示获得 arXiv 背书；按官方建议保留 arXiv 数据致谢和原始记录链接。
- URL 导入需要独立修复现有任意 URL 下载的 SSRF、重定向、大小和文件类型校验风险。

## 12. 收录情况的边界

SCI、SSCI、EI、CSSCI、北大核心属于“某期刊或会议在特定年份被某数据库收录”的断言，不是 arXiv 分类或论文自身固定字段。

- Crossref、DataCite、arXiv、OpenAlex、Semantic Scholar 和 Unpaywall 都不能可靠证明这些收录状态。
- OpenAlex `is_core` 不等于北大核心，`is_in_doaj` 也不等于 SCI。
- 如后续接入 Clarivate、Engineering Village、CSSCI 或北大核心名单，应以 ISSN/会议标识和年份匹配。
- 数据结构应为可多选、带年份、来源、核验时间的 assertion，不继续使用单个 `extraFields.indexing` 值。

该能力需要数据授权与产品范围确认，不纳入 v0.1.23 第一阶段。

## 13. 测试与验收

### 13.1 自动化测试

- arXiv 新旧 ID、URL、版本后缀和 10.48550 DOI 归一化。
- Atom、OAI `arXiv`、OAI `arXivRaw` 固定脱敏 fixture 解析。
- DOI 规范化、注册机构路由和错误响应。
- 精确 ID 一致性校验、标题同名误匹配、作者/年份冲突。
- `FILL_MISSING`、人工值保护、逐字段选择、幂等和并发版本冲突。
- V13 从旧 `extra_fields` 生成兼容候选、work/manifestation 关系及冲突保留。
- Provider 超时、429、5xx、缓存、负缓存和限流。
- Controller 所有权、resolution 归属、过期和伪造字段防护。
- 前端预览、默认勾选、冲突不勾选、失败降级和中英文文案。

外部 API 测试使用固定 fixture，不在普通单元测试中依赖公网实时结果。另设少量可人工触发的集成探测。

### 13.2 Attention 验收样例

对 *Attention Is All You Need*：

- 能从现有 GROBID TEI 提取 `1706.03762` 和版本 `7`。
- arXiv 候选显示八位正确作者、2017 首投、2023 最后修订、`cs.CL/cs.LG` 和仓储 DOI。
- 正式版 manifestation 通过明确关系的 NeurIPS 官方记录或 DBLP 记录显示 NeurIPS/NIPS 2017、卷 30、出版页码 5998–6008，并保留该来源。
- 不把 v7 写进 volume，不把 `15 pages` 写进 publicationPages。
- 不把 `10.48550/arXiv.1706.03762` 写成正式出版 DOI。
- 不因 Crossref/OpenAlex 同名异常结果写入 2025 年 DOI。
- 期号和正式 DOI显示为“未提供/不适用”，而不是猜值。
- 应用前生产记录不发生变化；应用后只更新用户勾选字段并保存来源。

## 14. 分阶段实施

### 阶段 A：模型与兼容迁移

- 统一 journal/venue 和旧 `extra_fields` 的读写语义。
- 新增 manifestation、多标识、来源快照、字段 provenance 和可过期 resolution 存储。
- 修复前后端 year 类型与 JSON 整包覆盖问题。
- 扩展 GROBID header 标识提取，但不扩大粗糙标题启发式。

### 阶段 B：精确标识补全

- arXiv Atom + OAI。
- Crossref/DataCite 精确 DOI。
- Provider 缓存、限流、安全解析和可观测性。
- 每篇论文的预览/应用 UI。

### 阶段 B+：明确关系的正式记录

- 用户从元数据面板主动触发“查找正式版本”，DBLP 标题/作者搜索只返回少量候选，不直接写入任何字段。
- 只对用户确认且已知 arXiv/DOI/DBLP 关系调用固定官方 proceedings 适配器。
- 将正式 venue、卷期页、出版社写入独立的正式版 manifestation，不覆盖 arXiv 预印本字段。
- DBLP 作为领域书目核对源；其结果仍记录来源和置信度，不能泛化成出版社官方证明。

### 阶段 C：正式版本候选与扩展

- 后续再接 Semantic Scholar 作为可降级的版本桥接，以及 DBLP、Europe PMC 等更广泛的领域 Provider。
- 官方出版社/会议记录确认必须走固定域名、固定路径和明确版本关系；不能退化成通用网页抓取。
- 模糊候选与人工选择，不自动新增正式 DOI。

### 阶段 D：批量与高级能力

- 可暂停、可恢复的历史论文批量补全。
- arXiv OAI 增量同步。
- OA 状态、合法全文位置和元数据定期复核。
- 收录数据库在获得授权后单独设计。

## 15. v0.1.23 第一阶段范围（开发分支交付边界）

本轮开发目标是阶段 A 的最小闭环和阶段 B 的精确单篇查询；阶段 B+ 的通用正式版本候选仍未完成：

- V13 的 resolution/source/provenance 兼容迁移；完整 `pr_paper_manifestations`/`pr_paper_identifiers` 延后到后续迁移。
- 字段级来源记录和短期候选快照。
- arXiv ID/DOI 提取和规范化。
- arXiv Atom/OAI、Crossref/DataCite 精确查询。
- Attention 的已审核 NeurIPS 关系适配器和严格 DBLP 标题+第一作者查询可生成默认不勾选的正式版候选；用户确认后的独立 manifestation 写入仍待后续完整模型完成。
- 逐字段候选、来源、冲突和 `FILL_MISSING` 合并。
- Reader 元数据面板中的预览与确认入口。
- Attention 示例固定 fixture、旧式 arXiv ID、DOI 回退、过期快照和字段篡改回归已完成；端到端浏览器验收已在生产登录页和静态资源层面完成；登录后单篇交互仍需使用测试账号按需回归。

`0.1.23` 已部署生产并完成线上验收；本阶段仍不执行历史论文批量刷新。

本轮不包含：全库自动批量写入、无标识论文的静默模糊匹配、自动新增未经确认的正式 DOI、SCI/EI/CSSCI 判定、通用网页抓取器、后台管理项目改造或任意第三方 PDF 镜像。

## 16. 参考接口

- arXiv Atom：<https://export.arxiv.org/api/query?id_list=1706.03762>
- arXiv OAI-PMH：<https://oaipmh.arxiv.org/oai?verb=GetRecord&identifier=oai:arXiv.org:1706.03762&metadataPrefix=arXiv>
- arXiv API 条款：<https://info.arxiv.org/help/api/tou.html>
- arXiv OAI 说明：<https://info.arxiv.org/help/oa/index.html>
- DataCite arXiv DOI：<https://api.datacite.org/dois/10.48550/arXiv.1706.03762>
- NeurIPS 官方记录：<https://proceedings.neurips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Abstract.html>
- NeurIPS 官方结构化元数据：<https://proceedings.neurips.cc/paper_files/paper/2017/file/3f5ee243547dee91fbd053c1c4a845aa-Metadata.json>
- DBLP 正式记录：<https://dblp.org/rec/conf/nips/VaswaniSPUJGKP17>
