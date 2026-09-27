## v0.1.62 AI 辅助写作（W8：选区续写/改写/翻译/降重、摘要生成、参考文献格式化建议、语法与学术用语检查，`REQ-202609-0264`）

- **本轮是纯前端迭代：Kotlin 零改动、无新迁移、无新端点、无新依赖、后端 jar 有意未重建**，因此 **`/api/health` 仍报 `0.1.60`（上一轮 W6 的后端版本），这不是漏部署**。**判本轮线上版本请用 favicon `?v=0.1.62` 与编辑器 chunk 的 sha256**，不要用 `/api/health`（与 v0.1.59 那种"有真实 Kotlin 改动、health 就是版本依据"的情形相反）。Flyway 停在 `V19`（W6 的 `pr_paper_content_versions`）。
- **"不能直接改用户的字"是代码守卫，不是文案，改这里等于推翻验收标准。** AI 结果一律先落进 `AiWritingPanel` 的**可编辑建议框**，用户点「写入正文」才落笔；写入前必须过两道校验：文本结果过 `isAiWritingRangeStale(editor, range, sourceText)`（生成期间选区已被用户改掉就拒写并提示 `aiWritingStaleRange`），参考文献结果过 `sameCslIdSet(current, proposed)`（id 集合必须与原表**完全一致**才允许 `replaceBibliographyEntries`）。任何"顺手把结果直接 apply 到 doc"的改动都是回退。
- **"发往 Provider 的内容要有告知"同样落在代码上：必须在发请求之前渲染。** `describeAiWritingDisclosure()` 按动作算出发送范围（仅文献表 / 全文 / 选区）与字符数，面板先渲染清单再 `requestAiWriting()`。把这段改成"请求返回后再显示"或塞进 toast，就违反了 W8 的第二条验收标准。全文只发首 16000 + 尾 8000 字符（`clipDocumentText`），**不要为了"更完整"把上限去掉**——全文类动作（`grammar`/`abstract`）本来就把长文送第三方。
- **红线沿用，别在本轮新开一个例外**：用户选区与全文都可能进 Prompt，**日志、错误提示、URL、提交里都不得出现 Prompt、选区原文与正文**。`describeAiWritingError()` 已经过 `redactProviderErrorText` 抹掉 API Key，`cleanAiWritingText()` 也只剥掉整段包裹的代码围栏——新增日志或错误透出时照这条办。
- **必须复用既有 Provider 主链路，不得在服务端再建一套模型配置。** Provider 与 API Key 仍在浏览器 `pr-preferences`，请求仍走 `requestAiChatCompletion`（先直连、失败回落 JWT 保护的 `/api/provider-relay/*`）；`ChatPanel.tsx` / `chat-store.ts` / relay 路由本轮**一行未改**。要加新的 AI 动作就往 `AI_WRITING_ACTIONS` 里加一条 + 补提示词，**不要**去动服务端那套旧 `/api/ai-chats`。
- **`lib/ai-writing.ts` 保持无 store 依赖**（只接 `{baseUrl, apiKey, model}` 参数）——这是本仓库的分层约定：`lib/*` 不 import `@/stores/*`。组件侧才从 `usePreferencesStore` 取 Provider。
- **参考文献是"建议"不是"事实"**：模型返回的 JSON 走白名单过滤（未知 `type` 降级 `article`、无 id 条目丢弃、按 id 去重），**没有联网查证条目真伪**。别把这里的解析放宽成"信任模型输出"，也别在 UI 上把它描述成"已核对"。
- **文案只补了 `zh` / `en`（各 34 个 `aiWriting*` 键），其余 12 语言回退中文**——沿用 `mergeMessages` 以 `zh` 兜底的既有做法，完整本地化留给 W9。**在 W9 之前不要因为"非中文语言下看到中文"就去单独补某一种语言**（要补就 12 种一起补）；新增键时 `zh` 与 `en` 必须同时加。
- **并行撞号**：本轮开工时同仓库有四个 BACS 工作流并行（`git worktree list` 可见）。`0.1.61`（`REQ-202609-0265`）与 `0.1.63`（`REQ-202609-0263`）是**并行的非 writer 需求占用的号，与 writer 路线图无关**；`0.1.60` 是并行的 W6（`REQ-202609-0262`，有真实 Kotlin 改动 + 迁移 `V19`，后端已重启）。开发期间 W6 先进了 `main`，本轮按仓库先例**把 `main` 合并进需求分支**（提交 `de31eae`，不 rebase、不强推），六处版本号文件取本分支的 `0.1.62`、`PaperEditor.tsx` 手工做加法合并（本轮的 `writingRequest`/`AiWritingPanel` 与 W6 的 `showHistory`/`ContentHistoryDialog` 都保留）。**不要复用 `0.1.61`/`0.1.63`**。
- **本轮顺手修了 W6 新增测试 `content-history-wiring.test.tsx`**：其 hoisted mock editor 缺少 `state`，而本轮的 `AiWritingToolbar` 要从 `editor.state` 读选区，导致 2 项失败。修法是给 mock 补 `state` 桩（`selection` + `doc.textBetween`/`doc.descendants`），**没有**在生产代码里加 `instance.state?` 之类的防御分支——真实的 Tiptap `Editor` 必然有 `state`，为迁就 mock 而加分支是错的方向。
- **测试**：前端新增 `src/test/ai-writing.test.tsx`（30 项），本分支 **30 个文件 / 228 项**全绿；合并 `main` 带入 W6 的 3 个文件 / 27 项后为 **33 个文件 / 255 项**，同样全绿；`./node_modules/.bin/tsc --noEmit` 与 `pnpm run build` 退出码 0。**后端本轮零改动、未重跑**。以上是**期望值**，不是可放宽的上限。（跑检查用 `./node_modules/.bin/tsc`、`./node_modules/.bin/vitest`，**不要用 `npx` / `pnpm exec`**——会触发 pnpm 解析/安装。）
- **未验证，别当成已验过**：单测全程 `vi.stubGlobal("fetch", ...)` mock 掉 Provider，**从未跑过真实模型**，"七个动作的提示词在真实 Provider 上产出可用结果"没有证据；也**没有登录态下的真实浏览器人工点击**（生产只开管理员 GitHub 登录）。其余边界：无并发/取消（关面板不 abort）、`grammar`/`abstract` 会发全文且只有一次性告知无逐次二次确认、参考文献不联网查证、其余 12 语言文案回退中文。
- **版本链**：`v0.1.54 → v0.1.56（W3）→ v0.1.57（W2）→ v0.1.58（上传限额）→ v0.1.59（W5）→ v0.1.60（W6，并行交付）→ v0.1.62（W8）`；`0.1.61`/`0.1.63` 是并行非 writer 需求占用的号，**没有线上版本**。至此 writer 路线图 **W1-W6 与 W8 完成，只剩 W7（协作，被 `/ws` 身份债阻塞）与 W9（平台合规与多语言完整本地化）**。

## v0.1.60 版本历史与快照（W6：正文快照 / 时间线 / 对比 / 回滚 / 手动标签，`REQ-202609-0262`）

- **本轮有真实 Kotlin 改动、新增迁移 `V19`、后端 jar 已重建并重启**，`/api/health` 本机与公网均返回 `0.1.60`，是有效版本依据；favicon `?v=0.1.60`。生产前端/后端均 `0.1.60`，Flyway 到 `V19`。
- **正文快照必须存在新表 `pr_paper_content_versions`，绝不复用 `pr_paper_versions`。** `pr_paper_versions` 的既有语义是「storage push 状态」（发布记录，W5 的导出产物还 `version_id` 回挂着它），需求明确禁止把正文快照塞进它的行里——改造它的语义是破坏性的、要单独评估。两个表名字只差一个词，改代码/写迁移时**看清楚是哪个**：正文快照的迁移是 `V19__paper_content_versions.sql`。
- **回滚动作本身必须留下快照，否则回滚不可逆、验收直接不过。** `PaperContentVersionService.restoreSnapshot` 在一个事务里的顺序是：**先**把当前正文存成一条 `source=ROLLBACK`、`label` 为空的前置快照，**再**把论文正文替换成目标快照的内容并把 `content_version` 加一。别为了「少一条记录」省掉前置快照——那会让用户回滚之后再回滚不回来。
- **`baseVersion` 冲突必须继续走 `409`/`1008`，不要新造错误码。** 回滚复用 W3 自动保存那套乐观锁语义（`ContentVersionConflictException`，`1008`）；本轮共用的既有码是 `1003` 参数非法（400）、`1004` 找不到（404）、`1008` 版本冲突（409），**`1014` 仍空闲**（`1009`/`1010` 属上传限额、`1011`/`1012`/`1013` 属导出）。
- **`POST …/content-versions`（建快照）是纯读操作，不能写 `pr_papers`。** 单测里用 `verify(exactly = 0) { paperRepository.save(any()) }` 钉住了这条：建快照只插快照行、不动正文，也不该顺带 bump `content_version`。
- **前端在编辑器有未保存改动时禁用回滚**（`disabled={dirty}` 并有 `dirtyHint` 提示）：回滚走的是另一条写路径，和 2 秒防抖的自动保存并发时会被 `1008` 顶掉，让用户在界面上先保存或丢弃改动比事后弹冲突更清楚。回滚成功后要 `autosave.reset()` 并把返回的 `contentVersion` 写回编辑器的 `versionRef`，否则下一次自动保存会立刻报冲突。
- **本轮实测了线上真实鉴权接口**：以自签 HS512 访问令牌（`sub` = 用户 id、无 `did` 声明，`JwtAuthFilter` 对无设备声明的令牌按 legacy 放行）调生产 `GET /api/papers/7/content-versions` 得 `200`/空数组，调不存在的快照与跨用户论文均得 `404`/`1004`——**只做了只读验证，没有在生产上跑写回滚**，写路径由后端单测钉住。
- **版本号**：`0.1.61`/`0.1.62`/`0.1.63` 已被三个并行 worktree（`-202609-0263`/`-0264`/`-0265`，同一基线 `29b4158`）预定，W6 取的是当时 `origin` 上仍空闲的 `0.1.60`。**若后续任一并行分支要用 `0.1.60`，先确认本分支已合入**，否则按既有先例顺延、不要共号。
- **版本链**：`v0.1.54 → v0.1.56（W3）→ v0.1.57（W2）→ v0.1.58（上传限额）→ v0.1.59（W5）→ v0.1.60（W6）`。至此 writer 路线图 **W1-W6 全部完成**，余 W7（协作）/W8（AI 写作辅助）/W9（写作工作台整合）。

## v0.1.59 导入、导出与投稿（W5：Markdown 导入 + PDF/DOCX/LaTeX/BibTeX/Markdown/HTML 导出，`REQ-202609-0261`）

