## 当前迭代：v0.1.32

发布分支：`feature/v0.1.32`；类型：新功能迭代；需求编号：`REQ-202609-0070`。

优化论文助手 C 端登录页：采用左右分栏布局，左侧加入神经网络风格的动态粒子背景和论文主题轮播介绍，右侧保留邮箱密码、验证码及 GitHub 登录能力；同步支持中英文、窄屏降级和键盘可访问操作。

验收标准：登录逻辑不变；中英文登录页均显示新的布局与轮播内容；移动/窄屏仅显示登录表单；前端类型检查、测试、Lint、生产构建及后端测试和 bootJar 通过；按 `feature/v0.1.32 -> dev -> main` 发布并完成生产验收。

本轮不涉及数据库迁移、后端接口、用户数据、后台管理项目或共享基础设施。

# PaperHelper 迭代计划

## 当前迭代：v0.1.31

发布分支：`feature/v0.1.31`；类型：新功能迭代；需求编号：`REQ-202608-0012`。

将书架侧栏“我的创作”改为“我的论文”，英文同步为 “My Papers”。保留内部 `created` 路由键、`create` Tab、图标和业务逻辑，仅调整展示文案；同步升级前后端版本与 favicon 缓存参数到 `0.1.31`。

验收标准：中英文侧栏均显示新名称；版本文件一致；前端测试、类型检查、Lint、生产构建及后端测试和 bootJar 通过；按 `feature/v0.1.31 -> dev -> main` 发布并完成生产验收。

本轮不涉及数据库迁移、后端接口、用户数据、后台管理项目或共享基础设施。

## 当前迭代：v0.1.28

发布分支：`feature/v0.1.28`；目标：修正 PDF 页面内部空白区域的原生鼠标拖拽。

- PDF 纸张内部的行间距、段落间隙、页眉页脚和页边距均视为可平移空白区域，不再只允许拖动纸张外围灰色背景。
- 在最外层阅读视口绑定原生 `mousedown`，并用 `window mousemove` / `window mouseup` 保证拖拽移出视口后仍能完成平移。
- 仅真正的 PDF 文本 `span` 保留文本选择；批注链接、表单控件和按钮不启动平移。
- 悬停视口显示 `grab`，按下后显示 `grabbing`，拖拽过程中禁用文本选择。
- `mouseup`、窗口失焦和组件卸载都会清理拖拽状态并恢复原始 `user-select`。

## 当前发布：v0.1.23（已部署并完成线上验收）

发布分支：`feature/v0.1.23`；生产提交：`123db8c`

迭代类型：论文元数据模型治理与外部权威数据补全。

完整设计见 [外部论文元数据补全方案](EXTERNAL_METADATA_ENRICHMENT.md)。v0.1.23 已完成合并、构建、迁移、部署和线上验收，生产当前运行 `0.1.23`。

### 当前实现状态（2026-08-26 UTC）

| 范围 | 状态 | 真实边界 |
| --- | --- | --- |
| Reader 入口与中英文基础文案 | 已实现 | 仅单篇手动触发；应用后立即刷新当前论文状态 |
| `resolve` / `preview` / `apply` API | 已实现 | resolution 15 分钟过期并校验 `expectedUpdatedAt`；只接受快照中的字段 |
| arXiv Atom 精确查询 | 已实现 | 当前版本、作者、摘要、年份、分类、提交/修订时间和 arXiv ID 写入候选；OAI-PMH 尚未接入 |
| DataCite / Crossref 精确 DOI 查询 | 已实现 | 只对用户提供或论文中识别到的精确 DOI 查询；不做静默标题 DOI 搜索 |
| 来源快照与字段 provenance | 已实现 | V13 只保存 resolution/source/provenance 三类表；无完整 manifestation/identifier 表 |
| 正式版本候选 | 已实现（候选层） | 显式刷新触发严格 DBLP 标题+第一作者查询，并提供 Attention 固定关系适配器；候选默认不勾选、不写入独立 manifestation |
| 历史库批量刷新、OAI 增量同步 | 未实施 | 另立需求和限流/暂停/恢复设计 |