- **本轮有真实 Kotlin 改动、新增迁移 `V18`、后端 jar 已重建并重启**，`/api/health` 本机与公网均返回 `0.1.59`，是有效版本依据；favicon `?v=0.1.59`。生产前端/后端均 `0.1.59`，Flyway 到 `V18`。
- **导出引擎是"用户可触发的独立服务端进程"，五道安全闸门缺一不可——不要为图省事去掉任何一道。** ① 输入大小上限 `app.export.max-input-bytes`（2MB）→ `400`；② 并发上限 `Semaphore(max-concurrency=3)` + `acquire-timeout-ms=2000` → `429`/`1012`；③ 引擎探活 → `503`/`1011`（`isExecutable` 缓存）；④ 单进程 `timeout-ms=30000` 超时 `destroyForcibly`；⑤ 临时/产物目录隔离 + 错误脱敏 → `502`/`1013`。**命令注入防线**：`DocumentExportEngine` 只用 `ProcessBuilder` 数组参数 + pandoc/typst 绝对路径，绝不拼 shell 字符串——新增任何引擎调用都照此办理。
- **业务码 `1011`/`1012`/`1013` 属导出，`1009`/`1010` 属上传限额，别复用、别混号。** 迁移是 `V18__paper_export_artifacts.sql`。
- **导出产物必须回挂 `pr_paper_versions`（`version_id`），不另起并行体系**——这是需求硬条款；表 `pr_paper_export_artifacts` 的 `file_path` 相对 `app.export.output-dir`（默认 `./uploads/exports`，按 `paperId` 分目录），不是相对 backend 根目录，清理产物时注意这一点（本轮验收后清理时就先踩过一次相对路径的坑）。
- **Markdown 导入是非破坏性的**：`POST /api/papers/{id}/import/markdown` 只回 `contentHtml`、**不落库**，交编辑器让用户确认后再走正常保存链路。不要把它改成直接覆盖正文。
- **许可**：Pandoc（GPL-2.0）以独立二进制进程调用、不链接，不传染本项目；typst（Apache-2.0）。两者**只装服务端、不随发行物分发**（随包分发 GPL 二进制才有 GPL 义务）。CJK 字体 `Noto Serif CJK SC` 必须在服务端可被 typst 找到，否则中文 PDF 会掉字。
- **部署收尾同样不能 `pm2 restart paper-reader-backend`**（复用旧版本 jar 路径）：`. ./.env` 后在同一 shell 里 `pm2 delete` + `pm2 start`。本轮后端 PM2 id `4` → `5`、`restart_time=0`、jar `paper-reader-backend-0.1.59.jar`；前端重启计数 `5` → `6`。
- **本轮做到了无登录 e2e 之外的真实鉴权实测**：以自签 HS512 令牌调生产接口把含中文论文导出全 6 格式均 `success`（PDF 内嵌 `NotoSerifCJK`/`Identity-H`），验收产物随后已清理、生产回到干净状态。但**真实浏览器人工点一遍仍未做**（C 端登录受限），六格式与闸门主要靠后端测试 + 该次 API 实测钉住。
- **版本链**：`v0.1.54 → v0.1.56（W3）→ v0.1.57（W2）→ v0.1.58（上传限额）→ v0.1.59（W5）`。至此 writer 路线图 **W1-W5 全部完成**。

## v0.1.58 上传论文限额（单文件 10MB / 单用户单日 100MB / 单用户累计 200MB / 应用单日 1GB）

- 需求编号 `REQ-202609-0267`，分支 `feature/req-202609-0267-upload-quota`，从 `main` 的 `7dff17d`（v0.1.57 的文档同步合并提交）展开。**本轮有真实 Kotlin 改动、新增迁移、后端 jar 已重建并重启**，所以 `/api/health` **这次真的是版本依据**（本机与公网都返回 `0.1.58`），与上一轮 v0.1.57「纯前端、后端未重启、只能看 favicon」相反。
- **四档限额的"可配置性"是分层的，不要一刀切。** 单文件 **10MB**、单用户单日 **100MB**、单用户累计 **200MB** 是产品硬限制，**写死在 `UploadQuotaService` 的常量里**（`MAX_FILE_BYTES` / `USER_DAILY_BYTES` / `USER_TOTAL_BYTES`）——需求原话是「这个（单用户总量 200MB）是固定的，不会随着测试还是上线会变化」，所以它们**不进环境变量**。只有**应用单日 1GB** 是"当前测试阶段"的上限，走 `APP_UPLOAD_DAILY_LIMIT_BYTES`（默认 `1073741824`），上线放开时改环境变量重启即可。**不要为了"统一风格"把前三个也挪进配置**，那会抹掉需求里明确区分的那句话。
- **`pr_upload_records` 是只增台账，不是可以随论文删除而回收的计数表。** 配额一律从台账聚合（`sumBytesByUserId` / `sumBytesByUserIdSince` / `sumBytesSince`，均有 `COALESCE`）而**不是**去 `pr_papers` 上按现存文件求和——否则用户删一篇论文就能把配额"退回来"，绕过 200MB 累积上限。**`paper_id` 故意不建外键**（迁移注释里写明）：论文被删掉时这行也必须留下。想"清理"这张表前先想清楚这一点。
- **上传入口不止 multipart 一个，URL 导入会绕过 Spring 的 `max-file-size`。** 所以 `uploadFromUrl` 走的是**流式下载边下边数**：`FileStorageService.downloadPdf(url, maxBytes)` 按 64KB 分块累加，超过 10MB 中途抛 `FileTooLargeException`，不等整个文件落盘。同理 `checkQuota` 在 **URL 下载之前**先按 `0` 字节探一次（挡掉已超额的用户），下载完再按真实大小正式校验并 `record`。**新增任何导入入口都要走这套，不要只依赖 `application.yml` 的 multipart 上限。**
- **`/api/papers/upload-quota` 的路径字面量必须声明在 `/{id}` 之前**，否则会被当成 `id = "upload-quota"` 的路径变量去解析。返回体是 `UploadQuotaDto`（`fileLimitBytes` / `dailyLimitBytes` / `totalLimitBytes` / `dailyUsedBytes` / `totalUsedBytes` / `dailyRemainingBytes` / `totalRemainingBytes`）。
- **前端的 10MB 校验是体验，不是防线。** `UploadDialog.tsx` 里的 `MAX_FILE_BYTES` 只负责"本地就拦下来、不发请求"，真正的判定在服务端（`1009`）。**别把前端的数字当成唯一真相**，它和后端常量是两处独立的字面量。multipart 超限时服务端走 `MaxUploadSizeExceededException` → `GlobalExceptionHandler` → `1009`/`413`。
- **配额查询失败不能让上传功能连带变哑。** `UploadDialog` 里取 `getUploadQuota()` 的 `useEffect` **故意吞掉异常**：拿不到就少显示一行"剩余"提示，上传照常可用（服务端仍会校验）。`upload-quota.test.tsx` 里专门钉了这条。别"顺手"把失败改成把整个对话框置灰。
- **拒绝文件后要清 `e.target.value`。** 否则用户重新选同一个文件时 `change` 事件不触发，看起来像"点了没反应"。提示块放在 tabs 外面而不是每个 tab 里，因为 URL 导入同样会把 PDF 落到服务端、同样受限。
- **验收时别用 `401` vs `404` 去判断新路由是否存在。** 实测未带凭据的 `GET /api/papers/upload-quota` 返回 `401`/`code 1001`，但**不存在的路径同样返回 `401`**——Spring Security 的过滤器跑在路由之前，这个对照实验**不能**证明路由存在。路由存在由后端单测、以及线上产物里能搜到 `quotaRemaining` 来证明。
- **版本号 `0.1.58` 曾被并行迭代撞过（现已顺延为 `0.1.59`）。** W5「文档导入导出与投稿产物」（`REQ-202609-0261`）的分支原也取名 `feature/v0.1.58`（提交 `f8101d4`，基于 `7dff17d`）。**2026-09-26 UTC 已确认 W5 顺延到 `0.1.59`**（分支 `feature/v0.1.59`，代码合并提交 `a1c2ed0`〔父 `772dc58` + `e7d9416`〕，2026-09-26 UTC **已发布**，详见本文件顶部 v0.1.59 条），原 `feature/v0.1.58` 留在 origin 作痕迹（未合入、未删除），处理方式同 `0.1.55` → `0.1.57` 先例；**不要复用 `0.1.58`**，两轮都要碰 `PaperService` / `PaperController`，共号会让版本链歧义。
- 部署收尾同样**不能图省事用 `pm2 restart paper-reader-backend`**：JAR 路径带版本号，restart 会继续加载旧路径。必须 `set -a; . ./.env; set +a` 后在**同一个 shell** 里连续 `pm2 delete` + `pm2 start`，探活通过再 `pm2 save`。本轮实测后端 PM2 **id 由 3 变 4**、pid 2452851、`restart_time=0`、jar 为 `paper-reader-backend-0.1.58.jar`（78,401,919 字节）；前端 PM2 id 0、重启计数 4 → 5。`/api/health` = `0.1.58`，favicon `?v=0.1.58`，`app/[locale]/page-8de85af55e54c2bf.js` 等三个 chunk 与本地 `.next` **sha256 逐字节一致**；**Flyway 由 `V16` 升到 `V17`**，在 `ddl-auto: validate` 下启动成功即证明实体与建表语句一致。
- 本轮实测测试基线：后端 **16 个测试类 / 102 项 / 0 失败**，前端 **27 个测试文件 / 189 项**（v0.1.57 为 26 / 183），`tsc --noEmit`、`pnpm run build` 均 exit 0。均为**期望值**，不是可以放宽的上限。
- 尚未覆盖：① **没有登录态下的浏览器端到端验收**（同前几轮，生产登录方式受限），所以"超 10MB 被拦"、"单日 100MB／累计 200MB 被拒"这几条**验收标准是在测试里以真实组件 + 后端单测钉住的**，未在真实浏览器里人工走一遍。② 合并后首次整跑 `pnpm test` 出现 1 项失败（`paper-content.test.tsx:342`，属 W3 的「未保存改动的离开拦截」），**重跑即通过、该文件单独连跑三次也通过**，判定为**他人迭代测试在全量并发下的偶发**，已定性未修（超出本需求范围）。③ 台账只增不减，**没有任何清理/回收机制**，长期会持续增长；配额口径与实际占用存储会随时间偏离，需要回收策略时单独立项。

## v0.1.57 编辑器基础格式工具栏与字数统计（W2）

- 需求编号 `REQ-202609-0258`（**writer 路线图 W2**，见 [WRITER_ROADMAP.md](WRITER_ROADMAP.md) 第 4 节），分支 `feature/v0.1.57`，从**含 W3 的** `origin/main`（`6b8f573`）展开。**纯前端迭代，Kotlin 零改动、后端 jar 未重建**，`/api/health` **仍报 W3 的 `0.1.56`**（不是漏部署）。**判定前端线上版本用 favicon `?v=0.1.57` 与产物哈希，不要用 `/api/health`。W2 原分配 `v0.1.55`，因并行 W3 先合入 `v0.1.56` 而放弃、无线上版本。**（**writer 路线图 W2**，见 [WRITER_ROADMAP.md](WRITER_ROADMAP.md) 第 4 节），分支 `feature/v0.1.57`，从**含 W3 的** `origin/main`（`6b8f573`）展开。**纯前端迭代，Kotlin 零改动、后端 jar 未重建**，`/api/health` **仍报 W3 的 `0.1.56`**（不是漏部署）。**判定前端线上版本用 favicon `?v=0.1.57` 与产物哈希，不要用 `/api/health`。W2 原分配 `v0.1.55`，因并行 W3 先合入 `v0.1.56` 而放弃、无线上版本。**
- **W2 的格式文案目前只有 `zh` 和 `en`（24 个 key），其余 12 语言未补。** 这是有意为之：`mergeMessages` 以 `zh`（`DEFAULT_LOCALE`）为兜底底座，缺失 key 回退中文、不会缺字或报错。**完整本地化留给 W9**；在 W9 之前**不要**因为"非中文语言下工具栏显示中文"就当 bug 去改，也不要只给某一种语言补齐（要补就 12 种一起补，并对齐 `zh`/`en` 的 key 集合）。新增 W2 相关文案时 `zh` 与 `en` 必须同时加，否则英文站会露出中文。
- **`text-align.ts` 不要改成自定义命令。** `@tiptap/core` 在 pnpm 布局下**未提升**，`declare module "@tiptap/core"` 的命令类型增强会编译失败；对齐一律走内置 typed `updateAttributes`（`updateAttributes(editor.isActive("heading") ? "heading" : "paragraph", { textAlign })`）。默认 `left` 渲染为 `{}`（不写 style），改这里要保证 `getHTML()` 里只有非默认对齐才出现内联 `style="text-align:…"`。
- **W2 叠加在 W3 之上，别回退 W3。** `PaperEditor.tsx` 里 W3 的 `useAutosave` / `useUnsavedGuard` / `markDirty` / `onReloadConflict` 必须保留；W2 只加 `FormatToolbar` 渲染、`TextAlign` 扩展、`useEditorState` 字数统计块与页脚字数条。`FormatToolbar` 的按钮用 `onMouseDown` + `preventDefault` 保住选区（用 `onClick` 会先失焦，格式命令作用不到选中文本）。
- 本轮实测测试基线：前端 **26 个测试文件 / 183 项**（v0.1.54 为 25 / 154），`pnpm exec tsc --noEmit`、`pnpm run build` 均 exit 0；后端 Kotlin 零改动、未重跑。线上 favicon `?v=0.1.57`、样式表 `_next/static/css/0748322fe6c9c60a.css` 含 `.format-toolbar` / `.format-toolbar-button` / `.format-toolbar-divider`。**无登录态浏览器端到端验收**，工具栏交互由 `format-toolbar.test.tsx` 在 jsdom 里用真实编辑器实例覆盖。以上是**期望值**，不是可放宽的上限。

## v0.1.56 正文自动保存与草稿保护（防抖自动保存 / 状态指示 / 离开拦截 / 并发冲突）

- 需求编号 `REQ-202609-0259`（**writer 路线图 W3**，见 [WRITER_ROADMAP.md](WRITER_ROADMAP.md) 第 4 节），分支 `feature/req-202609-0259-autosave`，从 `main` 的 `a924db9`（v0.1.54 的文档同步合并提交）展开。**本轮有真实 Kotlin 改动，后端 jar 已重建并重启**，所以 `/api/health` **这次真的是版本依据**（本机与公网都返回 `0.1.56`）——这与紧邻下一节的 **v0.1.54「纯前端、后端有意未重启、`/api/health` 落后于前端」** 是相反的情形，别把两轮的判定方式套错。
- **版本号跳过了 `0.1.55`，那是撞号后被放弃的，不是漏发。** `0.1.55` 原分配给姊妹迭代 **W2（编辑器内核，`REQ-202609-0258`）**，但本迭代（W3）先合入占用了 `0.1.56`，W2 遂放弃 `0.1.55`（分支 `feature/v0.1.55` 留在 origin 作痕迹，未合入、未删除），重切为 **`feature/v0.1.57`** 并以**加法方式**叠加在本轮的自动保存之上——`useAutosave` / `useUnsavedGuard` / `onReloadConflict` 一行未改。两轮都改 `PaperEditor.tsx`、`en/zh common.json`、`paper-content.test.tsx`，共用一个版本号会让版本链歧义。**看到版本链里没有 `0.1.55` 不代表漏发**，`docs/PROJECT_STATUS.md` 已注明。
- **冲突不是失败，别给它加自动重试。** `useAutosave` 命中 `err.code === 1008`（`CONTENT_CONFLICT_CODE`）时状态置为 `conflict`，**既不排 5 秒重试、也不在 `online` 事件里重试** —— 静默重试等于替用户决定覆盖别人的写入，正是 W3 要禁止的行为。将来任何"顺手补一个重试"的改动都会直接推翻本轮的核心验收项。此时只能靠用户点「加载最新」。
- **失败重试和冲突是两条互斥的路径。** 前端 `paper-content.test.tsx` 里专门钉了「冲突态下『保存失败』文案与重试按钮都不出现」；如果新增状态把它们揉在一起，这条测试会挂——那是保护，不是碍事。
- **`baseVersion` 是可选的，空即跳过校验 —— 这是有意保留的向后兼容。** 服务端的乐观锁**只在调用方传了 `baseVersion` 时生效**（`UpdatePaperContentRequest.baseVersion: Int?`）。**新增任何调用 `PUT /api/papers/{id}/content` 的地方，必须把读到的 `contentVersion` 作为 `baseVersion` 传过去**，否则它仍会整篇覆盖别人的编辑，服务端不会替它拦。比较与自增在同一次悲观锁读取之内完成（`PaperService.updatePaperContent`），**不要把比较挪到加锁之前**。
- **"绝不被静默覆盖"这条守了两遍**：前端冲突态不给重试，服务端在用户硬点保存时照样用过期 `baseVersion` 返回 `409`/`1008`。删任何一边都还有另一边，但两边都别删。
- **`useAutosave` 用编辑序号判断"我保存完时文档有没有又变"。** 保存成功时比对回包时的 `editSeqRef.current` 与发起时的序号：期间又改过就回到待保存并重新排期，**不会把"已保存"错报给已经变化的文档**。**不要为了省一个 ref 把它改成"调用返回即已保存"** —— 那是"显示已保存但磁盘上不是最新"的经典 bug。
- **`PaperEditor.tsx` 里的 `editorRef` 是拿来打断循环依赖的，不是多余的缓存。** `getPayload` 通过 ref 读 `editor.getJSON()`/`getHTML()`，`onUpdate` 只调 `markDirty()`，从而避免"编辑器依赖 autosave、autosave 又依赖编辑器"的重建循环。`PaperEditor` 的手动保存按钮改为调 `saveNow()`、按 `status === "saving"` 禁用，**本轮把旧的本地 `isSaving`/`status` 状态与 `handleSave` 一并删掉了 —— 同一件事只留一个真相，不要新加第二个保存状态。**
- **离开拦截只拦跳转，不拦保存。** `useUnsavedGuard` 的站内 `<a>` 捕获阶段拦截**故意跳过**已 `preventDefault` 的、非左键、带修饰键、`#` 锚点、`_blank`、`download`、以及指向当前地址的链接。`beforeunload` 里 `preventDefault` + `returnValue = ""` 两个都要写，浏览器原生确认才会弹。改这里前先想清楚"哪些点击不该被打断"。
- **改 `common.json` 会和 W2 冲突。** 本轮 14 个语言包各新增 5 个 `papers` 键（`saving` / `saveRetry` / `autosaveConflict` / `reloadLatest` / `unsavedLeaveConfirm`），纯新增、各语言键集合一致（87 个）。W2 也要动同一批文件，**合并时按文件逐条解决，不要整体覆盖某一侧**（覆盖会丢文案且不会报错，缺键只是退回中文）。
- **类型检查请直接调 `./node_modules/.bin/tsc`，不要在仓库里跑 `pnpm exec tsc`** —— 后者会顺手触发一次 `pnpm install`（输出里能看到 lockfile 策略检查与 "Done in … using pnpm v12.4.2"）。理由与 `docs/ATTENTION.md` 后文记的 `npx` 触发 pnpm install 是同一条。测试里用 `vi.useFakeTimers()` 时注意：`findBy*`/`waitFor` 的内部轮询在假定时器下不会推进、会直接超时，应在 `act` 里 `vi.advanceTimersByTime` 之后用同步的 `getBy*` 断言。
- 部署收尾**不能图省事用 `pm2 restart paper-reader-backend`**：JAR 路径带版本号，restart 会继续加载旧路径（本轮之前的旧 jar 是 `0.1.52`）。必须 `set -a; . ./.env; set +a` 后在**同一个 shell** 里连续 `pm2 delete` + `pm2 start`（重建后的 PM2 项不继承被删进程的应用环境变量），探活通过再 `pm2 save`。本轮实测后端 PM2 **id 由 2 变 3**、pid 2383738、`restart_time=0`，前端 pid 2383821、重启计数 2 → 3；`/api/health` = `0.1.56`，favicon `?v=0.1.56`，自动保存所在 chunk 与论文详情页 chunk 均与本地 `.next` **sha256 逐字节一致**，未带凭据 `PUT /api/papers/1/content` 得 `401`/`1001`（证明线上是带校验的后端，不是 404）。**Flyway 仍停在 `V16`**：本轮只加请求字段与业务码，无新迁移。
- 本轮实测测试基线：前端 **25 个测试文件 / 162 项**（v0.1.54 为 25 / 154），后端 **84 项**（v0.1.52 / v0.1.54 基线为 81）。均为**期望值**，不是可以放宽的上限。
- 尚未覆盖：① **没有登录态下的浏览器端到端验收**（同 v0.1.52 / v0.1.54 的原因，生产登录方式受限），所以「断网→停手→恢复网络自动落库」「两个标签页抢写时后写者看到『内容已被更新』」「带未保存改动关标签页弹浏览器原生确认」这三条**验收标准是在前端测试里以真实组件 + 假定时器钉住的**，未在真实浏览器里人工走一遍；冲突的服务端半边另有后端单测 + 线上 `401` 探测作证。② 冲突只解决"谁的写入算数"，**没有历史版本、不能看差异也不能回滚**（属 `W6`）。③ W2（编辑器内核）仍未做，本轮自动保存是挂在裸编辑器上的，工具栏落地后 `useAutosave` 不需要改。

## v0.1.54 学术写作能力（公式 / 表格 / 脚注 / 引用 / 交叉引用）