本轮发布未批量修改既有论文数据；仅在应用启动时执行了 V13 结构迁移，并按发布流程重启 PM2 服务。

### 背景

当前上传论文主要依赖 GROBID 从 PDF 提取元数据。标题、作者、摘要、DOI、年份和期刊/会议信息可能缺失或被 PDF 首页噪声污染；卷号、期号、出版页码、出版社、arXiv ID 等字段则没有稳定的规范存储和外部补全链路。

现有模型还存在 `journal` 与 `extraFields.journalName` 双写，卷期页等只藏在 `extraFields`，列表与信息面板读取不一致的问题。直接增加 arXiv 请求但不先治理数据模型，会出现“查到了但页面仍为空”或新旧来源互相覆盖。

### 核心目标

- 从导入 URL、PDF 元数据、GROBID TEI header 中提取并规范化 DOI、arXiv ID 等稳定标识。
- 用 arXiv 官方 Atom/OAI-PMH 精确补全预印本标题、作者、摘要、分类、提交/修订日期、版本、许可与仓储 DOI。
- 用 Crossref/DataCite 精确 DOI 查询，并为出版社/会议站、DBLP 等正式发表来源预留 Provider 架构；正式版本候选须由用户主动触发并确认，确认后才读取官方记录。
- 以 manifestation 分层区分预印本与正式发表记录、arXiv 版本与卷号、PDF 页数与出版页码、仓储 DOI 与正式出版 DOI。
- 新增逐字段来源、置信度、冲突和抓取时间；所有结果先预览，再由用户选择应用。
- 默认 `FILL_MISSING`，不静默覆盖人工填写值或已确认值。

### 计划实施顺序

1. 新增 Flyway V13，先建立元数据来源、字段 provenance 和可过期 resolution 存储；完整 manifestation、多标识表仍是后续迁移，旧 V1–V12 保持不可变。
2. 审计并兼容读取 `extraFields.journalName/volume/issue/pages/issnIsbn`，不在同一迁移中删除旧值，也不把旧 DOI 默认认定为正式 DOI。
3. 修复 journal 双数据源、前后端 year 类型不一致、`extraFields` 整包覆盖和 GROBID/人工编辑并发覆盖问题。
4. 实现 DOI/arXiv ID 提取与归一化，支持新旧 arXiv ID、版本 URL、PDF URL 和 10.48550 arXiv DOI。
5. [部分完成] 实现 arXiv Atom、Crossref/DataCite Provider，加入固定目标、响应大小限制、安全 XML、进程内成功/失败缓存、节流和降级；OAI、分布式限流、退避和可观测性仍待完成。
6. [已完成（候选层）] 提供用户主动触发的正式版本候选入口；DBLP 严格标题+第一作者查询排除 CoRR，Attention 固定官方 proceedings 适配器可生成候选；不写入独立 manifestation。
7. [已完成] 增加元数据 resolve/preview/apply API；候选按字段返回当前值、建议值、来源、置信度与冲突。
8. [已完成] Reader 论文信息面板增加“补全元数据”入口与基础中英文文案。
9. [已完成] 以 *Attention Is All You Need*、同名误匹配、旧式 arXiv ID、DOI 回退、过期快照和字段篡改完成固定 fixture 回归。

### Attention 验收基准

- 从已有 TEI 识别 `arXiv:1706.03762` 与版本 `v7`。
- arXiv 元数据得到八位作者、2017 首次提交、2023 最后修订、`cs.CL/cs.LG` 和 `10.48550/arXiv.1706.03762`。
- 用户主动确认正式版本候选后，在独立的正式版 manifestation 中通过 NeurIPS 官方记录或 DBLP 记录显示 NeurIPS/NIPS 2017、卷 30、页码 5998–6008，并标注该字段不是来自 arXiv。
- `v7` 不写入卷号，`15 pages` 不写入出版页码，arXiv DOI 不冒充正式出版 DOI。
- 不因 Crossref/OpenAlex 的 2025 同名异常候选写入错误 DOI或年份。
- 没有期号或正式 DOI 时显示“不适用/权威来源未提供”，不猜值。
- 应用前不修改论文；应用后只写用户勾选字段并保存来源记录。