- 需求编号 `REQ-202609-0260`（**writer 路线图 W4**，见 [WRITER_ROADMAP.md](WRITER_ROADMAP.md) 第 4 节），分支 `feature/v0.1.54`，从 v0.1.52 的发布提交 `239ca89` 展开。**本轮是纯前端迭代，Kotlin 零改动、没有新迁移、后端 jar 未重建、`paper-reader-backend` 未重启**，所以 `/api/health` **仍返回 `0.1.52`**——这是预期，不是漏部署。**判定前端线上版本请用 favicon `?v=0.1.54` 与构建产物哈希（`_next/static/chunks/...` 的 sha256），不要用 `/api/health`。**
- **导出的编号必须回写到节点属性，否则 `getHTML()` 会漏号。** `editor.getHTML()` 走的是 schema 的 `renderHTML`（`DOMSerializer.fromSchema`），**不读 NodeView 的实时 DOM**。因此所有"推导出来的编号"（脚注序号、引用序号、交叉引用指向的编号、文末列表条目）都由 `AcademicNumbering` 插件在 `appendTransaction` 里算完**用 `tr.setNodeMarkup` 写回 `attrs`**。**新增任何"显示时才计算"的编号时，不要只算在 NodeView 里**——编辑器里看着对，导出/保存后就是错的。
- **参考文献表的顺序就是引用编号。** 编号不落库、由 `Bibliography` 节点的 `entries` 顺序推导（`collectBibliography`），所以"在文献表里上移一条"必须让正文里的 `[n]` 跟着重排——这正是 W4 验收里"真引用系统 vs 手打编号"的分水岭，由 `frontend/src/test/academic-numbering.test.ts` 与 `academic-editor.test.tsx` 各锁一遍。**不要把编号直接写进正文文本。**
- **脚注是自研的，不是官方扩展。** npm 上 `@tiptap/extension-footnotes` 与 `@tiptap-pro/extension-footnotes` **都是 404**（不是"没装"，是不存在），Tiptap Pro 也没有对应产品；本轮**没走 spike、没买 Pro**，按自研路线实现：`Footnote.tsx` 里的行内 `FootnoteReference` 节点自己持有 `note` 文本，文末 `FootnoteList` 的 `entries` 由编号插件从正文**推导回写**。**改脚注时要同时维护"文末列表是派生物"这个不变式**，别让两处各自成为真相。
- **公式的 LaTeX 源和渲染结果是两份东西，都要留。** `Mathematics.ts` 在 KaTeX 渲染结果旁边保留 `data-latex`：**只留渲染后的 DOM，HTML 再导入时公式就改不动了**（源丢了）。同理唯一 ID 由 `UniqueID.configure({ types: ["blockMath", "table"] })` 补 `data-id`，交叉引用靠它定位——**改这两处等于同时改导出与交叉引用**，改完必须跑学术测试。
- **KaTeX 的 CSS 要在编辑器里引（`katex/dist/katex.min.css`）。** 不引的话 `getHTML()` 里照样有 `katex-html` 标记，但页面上公式是散的——"编辑器与导出一致"这条验收会以"看起来不一致"的形式挂掉，而单测**测不出来**（单测只看标记在不在）。
- **工具栏是学术专用的，不是 W2 的格式工具栏。** `AcademicToolbar.tsx` 只放公式/表格/脚注/引用/交叉引用 + 表格内的行列表操作。**不要顺手把它扩成通用格式工具栏**——`W2`（标题层级、粗斜体、列表、链接、对齐、字符统计）与 `W3`（防抖自动保存、冲突检测）在本条写下时都还没做（**后已分别由 `v0.1.56`（W3）与 `v0.1.57`（W2，独立的 `FormatToolbar`）落地**，见本文顶部两节）。本轮 `v0.1.54` 是**抢在 `v0.1.53` 前面做的**（两者无依赖），写作路线图第 5 节已注明顺序与原表不同。
- **新增依赖只在 `frontend`**：`@tiptap/extension-mathematics` / `-table` / `-unique-id`（均 MIT）与 `katex`。部署时**必须先 `pnpm install --frozen-lockfile` 再 `pnpm run build`**，否则产物里找不到这些扩展、页面在新论文上直接报错。本轮实测 `pnpm install` 新增 6 个包。
- 部署收尾沿用前端既有做法：`pnpm run build` → `pm2 restart paper-reader-frontend` → 探活 → `pm2 save`。**本轮不要重启后端**（无 Kotlin 改动，重启只会白担一次中断风险）。实测线上 favicon `?v=0.1.54`、学术编辑器所在 chunk 与服务端产物 sha256 一致。
- 本轮实测测试基线：前端 **25 个测试文件 / 154 项**（v0.1.52 为 23 / 137），`pnpm exec tsc --noEmit`、`eslint`（改动面）、`pnpm run build` 均 exit 0。**后端本轮 Kotlin 零改动、未构建也未重跑**（`backend/build` 在本 worktree 里根本不存在），81 项是 v0.1.52 的基线、不是本轮实测。以上是**期望值**，不是可以放宽的上限。
- 尚未覆盖：**没有登录态下的浏览器端到端验收**（学术编辑器只在手动论文详情页出现，需要登录；C 端线上登录受登录方式开关限制，见既有记录）。线上证据是「favicon 版本 + 构建产物哈希与本地逐字节一致 + 学术 chunk 确实在部署产物里」，功能正确性由本地测试与构建保证。

## v0.1.52 论文正文落库与 `/api/papers/{id}/content` 读写接口

- 需求编号 `REQ-202609-0257`（**writer 路线图 W1**，见 [WRITER_ROADMAP.md](WRITER_ROADMAP.md) 第 4 节），分支 `feature/v0.1.52`，从 `27fa3e9` 展开。**本轮有真实 Kotlin 改动，后端 jar 已重建并重启**（与 v0.1.50 / v0.1.51 纯前端、有意不重启后端的情形不同）。
- **迁移与实体必须同一轮到位，这是本轮最容易踩的坑。** `V16__paper_content.sql` 给 `pr_papers` 加了 `content_json TEXT` / `content_html TEXT` / `content_version INTEGER`；生产是 `ddl-auto: validate`，**只加迁移不加 `Paper.kt` 字段（或反之、或列名拼错）后端起不来**。反过来，后端单测跑在 H2 `create-drop` + `flyway.enabled: false` 上，**根本不执行 V16、也不校验实体↔列名**，所以「单测全绿」在这一层等于没测；真正的证据是生产启动成功那一次。改这类列时不要只看测试结果。
- **`content_json` 是权威、`content_html` 是派生、`content_version` 每次保存自增。** 需要还原节点树（前端 TipTap）就读 JSON；需要预览/导出就重建 HTML。**不要反过来把 HTML 当权威再解析回 JSON**，那会把节点属性丢掉。`PUT` 是**整篇覆盖**，不合并；请求里省略 `contentHtml` 时该列存 `NULL`，这是预期行为，不是丢数据。
- **元数据与正文是两条互不相干的路径，不要把两者合并回去。** 元数据走 `PATCH /api/papers/{id}`（`UpdatePaperRequest` 里**刻意没有任何 content 字段**，这就是「改摘要不会碰正文」的结构性保证）；正文走 `GET|PUT /api/papers/{id}/content`。**将来给 `UpdatePaperRequest`「顺手」加正文字段，会让元数据接口开始覆盖正文，直接毁掉本轮的验收项。**
- 校验：`contentJson` 必须是 JSON **对象**，传字符串等非对象返回 `400` + `{"code":1003}`（`InvalidParameterException`）。写入按 `findByIdAndUserId` 定位，**别人的论文返回 404 而不是 403**（`code:1004`）；读取同理，这是有意的越权隐藏。
- 删除论文**不需要**为本轮新增清理逻辑：正文是 `pr_papers` 自己的列，随该行一起删掉，所以 `PaperDeletionService` 只加了一句说明注释。**但如果以后把正文拆成独立表，必须同步在这里清理**（该文件的既有规矩是「新增任何引用论文的表都要同步评估」）。
- **前端必须「先加载成功再挂载编辑器」。** `PaperContentArea` 加载失败时只显示文案（`papers.contentLoadFailed`），**绝不能挂载一个空白编辑器** —— 那样用户一按保存就把真实正文整篇覆盖成空。同理 `<PaperEditor key={paper.id} …>` 的 `key` 不能省，否则切换论文时编辑器不重挂载、显示的还是上一篇的正文。初始内容用已存 `contentJson`，**不再拿 `abstractText`（摘要）兜底**。
- 新增两条文案 `papers.contentLoadFailed` / `papers.saveFailed`，**14 个语言包都要加**（缺键会退回中文，不会报错，所以漏了不容易发现）。
- 部署收尾别踩既有的两个坑：后端 JAR 路径带版本号，`pm2 restart paper-reader-backend` 会继续跑旧 JAR，必须 `set -a && . ./.env && set +a` 后在**同一个 shell** 里 `pm2 delete` + `pm2 start`；探活与日志确认后再 `pm2 save`。本轮实测 Flyway `Successfully applied 1 migration … now at version v16`，`/api/health` 本地与公网均返回 `0.1.52`。
- 本轮实测测试基线：前端 **23 个测试文件 / 137 项**（v0.1.51 为 22 / 129），后端 **81 项**（原 73）。均为**期望值**，不是可以放宽的上限。
- 尚未覆盖：浏览器层面「刷新 / 重新登录后正文仍在」目前只有接口往返 + 直接查库 + 单测三方证据，**没有登录态下的截图式验收**；`content_version` 只记录、不校验，真正的乐观锁冲突检测留给 W3（**已于 `v0.1.56` 落地：`PUT` 支持可选 `baseVersion`，不符即 `409`/业务码 `1008`，见本文档 v0.1.56 条目**）。

## v0.1.51 菜单栏计数回退为行内、侧栏角标保留

- 需求编号仍是 `REQ-202609-0126`（是 v0.1.50 的**范围纠正**，不是新需求），分支 `feature/v0.1.51`，从 v0.1.50 的发布提交 `f2f708e` 展开。**「菜单栏」和「侧栏」是两个不同的组件，不要再混为一谈**：
  - **菜单栏** = `frontend/src/components/layout/Sidebar.tsx`，全局左栏 `w-[220px]`，含「书架 / 发现 / 交流」三个分区（library / history / created / notes / annotations / tags / circle / chats）。这里的计数**保持原来的行内形态**：`<span className="flex-1 text-start">{t(key)}</span>` 标签 + `<span className="ms-auto … rounded-[10px]">` 胶囊，两者是 flex 兄弟，数字跟在文字屁股后面（`Sidebar.tsx:96-102`）。v0.1.50 把它也改成了角标，属越界改动，本轮已回退。
  - **侧栏** = 点开菜单之后左栏里的 `TabBar`（「我的书架」的所有 / 创建 / 导入 / 收藏，挂在 `components/papers/PaperList.tsx`）。**只有这里**才用角标，v0.1.50 对 `TabBar` 的改动是对的，本轮一字未动。
- 判断依据是容器形态，不是「统一风格」：菜单栏每行是一个 full-width 条目、标签空间宽裕，行内计数从来不会被挤成竖排；侧栏在 `w-72`（288px，内容 287px）里是四个 `flex-1` 均分 ≈72px，扣掉 `px-3` 只剩 ≈48px，行内计数才会把中文标题挤成逐字竖排。**只有「窄容器 + 均分」这个组合才需要角标**，宽松的单列列表不需要。
- `Sidebar.tsx` 回退后与 v0.1.50 之前的原始版本只差两个类名：`text-left → text-start`、`ml-auto → ms-auto`（LTR 下渲染完全一致，RTL 下方向正确）。**这两处逻辑类要保留**，不要为了「完全回退」改回物理方向类。
- 组件级回归：本轮**没有**给菜单栏加新测试 —— 菜单栏的要求是「回到原样」，锁死具体类名只会挡住以后的正当改动；侧栏的 `frontend/src/test/tabbar-badge.test.tsx`（5 例）继续锁角标形态，**不要动它**。
- 本轮**无接口改动、无数据库迁移、无新依赖**，后端 Kotlin 零改动（`backend/VERSION` 按发布规范统一到 `0.1.51`，但 jar 有意不重建、`paper-reader-backend` 不重启，线上仍是 `paper-reader-backend-0.1.49.jar`，故 `/api/health` 仍返回 `0.1.49`）。判断前端版本请看 favicon `?v=0.1.51` 与构建产物哈希。
- 状态：已发布（提交 `8331e47` + `f3ff2be`，`--no-ff` 合并提交 `cd46367`，`pnpm run build` + `pm2 restart paper-reader-frontend`，重启计数 12 → 13，2026-09-17 14:22:03 UTC 起 online）。线上实测：服务端 CSS（`0f36cad2d495bd20.css` sha256 `276f1a16…`）与 `[locale]/page-0788348c7811f6f2.js`（sha256 `f7674fbf…`）和本地构建逐字节一致，同一份 CSS 里 `ms-auto`/`px-[7px]`/`py-[2px]`/`rounded-[10px]`（菜单栏行内胶囊）与 `min-w-[16px]`/`.-end-2`（侧栏角标）**并存**、`ml-auto` 0 处；`zh` 与 `ar` 下菜单栏八行胶囊均 `position: static` 且落在行内，侧栏四个 71.75px tab 角标仍 `absolute` / `-8px`；负对照注入 v0.1.50 的角标结构后检测器读出 `absolute`，证明度量有效。
- 本轮 `feature/v0.1.51` 合入 `main` 后，把 `dev` 从 `f2f708e` **快进**到 `main`（先到 `--no-ff` 合并提交 `cd46367`；随后该分支上追加的仅文档同步提交又以第二个显式 `--no-ff` 合并提交带入 `main`，`dev` 一并快进到该提交；全程非强推、未改写历史）。`main` 与 `dev` 现同指这第二个合并提交，`feature/v0.1.51` 是其祖先。后续分支按 `feature → dev → main` 走，开分支前先确认 `dev` 不落后于 `main`。

## v0.1.50 侧栏（`TabBar`）菜单计数徽标改为标题角标

> 下节的「必须用角标」结论**只适用于侧栏 `TabBar`**；它当时对菜单栏 `Sidebar.tsx` 一并做的角标改动已在 v0.1.51 回退，见上一节。

- 本轮需求编号 `REQ-202609-0126`，分支 `feature/v0.1.50`，从 `b0409ef` 展开。根因不是计数来源，是布局：`TabBar` 每个页签 `flex-1` 在 `w-72`（288px，内容 287px）的左栏里均分到 ≈72px，扣掉 `px-3` 后只剩 ≈48px 给「标题 + 徽标」，中文于是按字断行，变成逐字竖排。
- **侧栏 `TabBar` 的徽标必须是脱离文档流的绝对定位角标：`absolute -top-2 -end-2`。不要再改回 `inline-flex` 行内并排 + `gap-*`**，那正是本轮要修的 bug —— 行内徽标会抢标题宽度，`frontend/src/test/tabbar-badge.test.tsx` 已用 `badge.classList.contains("absolute")` 上锁（实测把 `absolute` 去掉，该用例在 `tabbar-badge.test.tsx:44` 以 `expected false to be true` 失败）。**但这条不要外推到菜单栏**：`Sidebar.tsx` 是单列 full-width 条目，标签宽度够用，行内胶囊就是它的正确形态。
- **标题外面的 `relative inline-flex min-w-0 max-w-full` 包装层和标题上的 `truncate` 都不要删**：包装层是角标的定位容器（删了角标会飘到页签左上角而不是标题右上角），`truncate` 负责极端窄容器下兜底，删了会退回逐字换行。
- **方向与偏移一律用逻辑类（`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`text-start`），不得用 `ml-`/`mr-`/`left-`/`right-`/`text-left`。** 本轮把 `Sidebar.tsx` 原有的 `ml-auto` + `text-left` 换成了 `ms-auto` + `text-start`，v0.1.51 回退角标形态时**保留了这两个逻辑类**（LTR 下与原来的物理类渲染一致，`ar`/`fa`/`ug` 三种 RTL 语言下方向才正确）—— 回退的是「角标 vs 行内」的形态，不是方向类，两件事分开看。
- `TabBar` 是共用组件，「我的书架」左栏（`components/papers/PaperList.tsx`）与阅读器右栏（`components/layout/RightPanel.tsx:170`）同时受益；右栏目前 tabs 无 `count`，改 `TabBar` 会一起影响，改之前先确认右栏窄容器下的表现。
- `data-tab-key` 属性和下划线指示器的 `ResizeObserver` 逻辑本轮未动，**不要为了改角标顺手重排**：指示器靠 `querySelectorAll("[data-tab-key]")` 定位。
- 本轮**无接口改动、无数据库迁移、无新依赖**，后端 Kotlin 零改动。按全局「代码完成 = 合入生产分支并部署」的口径本轮只重建并重启了前端 PM2 进程（`paper-reader-frontend`），**后端 `paper-reader-backend` 刻意未重启**（必须带 `backend/.env` 启动，无关重启只会制造事故），因此线上 `/api/health` 仍返回 `0.1.49`，这是有意为之的版本漂移，不是部署漏做。
- 本轮 `feature/v0.1.50` 合入 `main` 后**没有动 `dev`**（`dev` 当时仍停在 `b0409ef`，是本轮的祖先）；把 `dev` 快进到当时的 `main` 是 **v0.1.51** 做的事（`f2f708e` → `cd46367`，随后又跟到 `main` 上文档同步的第二个合并提交），别把两轮记混。后续分支仍按 `feature → dev → main` 走，开分支前先确认 `dev` 不落后于 `main`。

## v0.1.48 国际化语言切换

- 本轮需求编号 `REQ-202609-0111`，从已发布的 v0.1.45 基线开 `feature/v0.1.46`。**加语言只改两处**：`frontend/src/i18n/locales.ts` 的 `LOCALES` / `LOCALE_META`，以及新增 `frontend/src/i18n/locales/<code>/common.json`。切换器、设置页、`<html lang/dir>`、浏览器语言协商都是从注册表读的，不要去组件里硬编码语言列表。
- **切换语言必须走 `applyLocale()`（`src/i18n/switch-locale.ts`），它做整页跳转 `window.location.assign`，不能改成 `router.push`。** 根布局 `app/layout.tsx` 在 `app/[locale]/` **之上**，客户端软导航不会重渲染它——`<html lang>`、`<html dir>` 和 `NextIntlClientProvider` 的文案都会停在旧语言。登录页「语言切换点了没反应」就是这么来的，改回软导航会立刻复现。
- **判断「用户选过语言」只能看 localStorage 的 `paperhelper.locale-chosen`，不能看 `NEXT_LOCALE` Cookie。** next-intl 中间件每次请求都会按协商结果把 Cookie 写上，Cookie 有值不代表用户选过；用 Cookie 判断会让「新设备登录跟随账号偏好」这条路径永远走不到。
- Cookie 名是 `NEXT_LOCALE`，注册在 `src/i18n/routing.ts` 的 `localeCookie`，有效期一年。写 Cookie 的地方只有 `switch-locale.ts`，别在组件里另写一份 `document.cookie`。
- `src/i18n/request.ts` 里那段 **Cookie 兜底不能删**：`/callback` 被 `src/middleware.ts` 刻意绕开了 intl 中间件，拿不到 locale 头，next-intl 自己也不读 Cookie（`getRequestLocale` 只认中间件头），删掉之后 GitHub 回调页会永远停在简体中文。同一文件里的 **`zh` 兜底合并也不能删**：任何一种语言缺键时靠它显示中文，而不是显示 key 名。
- 组件外的文案（`src/lib/api/client.ts`、`src/lib/ai-provider.ts`、`src/lib/ai-chat-response.ts`、`src/lib/device.ts`、各 Zustand store）走 `runtimeTranslator()`（`src/i18n/runtime.ts`），消息表由根布局的 `RuntimeLocaleBridge` 在**渲染期**登记。**取文案要写在调用的函数里，不能提到模块顶层做常量**，否则语言切换后常量还是旧语言；`RuntimeLocaleBridge` 里那次赋值也别挪进 `useEffect`，否则首屏之后立刻发出的请求取不到消息表。
- RTL（`ar` / `fa` / `ug`）靠两件事：根布局按 `LOCALE_META[locale].dir` 写 `<html dir>`，布局代码用 Tailwind 逻辑方向工具类（`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`text-start`/`border-e`）。**新写布局时不要用 `ml-`/`pr-`/`left-`/`text-left`**，否则这三种语言下元素会钉死在左边。
- `en` 是**兼容项**：需求给的 13 种语言里没有英文，但线上已有用户把偏好设成 `en`、`/en/*` 老链接也在用，所以保留在 `LOCALES` 末尾。**不要因为「需求没写」把它删掉**，删了这批用户和老链接一起失效。
- 文案源是 `locales/zh/common.json`（833 条，按拍平后的可翻译条目计；叶子键 691 个）。**任何语言包都必须与 zh 等键**（14 个包逐条对齐，0 缺 0 多），缺键会退回中文显示。批量翻译脚本在 `/tmp`（不入库），走的是外部代理、有 429 限流，翻译完必须抽查。
- **语言下拉「看不见 / 点不着」多半是层叠问题，不是 next-intl 的问题。** 菜单是 `z-50`，但 `z-index` 只在自己所在的层叠上下文里比大小，真正较劲的是「挂菜单的容器」和它的兄弟。登录页 `(auth)/layout.tsx` 原来是顶栏和内容行同为 `z-10` 的兄弟、内容行在 DOM 里更靠后，于是菜单被登录卡片压住（线上实测：`elementFromPoint` 命中的是 `DIV.space-y-5 px-8 py-2`，选项点不动）。现在顶栏是 `z-30`，`frontend/src/test/auth-layout.test.tsx` 用 `zIndexOf(header) > zIndexOf(row)` 锁住这条不变量，**改回 `z-10` 该用例会以 `expected 10 to be greater than 10` 失败**，别为了让两条 `z-10` 对齐而改测试。移动切换器时先确认新容器的 `z-index` 打得过兄弟，只把菜单本身的数值往上加没用。
- 后端 `UserSettings.language`（默认 `zh`）与 `GET/PUT /api/settings` 早就在，**本轮后端零改动**，只是前端开始真正读写它；偏好里的语言值前端用 `isAppLocale` 兜底，写进库的非法值只会被忽略、不会报错。
- 本轮**无接口改动、无数据库迁移、无新依赖**，后端 Kotlin 代码未改，只随版本号重新构建与重启。
- 本轮的收尾要把 v0.1.47 新增的几处中文并进 i18n：`ProfileDialog.tsx` 的「图片太大，请换一张 700KB 以内的图片」、`aria-label="更换头像"`、`placeholder="未绑定邮箱"` 都走 `t()`；`frontend/src/test/profile-dialog.test.tsx` 用 `src/test/intl.tsx` 的 `withIntl` 包一层。头像菜单的默认头像 / 点击外部收起逻辑原样保留，只是文案改为取消息表。
- 本轮从 v0.1.47（`V15__widen_user_avatar.sql` 已在生产执行）之上展开，**分支里必须带着这个迁移文件**，否则 Flyway 会以 `Detected applied migration not resolved locally` 拒绝启动。

## v0.1.47 登录后的默认身份与个人中心邮箱