### 验证要求

- arXiv/DOI 归一化、Provider fixture 解析、匹配冲突、幂等、并发和 `FILL_MISSING` 后端测试。
- V13 resolution/source/provenance 兼容候选、resolution 篡改/过期和 Paper 删除级联测试；完整 work/manifestation 重复标识、不可拆分 ISSN/ISBN 测试延期到模型迁移阶段。
- 前端预览、默认选择、冲突保护、失败降级和中英文 UI 测试。
- 前端类型检查、全部测试与生产构建；后端 clean test bootJar。
- 使用固定 fixture 做自动化测试，普通测试不依赖公网；上线前单独执行受控外部接口探测。

### 本次不包含

- 不按标题搜索结果静默写入 DOI 或覆盖现有字段。
- 不在 v0.1.23 自动批量改写整个历史论文库；批量能力后续单独实施。
- 不通过 arXiv/OpenAlex 推断 SCI、EI、SSCI、CSSCI 或北大核心。
- 不构建通用网页爬虫，不把任意外部 URL 交给无约束下载器；官方 proceedings 只允许固定域名和固定路径。
- 不修改 `/root/paperread-admin`、GROBID 镜像或共享 PostgreSQL/Redis 容器。

### 数据源运行约束

- arXiv legacy API 按官方要求保持单连接，所有受控机器合计每三秒最多一次请求；必须缓存并合并重复请求。官方 proceedings/DBLP 也要使用固定客户端、超时、缓存和来源记录。
- 模糊标题/作者查询会向第三方发送论文书目信息，只能由用户显式触发或经偏好设置允许。
- Provider 失败不得阻断 PDF 上传、解析、阅读、批注或人工编辑。
- 外部元数据只保存白名单字段和必要来源，不保存 PDF 正文、批注、笔记、AI 对话或凭据。

## 历史迭代：v0.1.22

分支：`feature/v0.1.22`

迭代类型：项目交接与维护需求。本轮不增加产品功能，目标是让后续新维护者不依赖历史对话即可准确、安全地接手。

### 本次目标与范围

- 创建统一文档索引、新人维护指引和项目完整现状文档。
- 核对并记录代码架构、生产 Cloudflare/Apache/PM2 链路、容器归属、本地存储、测试基线和关键入口。
- 汇总历次 AI、Provider、GROBID、标题、删除、缓存和 PM2 部署踩坑，并明确真实功能边界和技术债。
- 补齐前后端配置模板，明确 GROBID 线程池、WebSocket 和 production/development profile 名称。
- 将真实 `.env` 从版本控制中移除并加强 ignore；保留本机运行文件，不输出任何 Secret。
- 清除被跟踪工具脚本中的硬编码模型凭据，改由调用者本地环境注入，并记录历史凭据轮换要求。
- 更新 README 维护入口，纠正邮件投递和外部存储推送等尚未完成能力的描述。

### 验收标准

- 新人从根 README 能在一次点击内进入文档索引，并按推荐顺序完成上手。
- 文档明确区分本仓库、后台管理仓库、GROBID 服务和共享基础设施的边界。
- 文档中的生产状态能由只读命令复核，不把仓库 Compose 错写成当前生产容器管理方式。
- 所有配置项均有用途和安全说明，文档与提交中无真实密码、Key、Token、Cookie 或用户数据。
- `git ls-files backend/.env frontend/.env.local` 无输出，而本机真实文件仍保留供运行使用。
- 前端类型检查、测试、生产构建和后端 `clean test bootJar` 全部通过；版本统一为 `0.1.22`。

### 本次不包含

- 不改变产品业务逻辑、数据库 schema 或 Flyway 历史。
- 不轮换生产凭据、不重写 Git 历史；只记录后续受控处理要求。
- 不修改或重新构建 GROBID，不重建共享 PostgreSQL/Redis 容器。
- 不修改后台管理项目 `/root/paperread-admin`。
- 不在部署验证前把线上版本描述为 `0.1.22`。

## 历史迭代：v0.1.21

分支：`feature/v0.1.21`

已完成已知 GROBID 标题声明的保守清洗、V12 历史数据修正，以及“我的论文”当前卡片选中态优化；详情见维护文档第 16 节。

## 历史迭代：v0.1.20

分支：`feature/v0.1.20`

已优化论文卡片操作区，并完成带二次确认及可选原文件删除的论文删除流程；详情见维护文档第 15 节。

## 历史迭代：v0.1.19-fix

分支：`feature/v0.1.19-fix`

已修复健康接口硬编码旧版本的问题，接口改为读取当前 JAR 构建元数据；详情见维护文档第 14 节。

## 历史迭代：v0.1.19

分支：`feature/v0.1.19`

已完成 AI 思考内容折叠、论文选区询问 AI、GROBID 全文结构化提取、论文上下文查询和数据库 V11 迁移；详情见 AI 技术方案及维护文档第 8 节。

## 历史迭代：v0.1.18-fix

分支：`feature/v0.1.18-fix`

已完成 Provider `/v1` 根路径、CORS relay、流式响应和 AI 会话并发修复；详情见维护文档中的 v0.1.18 条目。

## 历史迭代：v0.1.13-fix

分支：`feature/v0.1.13-fix`

### 目标

修复偏好设置中 AI Provider“测试连接”误报失败的问题，使测试请求与实际对话请求使用同一条 `/chat/completions` 流程。

### 已完成

- 已填写模型时直接测试实际使用的 `/chat/completions`，不再先依赖 `/models`。
- 未填写模型时才请求 `/models` 获取模型，并使用获取到的第一个模型测试 chat。
- 不再猜测 `gpt-4o-mini`，避免自定义 Provider 因模型不存在被误判为连接失败。
- 统一 Base URL 规范化、Authorization 请求头和错误脱敏逻辑，聊天发送路径复用同一套工具。
- 错误提示包含真实 chat HTTP 状态和 Provider 错误消息，但不会泄露 API Key。
- 更新 `0.1.13-fix` 版本信息和 favicon 缓存参数。

### 验收标准

- 已配置模型时测试按钮只发起 chat 请求，且请求模型等于配置模型。
- 未配置模型时能从常见 `/models` 响应格式提取模型，再测试 chat。
- `/models` 不可用时不会使用猜测模型，界面会明确提示填写模型。
- chat 接口失败时显示 chat 接口真实错误，而不是旧的 `/models` 错误。
- 浏览器请求带有 `v=0.1.13-fix-r1` 的 favicon 缓存参数。
- 首页左上角 Logo 与页面其他品牌元素未被本次修复影响。
- 构建、测试、重启和公网检查均通过。

## 后续计划

### 后续候选（版本待产品负责人确认）

- 评估将直接 Provider 对话同步到后端账户历史的必要性。
- 为历史对话增加删除、重命名和按 Provider 筛选。
- 为模型选择记忆每个 Provider 的最近选择。
- 评估输入框自动高度和长消息性能。

## 已完成迭代

### v0.1.18

- 完成 C 端 AI 会话身份、会话级 Provider/模型、AI 标题总结和跨会话并发处理。
- 详情见 [AI_CHAT_TECHNICAL_SOLUTION.md](AI_CHAT_TECHNICAL_SOLUTION.md) 和维护文档中的 v0.1.18 条目。

### v0.1.12

- 完成浏览器标签页 favicon 的 R 缩小与居中调整。

### v0.1.12-fix

- 修复侧栏折叠按钮跨边界时部分区域无法点击的问题。

### v0.1.11

- 完成 C 端右侧 AI 对话面板的 Provider 配置、模型选择、新建对话和本地历史对话流程重构。
- 详情见 [AI_CHAT_TECHNICAL_SOLUTION.md](AI_CHAT_TECHNICAL_SOLUTION.md)。

### 后续中版本（需明确授权）

- 语音识别输入：必须先定义浏览器权限、语音服务 Provider、隐私提示和失败回退。
- 多模态模型能力：需要区分“已粘贴图片”与 Provider 是否支持视觉输入。
- 服务端加密保存 Provider 配置和跨设备对话同步。

以上中版本事项不会在普通 patch 迭代中自动实施。