- 本轮需求编号 `REQ-202609-0110`，分支 `feature/v0.1.47`，从 `f5c8838`（= 已发布的 v0.1.45 基线 = 当时的 `main`）快进展开。**并行需求 `REQ-202609-0111`（多语言，分支 `feature/v0.1.46`，worktree `/root/paper-reader.wt-req-202609-0111`）到本轮合并时仍全部未提交**，所以没有形成合并冲突；那条分支之后 rebase 时请把版本号往上走（不要退回 `0.1.46`），并把 `frontend/src/components/settings/ProfileDialog.tsx` 的默认头像 / 点击外部收起逻辑串进它已有的 i18n 结构、给 `frontend/src/test/profile-dialog.test.tsx` 包一层 `src/test/intl.tsx` 的 `withIntl`。**最要紧的一条：`V15__widen_user_avatar.sql` 已在生产执行，任何之后要部署的分支都必须包含这个文件**，否则 Flyway 会以 `Detected applied migration not resolved locally` 拒绝启动、整个后端起不来。核心症状是「登录之后个人中心用户名、邮箱、头像全是空的」，**根因在登录链路、不在个人中心组件**：根布局的 `SessionLoader` 只在整页加载时跑一次，登录成功走的是客户端路由跳转，不会重挂载根布局，于是 `useUserStore.profile` 一直是 `null`。修法是在 `stores/auth-store.ts` 的 `applyTokens` 成功后立刻 `loadProfile()`，**不要再把这个调用搬到 `LoginForm` / `SessionLoader` 里**，那两个文件正被 i18n 迭代改着，而且 `applyTokens` 是邮箱验证码、密码、GitHub 三条登录路径的唯一汇合点，放这里一次覆盖三条。`loadProfile` 内部用 `inflight` 对并发调用去重，重复调不会多打一次 `/auth/me`。
- **`frontend/src/lib/user-display.ts` 是身份展示的唯一来源**：个人中心、顶栏 `UserMenu`、聊天 `ChatPanel` 都从它取，不要各自再写一遍取首字母的逻辑。`defaultAvatar` 按需求取**邮箱首字母**（英文大写、数字原样、中文原样），底色由邮箱哈希从固定调色板选，前景色按 WCAG 相对亮度在白色和深墨 `#1f2933` 之间择优，对比度恒 ≥ 4.5——**不要改成固定白色或固定深色**，浅底色配白字就是需求里说的「颜色对不上、看不清」。取不到邮箱时显示 `?` 只应发生在 profile 真的没加载出来的时候。
- `defaultDisplayName` 的优先级是：用户自己设的昵称 → `用户{id}` → 邮箱前缀 → `用户`。**不要再退回「用邮箱前缀当默认用户名」**，本轮就是因为个人中心直接显示 ID / 空字符串才被提的需求。个人中心的昵称输入框用默认名做 `placeholder`（不是 value），用户没填过时看到的是系统名，一填就覆盖。
- 头像菜单（上传图片 / 网络图片）的关闭逻辑在 `ProfileDialog.tsx` 的 `AvatarSection`，监听 `document` 的 `mousedown` + `keydown(Escape)`；**菜单自身 `menuRef` 和触发按钮 `avatarRef` 都在豁免范围内，不要删这两个判断**，否则点相机按钮会「开了立刻关」。用 `mousedown` 而不是 `click` 是为了和已有的 hover 展开行为一致。
- **后端 `AuthService.githubLogin` 的占位邮箱不能当成真实邮箱用**：GitHub 的 `/user` 在邮箱设为私密时不返回 `email`，历史数据里存的是 `{login}@github.user`。现在会兜底读 `/user/emails` 取主邮箱，并在下次登录时回填老账号；**回填前必须查重**，真实邮箱已属于别的账号时保留占位并打 WARN，绝不能把两个用户指向同一个邮箱（`email` 有唯一约束，硬改会直接 500）。
- `V15__widen_user_avatar.sql` 把 `pr_users.avatar_url` 从 `VARCHAR(500)` 放宽到 `VARCHAR(1000000)`。**类型必须保持 varchar**：`User.kt` 上是 `@Column(length = ...)`，生产 `ddl-auto=validate`，改成 `TEXT` 会导致启动校验失败、整个后端起不来。前端 `MAX_AVATAR_DATA_URL_LENGTH = 900000` 是配套的客户端上限，改小可以、改大之前先确认列宽和请求体大小限制。
- 本轮**有数据库迁移（V15）、无接口出入参变化、无新依赖**。部署时后端必须带 `backend/.env` 启动（同 shell `set -a; . ./backend/.env; set +a` 后再 `pm2 delete` + `pm2 start`），V15 会在启动时由 Flyway 执行。

## v0.1.45 登录页垂直居中

- 本轮需求编号 `REQ-202609-0106`，从已发布的 v0.1.44 基线开 `feature/v0.1.45`。改动**只有一个文件**：`frontend/src/app/[locale]/(auth)/layout.tsx`。
- 登录页骨架是 `main.flex.min-h-screen.flex-col` 三段（顶栏 / 内容区 / 页脚）。中间那行现在带 `flex-1 items-center`，**这两个类不能删任何一个**：删 `flex-1` 富余空间又会被页脚的 `mt-auto` 全部吸走、内容重新贴顶（这正是本次要修的 bug）；删 `items-center` 只是白占空间不居中。`auth-layout.test.tsx` 就是锁这两个类，去掉后该用例必须失败。
- **栅格上的 `items-stretch` 也不要顺手改成 `items-center`**。左栏 `LoginExperience` 内部有一条 `mt-auto` 的说明文案，靠列拉伸才能和右侧更高的登录卡片底部对齐；改成 `items-center` 会缩掉左栏高度、把文案往上拽，视觉上反而更乱。本次只挪整块的垂直位置，不动内部构图。
- 页面高度靠的是 `min-h-screen` + 平分的三段，**不要改成 `justify-center` 或绝对定位**：矮视口下 `justify-center` 会让内容上下两端同时被裁掉且无法滚到。现在 flex 项保持默认 `min-height: auto`，内容超出视口时照常滚动。
- 右栏外面那层 `<div className="flex w-full items-center justify-center">` 负责把表单在列内居中，与本次的整行居中无关，别一起删。
- 本轮**无接口改动、无数据库迁移、无新依赖**，后端 Kotlin 代码未改，只随版本号重新构建与重启。

## v0.1.44 接入通知中心

- 本轮需求编号 `REQ-202609-0107`，从已发布的 v0.1.43 基线开 `feature/v0.1.44`。发信**不在本仓库**：所有邮件都由本机通知中心（`bendywork-notify-center`）渲染和投递，本项目只负责请求。
- 唯一的对接点是 `backend/src/main/kotlin/org/paperreader/service/NotifyCenterClient.kt`。要加新的通知类型就在里面加一个 `@Async("notifyExecutor")` 方法 + 一个 `Template` 枚举值，**不要在业务 Service 里直接拼 HTTP 请求或注入 RestTemplate**——超时、鉴权、token 缓存、异常吞掉这几件事只在这一个类里做。
- **`target_user_ids` 绝对不能用 `"0"` 或 `"-1"`**。通知中心的 `parseTargetUsers` 把这两个值解释成「所有在线连接」，登录验证码一旦这么传就等于给每个在线 WebSocket 客户端广播别人的验证码。登录码用真实用户 id，邮箱还没注册就用字面量 `"guest"`。
- **登录验证码必须同时放进 `body`**，不能只放 `template_data`。通知中心对未知模板会回退成纯文本发送，模板还没上线（或灰度中）时用户只有靠 `body` 里的码才登得进去。反过来 `title` 是固定文案、**不要把验证码写进标题**：标题会随通知记录持久化，写进去等于把码存进库。
- 发送失败是**静默**的：`send()` 里 try/catch 只记 WARN，`@Async` 又跑在独立线程池上，所以通知中心挂掉不会让登录/发消息报错。这是有意的，不要改成抛异常往上冒。
- 线程池是 `notifyExecutor`（core 1 / max 2、队列 200，随应用关闭等 5 秒）。它故意开得很小：通知是旁路，不能跟 GROBID 抢资源；队列满了会丢通知，可以接受。
- HTTP 客户端是专用的 `notifyRestTemplate`（连接/读取各 5 秒，`app.notify.timeout-ms`），**不要改回用 GROBID 那个 60 秒的 `restTemplate`**，否则通知中心一卡就会占住线程 60 秒。原 `restTemplate` 已标 `@Primary`、注入点用 `@Qualifier("notifyRestTemplate")` 显式指定，加新的 RestTemplate Bean 时注意别把歧义又引回来。
- 防刷的两把锁都是 Redis：`pr:email_code_cooldown:<email>`（60 秒，与前端倒计时同值）和 `pr:group_notify:<groupId>:<userId>`（10 分钟）。节流键是**先占后发**，发送失败会白丢一个窗口——为了让配额可控，这个取舍是有意的。通知中心侧每家 provider 每月 3000 封，别把节流关掉。
- 配置项在 `application.yml` 的 `app.notify.*`，环境变量是 `NOTIFY_CENTER_*`。**真实 AKSK 只写进 `/root/paper-reader/backend/.env`（gitignore，不要提交）**，仓库里只留 `backend/.env.example`。`NOTIFY_CENTER_BASE_URL` 等留空时 `isConfigured` 为 false，客户端直接跳过并记日志，本地开发不需要配。
- 模板字段与验收标准见 `docs/NOTIFICATION_TEMPLATES.md`，那份文档是给通知中心团队的契约。**改字段名要两边一起改**：本项目按约定的 key 组装 `template_data`，通知中心按同一个 key 渲染。
- 本轮**不改通知中心的 D1 schema**（`template` / `template_data` 只在内存里透传）。账号级 D1 行读配额一旦打满，带建表探测的版本会把整个 Worker 拖挂，历史上有过教训，所以模板功能刻意不落库。

## v0.1.42 两步验证表单排版

- 本轮仍是 `REQ-202609-0104`，在已发布的 v0.1.41 上开的 UI 打磨迭代 `feature/v0.1.42`。
- **6 位动态码现在是 6 个独立输入格**（`frontend/src/components/settings/OtpInput.tsx`），受控组件的 `value` 是纯数字字符串、不补空格。内部按「单格覆盖、整串粘贴铺开」改写字符串，别改成非受控或加 `defaultValue`，否则退格/粘贴逻辑会错乱。
- `OtpInput` 的 `variant` 只管底色：放进铺了 `surface-2` 的面板里要传 `inset`，格子才改用 `surface-1`，否则格子跟面板糊成一片。新增使用处时先看父容器底色。
- 复制逻辑已抽到 `frontend/src/lib/clipboard.ts` 的 `copyToClipboard()`，恢复码面板与手动密钥共用。**不要再各写一份 `navigator.clipboard` + `fallbackCopy`**：内网 http 部署下 Clipboard API 不存在，兜底分支不能删。
- `FieldRow` 负责「左标签右输入」：标签列 `sm:w-24` + `sm:text-right`、输入列 `sm:flex-1`、两列间距 `sm:gap-6`。它是 `TwoFactorTab.tsx` 内的局部组件，目前只有这一个文件在用；若要挪到公共位置，记得同步改「重新生成恢复码」「关闭两步验证」两处调用。
- 窄屏（`sm` 以下）故意回到上下堆叠，不是漏写响应式：6 格动态码在 375px 宽度下横排会被挤变形。
- 本轮**没有改任何请求**：`enableTwoFactor({ password, code })`、`disableTwoFactor({ password, code })` 的入参不变，`code` 仍是 6 位纯数字字符串。后端无迁移、无接口改动、Kotlin 代码未改，只跟着版本号重新构建与重启。

## v0.1.41 两步验证挑战失效提示

- 本轮需求编号仍为 `REQ-202609-0104`，是在已发布的 v0.1.40 上开的补丁迭代 `feature/v0.1.41`。
- 唯一的行为改动在 `AuthService.verifyTwoFactor()`：`jwtUtil.extractClaims()` 外包一层 `catch (io.jsonwebtoken.JwtException)`，转成 `InvalidCredentialsException("登录凭证已失效，请重新登录")`。改动前挑战 token 过期会返回 500。
- **只包这一处，不要顺手把 `login`/`refresh`/`emailLogin` 也改成同样处理**。项目既有约定就是「JWT 解析失败 → 兜底 500」（`GlobalExceptionHandler` 只翻译 `BusinessException` 与 `IllegalArgumentException`），公网核验 `/api/auth/refresh` 传垃圾 token 同样返回 500。要统一改那是另一个迭代的事，本轮刻意不扩大改动面。
- 挑战 token 有效期 5 分钟，由 `JwtUtil.generateTwoFactorChallengeToken()` 决定。这条提示只保证「过期后不报 500」，前端仍需引导用户回到密码步骤；`auth-store` 的 `cancelTwoFactor()` 已把 `twoFactorChallengeToken` 与 `sessionStorage` 中的 `pr_2fa_challenge` 一起清掉。
- 本轮无数据库迁移、无前端业务逻辑改动、无新依赖，版本号（前后端 VERSION、`package.json`、`build.gradle.kts`、favicon `?v=`）统一升到 `0.1.41`。

## v0.1.40 个人中心两步验证功能完善

- 本轮需求编号为 `REQ-202609-0104`，使用普通迭代分支 `feature/v0.1.40`（与 v0.1.33 之后的迭代命名保持一致）。
- **本轮有数据库迁移**：`V14__two_factor_and_trusted_devices.sql` 新建 `pr_user_two_factor`、`pr_user_recovery_codes`、`pr_user_devices` 三张表。后端 `ddl-auto: validate`，部署时 Flyway 必须先跑通，否则整个服务起不来。
- 后端 TOTP 是自研实现（`security/Totp.kt`，javax.crypto HMAC-SHA1），**没有引入任何新的 Gradle 依赖**，不要为了「抄个库」去加 `commons-codec`、`googleauth` 之类依赖；`TotpTest` 已用 RFC 6238 官方向量（`287082`/`081804`/`050471`/`005924`/`279037`）锁住正确性。
- RFC 向量的断言方式：官方给的是 8 位值，本项目输出 6 位；因为 10^6 整除 10^8，6 位等于 8 位的后 6 位。改断言前先想清楚这一点，别把 `code()` 换成自己的输出再比。
- 恢复码的设计是「关闭即删除」：`disable()` 里 `recoveryCodeRepository.deleteByUserId()`，这样「恢复码只在两步验证开启期间有效」是结构性保证，不要图省事改成使用时再判断 `enabled`。
- 恢复码只允许两种保存方式：一键复制、下载成 **txt 文本文件**。用户明确说过「我们不支持 pdf」，不要自作主张加 PDF 导出。
- 二维码配色（`QrCodeCard.tsx`，v0.1.43 起）：**固定深色码点 + 白底，不跟随主题反相**。用户明确说过深色主题下那块深底「很别扭、很严肃」，所以不要再把配色接回 `useTheme`；想让它柔和靠外层的圆角白卡片（`rounded-2xl` + 细边框 + `shadow-sm` + `p-3`），不要靠换底色。
- 二维码内层的浅色方块**不加圆角、不加 `overflow-hidden`**：码点四周的浅色静默区被圆角切掉会影响部分机型识别。圆角只加在外层卡片上，`margin` 保持 1，四周的白色边距由 `p-3` 提供（`qr-code-card.test.tsx` 已锁住这两条）。
- 设备吊销复用 JWT 的 `did` 声明：`JwtAuthFilter` 与 refresh 接口都会调用 `DeviceService.isDeviceActive`。没有 `did` 的历史 token 视为有效（避免上线即全站登出），这是有意为之。
- 个人中心菜单由 4 个变 5 个，新增「信任设备」与「两步验证」同级；`ProfileDialog.tsx` 里的 `TwoFactorTab` 已改为从 `./TwoFactorTab` 导入，**不要再在 `ProfileDialog.tsx` 内定义同名本地函数**（会与 import 冲突）。
- GitHub 回调登录会整页跳转，因此 2FA 挑战 token 暂存在 `sessionStorage`（`pr_2fa_challenge`）并由 `loadPendingChallenge()`/`hydrateChallenge()` 恢复；改登录跳转逻辑时不要把这个兜底删掉。
- 本轮不涉及后台管理项目、共享 PostgreSQL/Redis/GROBID 配置或 `backend/uploads`。

## v0.1.39 登录页展示区位置微调

- 本轮需求编号为 `REQ-202609-0103`，使用普通迭代分支 `feature/v0.1.39`（不是 `-fix`，与 v0.1.33 之后的迭代命名保持一致）。
- 改动只发生在 `frontend/src/components/auth/LoginExperience.tsx` 的 `<section>` 内边距：`lg:pl-10 lg:pt-10`、`xl:pl-16 xl:pt-14`。展示区整体右移下移，右侧登录表单一列不受影响。
- 不要改成给整个栅格或登录卡片加偏移来“对齐”——那会移动登录表单，明确超出本轮需求。
- 展示区在 `lg` 以下仍然 `hidden`，窄屏（手机/平板）行为与 v0.1.38 完全一致，不要顺手改成显示。
- 内边距已按 `lg` 断点最窄栅格列宽（约 556px）核算：正文 `max-w-md`（448px）+ 左侧 64px 内边距仍在列内，不会挤压标题换行或溢出。
- 位于展示区底部的标语（`mt-auto`）固定在列底，只跟着右移，不跟着下移；这是有意为之，不要为了“统一”把它也往下推。
- 本轮只修改前端展示与版本元数据，不涉及数据库、后端 API、共享 PostgreSQL/Redis/GROBID 或 `backend/uploads`。

## v0.1.32 论文助手 C 端登录页面优化

- 本轮需求编号为 `REQ-202609-0070`，使用普通迭代分支 `feature/v0.1.32`。
- 登录表单继续复用现有认证状态和 API；左侧粒子画布只负责视觉展示，轮播内容不依赖外部网络或用户数据。
- 左侧展示区仅在桌面布局中展示，窄屏隐藏展示区以保证登录表单可用；轮播按钮提供 aria-label，中英文文案必须同步维护。
- 本轮只修改前端展示和版本元数据，不涉及数据库、后端 API、共享 PostgreSQL/Redis/GROBID 或 `backend/uploads`。

# PaperHelper 注意事项

## v0.1.23 外部论文元数据补全注意事项（已部署）

- `feature/v0.1.23` 已按 `feature -> dev -> main` 流程合并并部署生产；全量测试、V13 迁移和公网验收均已完成。当前生产 API 与前端版本均为 `0.1.23`，本次未执行历史论文批量刷新。
- arXiv ID 的版本后缀 `v7` 表示修订版本，绝不能写进出版卷号；`15 pages` 是预印本说明，不能写进出版页码。
- `10.48550/arXiv.<id>` 是 arXiv/DataCite 仓储 DOI，不等于出版社正式 DOI。正式 DOI 不存在时必须保留为空，不能猜测。
- arXiv Atom/OAI 的字段只代表预印本形态；正式会议/期刊卷期页必须来自明确关联的官方 proceedings 或领域书目源，并在来源中标注，不能把两个形态写进同一套字段。DBLP 是书目核对源，不自动等同于出版社官方证明。
- 标题、作者和摘要完全相同也不足以自动认定 DOI。Crossref/OpenAlex 当前存在 Attention 论文的 2025 同名异常候选，模糊搜索永远只能生成候选，不能静默写入。
- 外部补全默认只填空值。任何非空人工值、已确认值或来源冲突都必须展示差异并由用户选择，不能用 Provider 整条记录覆盖 Paper。
- `pageCount` 是当前 PDF 物理页数，`publicationPages` 是正式出版页码；两者必须分别存储和展示。
- 现有 `journal` 与 `extraFields.journalName`、以及 JSON 中的 volume/issue/pages 是迁移风险。V13 当前只增加 resolution/source/provenance 三类表并保留旧值；完整 manifestation/identifier 模型尚未落地，不得在文档或 UI 中宣称已完成。
- 新增来源/标识表时使用 `ON DELETE CASCADE`，或同步更新 `PaperDeletionService`；不能让新增外键破坏论文删除流程。
- 外部补全与异步 GROBID、人工编辑可能并发。必须使用字段级 merge 和并发版本校验，禁止 last-write-wins 整行覆盖。
- arXiv Atom/OAI 等 legacy API 所有受控机器合计每三秒最多一次请求且单连接。必须加入缓存、全局限流、退避、负缓存和重复请求合并。
- 常规链路使用官方机器接口，不解析 arXiv HTML；Provider 客户端只允许固定 HTTPS 域名/路径，禁用 XML 外部实体并限制响应大小。
- 模糊查询会把论文标题、作者等信息发送给第三方；私密论文场景需显式触发或用户配置允许，绝不发送 PDF 正文、TEI 全文、批注、笔记或 AI 对话。
- SCI、EI、SSCI、CSSCI、北大核心等需要授权名单和按年份核验；arXiv 分类、OpenAlex `is_core`、DOAJ 或主题字段都不能当作收录证明。
- Provider 不可用或限流不得阻断 PDF 上传、GROBID 解析、阅读、批注、笔记和人工元数据编辑。
- 官方 proceedings Provider 只能访问固定 HTTPS 域名和路径；不能为了补卷页而开放任意 URL 抓取或绕过来源校验。
- resolve 结果是 15 分钟短期快照；apply 必须再次校验论文所属用户、resolution 所属用户、过期时间和 `expectedUpdatedAt`。论文被其他操作更新后必须重新刷新预览。
- apply 只接受快照中已有的字段名，不接受客户端回传任意 Provider 值。默认只选择空字段；冲突字段与正式发表候选必须由用户明确勾选。
- 当前 V13 的 `payload`、Provider 快照和 provenance 只允许白名单元数据；不得保存 PDF 正文、完整 TEI、批注、笔记、AI 对话或凭据。
- 当前实现按 `extra.*` 保存 arXiv/出版扩展字段；`pageCount` 仍表示 PDF 物理页数，`extra.publicationPages` 才表示正式出版页码，不能互换。

## v0.1.22 当前迭代注意事项

- 本次是交接与维护需求，版本为 `v0.1.22`、分支为 `feature/v0.1.22`，不追加 `-fix`。
- 真实 `backend/.env` 和 `frontend/.env.local` 只从 Git 索引移除，本机文件必须保留，不能因此删除或覆盖生产配置。
- 任何文档、diff、测试日志和最终回复都不能包含真实密码、JWT Secret、OAuth Secret、Provider Key、Token、Cookie 或用户数据。
- 历史跟踪过的配置和工具脚本凭据应视为可能泄漏；轮换凭据和清理 Git 历史需要独立授权、备份和回滚，本轮不擅自执行。
- 当前生产基础设施容器没有 Compose labels，不属于仓库 `backend/docker-compose.yml` 的可确认管理范围；生产禁止盲目执行 `docker compose up -d`。
- 当前生产文件存储是 `local`，目录 `/root/paper-reader/backend/uploads` 是用户数据，禁止清空、移动、纳入 Git 或在部署中覆盖。
- 当前生产后端使用 `development` profile，这是已知风险，但本轮只记录，不直接切换。
- 线上已完成 `0.1.23` 验收；后续文档判断仍以 PM2 参数、本机/公网健康接口和实际静态资源为准，不能只看源码版本。
- 本次不修改业务、Flyway、GROBID 服务或 `/root/paperread-admin`。

## v0.1.21 历史迭代注意事项

- 本次是功能迭代，版本为 `v0.1.21`、分支为 `feature/v0.1.21`，不追加 `-fix`。
- 标题清洗只允许匹配位于开头的完整、已确认授权声明；禁止按标题长度、首个句号、大小写或固定词数粗暴截断。
- 清洗后的候选标题必须包含字母或数字；否则保留 GROBID 原始标题，不能把非空标题改成空值。
- V12 是受控数据修正迁移，只更新匹配同一明确前缀且剩余标题有效的历史记录；已应用后不得修改其内容。
- 真实样例标题已通过 arXiv `1706.03762` 的权威记录确认是 `Attention Is All You Need`；GROBID 原始 TEI 继续保留，便于审计和未来重新解析。
- 当前卡片标记必须保持内缩、短胶囊和 `pointer-events-none`，不能遮挡卡片点击区域，也不能恢复成全高纯黑边条。
- 选中卡片的背景、边框、标记和阴影都使用明暗主题变量；调整时必须同时回归两种主题。
- 本次不修改或推送 GROBID 解析服务，也不修改 `/root/paperread-admin`。

## v0.1.20 历史迭代注意事项

- 该次是功能迭代，版本为 `v0.1.20`、分支为 `feature/v0.1.20`，不追加 `-fix`。
- 删除弹窗中的“同时删除原文件”默认不勾选；未经用户明确选择，不得物理删除服务器文件。
- `DELETE /api/papers/{id}?deleteFile=false` 只删除数据库记录及关联数据；`deleteFile=true` 才调用文件存储删除。
- 兼容旧客户端：缺少 `deleteFile` 参数时后端同样按 `false` 处理，不得沿用旧接口无条件删除文件的行为。
- 删除前必须使用 `paperId + userId` 校验所有权，不能先操作文件再校验权限。
- 物理文件删除失败必须抛出业务错误并回滚数据库事务，避免记录消失但用户误以为文件也已删除。
- 论文删除要显式清理批注评论、批注、笔记、阅读记录、旧 AI 会话消息、版本、标签和 chunks；后续新增论文关联表时必须同步评估删除链路。
- 服务器文件路径和删除异常不得回传到前端、审计文案或日志之外的用户消息中。
- `hasOriginalFile` 只表示 PaperHelper 记录具有非空文件路径，不执行昂贵的远程文件探测；实际删除仍以存储服务结果为准。
- 卡片三点按钮必须在布局流中拥有固定单元，不能再次用绝对定位覆盖分类标签。

## v0.1.19-fix 历史迭代注意事项

- 本次是问题修复，版本为 `v0.1.19-fix`、分支为 `feature/v0.1.19-fix`。
- `/api/health` 的版本只能来自当前构建生成的 `BuildProperties`，不得再次在 Controller、配置类或启动脚本中手写发布版本。
- `springBoot.buildInfo()` 必须保留；移除后正式 JAR 会退回 `development`，健康检查将无法反映真实发布版本。
- 发布验收必须同时确认 JAR 文件名、JAR 内 `META-INF/build-info.properties`、PM2 启动参数和公网 `/api/health` 四处一致。
- 本次不涉及数据库迁移和 Provider 配置，不得借此修改或输出任何 API Key。
- favicon 缓存参数为 `v=0.1.19-fix`，避免浏览器继续命中上一版本静态资源。

## v0.1.19 历史迭代注意事项

- 本次是功能迭代，版本为 `v0.1.19`、分支为 `feature/v0.1.19`，不追加 `-fix`。
- `<think>` 解析必须跨 SSE chunk，正文和 reasoning 要分别持久化；旧本地消息缺少 reasoning 字段时必须正常读取。
- 论文问答只能使用当前用户有权限的论文上下文；后端返回 chunks 前必须校验 `paperId + userId`，不能通过接口读取其他用户的全文。
- GROBID 原始 TEI 不包含 Provider Key，但仍可能包含论文全文；日志只能记录 paper ID、状态和错误类型，不记录 TEI、选中文本或 Prompt。
- 上传解析使用状态机 `PENDING -> PROCESSING -> READY/FAILED`。删除论文时必须级联删除 chunks，并清理正在执行的任务结果。
- 解析失败不得阻断 PDF 阅读和批注；问答必须有明确的上下文不可用提示，不得静默把空上下文当作完整论文。
- 首版使用文本规范化和相邻 chunks，不引入 embedding、OCR 或向量数据库；任何扩展都要单独评估版本和资源占用。
- 论文上下文只作为模型请求的隐藏上下文，用户气泡显示引用文本和问题，不显示完整系统 Prompt。

## v0.1.18-fix 历史迭代注意事项

- 本次是问题修复，版本为 `v0.1.18-fix`、分支为 `feature/v0.1.18-fix`。
- 每个 `DirectChat` 的 `providerId` 和 `model` 独立持久化；不得用全局激活 Provider 覆盖历史会话。
- 新对话继承前一会话配置，切换历史会话恢复原配置；Provider 被删除后历史仍可读，但发送前必须重新选择现存 Provider。
- 标题生成会在首次正文成功后额外发送一次 `stream: false` 请求，可能增加 Provider 费用和限流占用；标题失败不能覆盖正文成功状态。
- 标题若与用户原问题在忽略标点、符号和空白后相同，客户端拒绝使用，避免退回旧的“问题即标题”行为。
- 直连请求状态按会话 ID 保存；同一会话禁止重复发送，不同会话允许并发。所有异步回调必须写回捕获的目标会话。
- 用户头像缺失时必须显示首字母兜底；助手名称统一为 `PR助手`，处理中、正常和错误状态都要一致。
- `v0.1.18-fix` favicon 请求参数为 `v=0.1.18-fix-r1`。

## 版本与发布

- 普通迭代只增加 patch 版本，当前规则是 `0.1.10 -> 0.1.11 -> 0.1.12`。
- 问题修复迭代在被修复版本后追加 `-fix`，例如 `0.1.12 -> 0.1.12-fix`；分支名同步使用 `feature/v0.1.12-fix`。
- 历史 Provider 测试修复迭代为 `0.1.13-fix`，Provider relay 修复迭代为 `0.1.18-fix`，健康接口版本修复迭代为 `0.1.19-fix`，论文删除功能迭代为 `0.1.20`，标题与卡片迭代为 `0.1.21`，当前交接文档迭代为 `0.1.22`。
- `main` 是仓库默认分支和生产主分支，`dev` 是集成分支；版本分支必须先合并到 `dev`，验证通过后再由 `dev` 合并到 `main`。
- 所有版本分支都要保留，不能因为已经合并就删除。
- 未经明确要求，不要擅自改成 `0.2.0` 或 `1.0.0`。
- 新需求从远程最新发布版本创建下一个版本分支；已发布版本的 Bug 从对应 `-fix` 分支修复，不得在陈旧分支上堆叠。
- 测试与生产构建通过后立即提交并推送远程分支；合并 `main` 后必须执行 PM2/Apache 生产部署和本机、公网验收，开发模式不能代替生产部署。
- 生产验收通过后才执行 `pm2 save`，并记录提交、合并、构建、部署和验收结果。

## Provider 与 API Key

- Provider 配置目前保存在浏览器持久化存储中，API Key 属于敏感信息。
- 不要把 API Key 放到 URL、commit、截图、README、服务端日志或错误信息中。
- 真实 `.env` 不得被 Git 跟踪；`.env.example` 只放无害示例。取消跟踪不会清除历史，已出现过的凭据必须另行轮换。
- 直连 Provider 仍优先由浏览器发出；若发生 CORS/网络失败，才使用 JWT 保护的同源 relay。relay 不落库、不记录 API Key，并且只允许 HTTPS 公网目标。
- relay 的原始请求必须通过 JWT；只允许 Servlet `ASYNC` 内部二次分发跳过重复授权，否则 `StreamingResponseBody` 可能在正文已发送后触发 `AuthorizationDeniedException`。
- 用户修改或删除 Provider 后，历史对话仍可能保留旧 Provider ID 和消息，这是本地历史数据；发送新消息前必须重新选择一个当前激活的 Provider。
- 未配置 Provider 时，模型选择器必须不可用，不能让用户误以为内置模型可以直接发送。
- Provider 测试必须验证实际使用的 `/chat/completions`；`/models` 只能用于可选的模型发现，不能单独作为连接可用性的结论。
- `https://lzhiyu.ccwu.cc` 的 API 根路径是 `/v1`；推荐在配置中填写 `https://lzhiyu.ccwu.cc/v1`，模型填写 `gpt-oss-20b`。
- 测试没有模型可用时不得猜测模型名称；应提示用户填写 Provider 支持的模型。

## 对话历史

- 当前右侧 AI 面板的历史是浏览器本地历史，与后台 `/api/ai-chats` 不是同一数据源。
- 清空当前对话只清空当前 UI 会话状态，不代表删除所有本地历史。
- 目前未提供历史删除按钮；后续增加删除前要设计确认、存储清理和失败反馈。
- 浏览器本地存储不适合保存高敏感或无限增长的消息；增加同步前必须定义加密、容量、跨设备和退出登录清理策略。

## 部署与缓存

- `paper.pilo.eu.cc` 通过 Cloudflare -> Apache -> PM2 Next.js，不是 Cloudflare Pages。
- 修改源码后只 push 不会生效；必须执行 `pnpm run build`、PM2 重启并验证公网。
- 后端版本化 JAR 需要重建 PM2 项；新项不会继承被删除进程的应用环境变量，必须在同一个 shell 加载 `backend/.env` 后启动，并在健康检查通过后再 `pm2 save`。
- favicon 使用版本 query string 防止浏览器/边缘缓存旧图标；更新版本时同步修改 metadata 和主题同步组件。
- 本次 v0.1.12 只调整浏览器标签页 favicon；不要将 favicon 的尺寸调整误应用到首页左上角品牌 Logo。
- 历史 v0.1.12-fix 修复了侧栏折叠按钮的点击层级；v0.1.20 增加论文删除确认与原文件选项；v0.1.21 清理已知标题声明并优化选中卡片样式。
- 不要用宽泛的 `rm -rf`、`killall` 或批量 kill 处理部署问题。
- 当前生产 `next start --hostname localhost` 实际监听 `::1:3001`；`127.0.0.1:3001` 失败不能单独作为服务离线结论。
- 当前生产 PostgreSQL、Redis 和 GROBID 是既有容器且无 Compose labels；先只读确认归属，不能直接用仓库 Compose 重建。

## UI 回归

- 右侧面板在 Reader 主页面中嵌套，AI Tab 必须使用 `min-h-0` 和正确的 overflow，否则 composer 会被内容挤出底部。
- 新增入口要同时检查明亮/暗色主题、窄宽度、键盘操作和 hover/focus 状态。
- “新对话”按钮只使用图标，但必须提供 `title` 和 `aria-label`。
- Provider 警告不能只依赖颜色，应同时有感叹号图标和文本。
- 带圆角的弹出面板（语言下拉、偏好设置的语言网格等）不要露出原生滚动条：`globals.css` 里有一条全局 `::-webkit-scrollbar`（6px、`--text-tertiary`），面板 `overflow-y-auto` 一旦真的溢出，滚动条就会贴着右边缘切进圆角里。这类面板统一挂 `.scrollbar-hidden`（`scrollbar-width` + `-ms-overflow-style` + `::-webkit-scrollbar` 三条声明，覆盖 Firefox / 旧 Edge / Chromium+Safari，少一条就有浏览器露出来），**滚动能力保留**；给滚动条让位的 `pe-1` 之类留白要一并去掉。`frontend/src/test/language-panel-scrollbar.test.tsx` 锁住这条不变量。

## v0.1.31 PaperHelper 菜单文案调整（已部署）

- 本轮需求编号为 `REQ-202608-0012`，使用普通迭代分支 `feature/v0.1.31`，不是 Bug 修复分支。
- 仅将侧栏 `nav.created` 的中文展示文案改为“我的论文”，英文改为 “My Papers”；内部路由键、书架 Tab 和业务逻辑不变。
- 前后端版本及 favicon 缓存参数升级到 `0.1.31`；不涉及数据库迁移、接口、用户数据或共享基础设施。
- 前端测试、类型检查、Lint、生产构建和后端测试/bootJar 均已通过；合并 `main` 后已完成生产部署与本机、公网验收。

## v0.1.30 PaperHelper 品牌与书架升级（已部署）

- 本轮是新功能迭代，使用 `feature/v0.1.30`，不使用 `-fix` 分支。
- 通知行和“查看版本功能”共用同一处理逻辑：标记已读、关闭下拉，并仅对 `actionKey === "version"` 打开版本介绍弹窗。
- 弹窗主体使用 `--surface-0` 和 `--text-primary`，不能恢复 `glass` 变体。
- 已完成生产部署与本机、公网验收；本轮不涉及后端接口、数据库迁移、用户数据或共享基础设施。
