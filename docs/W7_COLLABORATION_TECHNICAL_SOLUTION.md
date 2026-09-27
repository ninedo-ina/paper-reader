# W7 协作与分享 · 技术方案

- 需求：`REQ-202609-0263`（写作路线图 **W7**，`REQ-202609-0255` 的子项）
- 版本：`0.1.63`，分支 `feature/v0.1.63`
- 交付内容：正文的实时协同编辑、编辑器正文批注、只读分享链接，以及把「导师 / 合作者」概念落成真实的读写授权。

W7 是写作路线图最后一个未发布的主题。本文记录它的架构决策、数据流、访问控制、持久化，以及与并行迭代（W6/W8/W9）产生的版本号 / 迁移号顺延。

---

## 1. 前置安全修复（先落地，阻塞项）

W7 之前，`/ws` 端点对所有人开放（`permitAll`），STOMP 消息里的 `senderId` 由客户端自带、未与服务端已验证的身份绑定——这等于一条**可伪造、且直连文档写入**的实时通道。在把协同挂上去之前，必须先堵死。

`StompAuthChannelInterceptor`（注册在 `configureClientInboundChannel`）在 STOMP 入站通道上强制身份：

- **CONNECT**：校验 `Authorization: Bearer <jwt>`，逻辑与 `JwtAuthFilter` 对齐——令牌有效（`isTokenValid`）、不是 2FA 挑战态的令牌、设备未被吊销（`deviceService.isDeviceActive`）。通过后把服务端核验出的 `UsernamePasswordAuthenticationToken(UserPrincipal(userId, email))` 绑到 `accessor.user`，成为这条 STOMP 会话此后**唯一**的身份来源。
- **SUBSCRIBE**：`/topic/collab/{id}` 需要对该论文可读（`requireReadable`）；`/topic/chat.{id}` 只允许订阅自己的 id。
- **SEND**：`/app/collab/{id}/update` 需要可写（`requireWritable`，即 `EDITOR`）；其余 collab 目的地（awareness）只要求可读。

`/ws` 在 `SecurityConfig` 里仍是 `permitAll`——那只是放过 WebSocket 握手；真正的身份与授权发生在入站通道拦截器上，而不是 HTTP 过滤器链上。相关常量：`COLLAB_TOPIC_PREFIX="/topic/collab/"`、`COLLAB_APP_PREFIX="/app/collab/"`、`CHAT_TOPIC_PREFIX="/topic/chat."`。

> 遗留项：`/topic/group.*`（论坛群聊）本轮**未**收紧，仍沿用旧的订阅逻辑；见第 12 节「已知限制」。

---

## 2. 架构决策：为什么不用 Hocuspocus

需求允许引入 Hocuspocus，但那会多出一个**独立的 Node 协同进程 / 新基础设施**，与本项目「一个后端、PM2 托管、Apache 反代」的部署拓扑不符。方案改为：**Yjs 直接骑在既有的 Spring STOMP `/ws` 上**。

- 客户端 `StompYjsProvider`（`frontend/src/lib/collab/`）把 Yjs 的 CRDT 增量与 awareness 编码成**不透明 base64** 发到 `/app/collab/{id}/update` 与 `/app/collab/{id}/awareness`。
- 服务端 `CollabController` 把它们**原样转发**到 `/topic/collab/{id}`，**从不解析 CRDT**。冲突消解 100% 在客户端 Yjs 完成。

这条边界是整个方案的关键：服务端不理解文档内容，只做「带鉴权的中继 + 全量快照持久化」，因此不需要在服务端引入 Yjs 依赖，也不存在服务端与客户端 CRDT 版本不一致的风险。

---

## 3. 实时协作数据流

客户端 `StompYjsProvider`：

- `originId = String(doc.clientID)`——刻意转成字符串，好在 Jackson JSON 往返后仍能做自回显过滤（数字在 JSON 里会丢类型）。
- `connectHeaders: { Authorization: Bearer <getAccessToken()> }`，`beforeConnect` 每次连接前刷新令牌，`reconnectDelay: 5000`。
- `onConnect`：清空 `synced` 集合 → 订阅 `update` 与 `awareness` 两个 topic → **发布一次完整状态** `Y.encodeStateAsUpdate(doc)`（这一步正是「断线重连后本地离线改动不丢」的实现，见验收②）→ 发布 awareness。
- `handleDocUpdate`：若 `origin === this`（是 `applyUpdate` 触发的回声）则跳过，否则发布增量。
- `handleAwarenessUpdate`：当感知到「远端新增」的对等端时，对每个新对等端**重发一次完整状态**（用 `synced` 集合保证每个对等端只重发一次），让后加入者能对齐到当前文档。
- `onUpdateMessage`：若 `payload.origin === originId`（自己发的）则跳过，否则 `Y.applyUpdate(doc, bytes, this)`——第三个参数 `this` 就是上面 `handleDocUpdate` 用来识别回声的 origin。
- `destroy` / `handleUnload`：`removeAwarenessStates`，让其它人及时看到本端离开。

编码在 `frontend/src/lib/collab/encoding.ts`：`bytesToBase64` 按 `0x8000` 分块拼接（避免 `String.fromCharCode(...bigArray)` 爆栈），`base64ToBytes` 反向解码。

服务端 `CollabController`：`@MessageMapping("/collab/{paperId}/update")` → 广播 `/topic/collab/{paperId}`；`/collab/{paperId}/awareness` → `/topic/collab/{paperId}/awareness`。中继载荷 `data class CollabRelayPayload(val update: String, val origin: String? = null)`——`update` 是 base64，`origin` 用于自回显过滤。

编辑器侧：Tiptap 的 `StarterKit` 在协同模式下 `undoRedo: false`（Yjs 的 `UndoManager` 接管撤销/重做，否则两套历史会打架），并挂 `@tiptap/extension-collaboration` + `@tiptap/extension-collaboration-caret`（3.27.3）呈现远端光标。

---

## 4. 文档身份与持久化

`pr_paper_collab_state`：每篇论文一行（`paper_id` 即主键），`state` 是 `base64(Y.encodeStateAsUpdate(doc))` 的全量快照。

- `POST …/collab/state`（**seed-if-absent**）：新客户端进入时若该论文还没有状态行，就用它当前的 doc 播种。主键竞争由数据库兜底——并发播种触发 `DataIntegrityViolationException` 时，落败方**采用胜者已写入的状态**，从而所有客户端收敛到**同一个文档身份**，正文不会被复制成两份。
- `PUT …/collab/state`（**last-writer-wins 全量覆盖**）：客户端防抖后提交整份快照。因为并发对等端在客户端 Yjs 层已经收敛，服务端做 LWW 全量覆盖是安全的；同时把派生出的 `content_json` / `content_html` 通过 `findForUpdateById` 回写进 `pr_papers` 并把 `content_version + 1`——这样非协同路径（列表、导出、AI、只读分享）看到的都是最新正文。
- `GET …/collab/state`：需要可读，返回 `CollabStateDto(state, role, canWrite, isOwner)`，其中作者的角色单独标为 `"OWNER"` 以便前端区分「拥有者 / 编辑者 / 只读者」。

---

## 5. 访问控制内核 `PaperAccessService`

全应用**唯一**的论文 ACL 入口（REST 与 STOMP 都走它）。作者 = 隐式 `EDITOR`；其他人的角色来自 `pr_paper_collaborators`。

- `enum CollabRole { EDITOR, VIEWER }`
- `resolveRole(paperId, userId)`：作者 → `EDITOR`；登记的协作者 → 其登记角色；否则 `null`。
- `requireReadable`：作者或任意协作者放行；否则抛 **404**（而不是 403）——不暴露「这篇论文是否存在」。
- `requireWritable`：作者或 `EDITOR` 放行；`VIEWER` → **403**（`PermissionDeniedException`）。
- `requireOwner`：仅作者；协作者 → **403**，陌生人 → **404**。

**验收③（未授权者拿不到正文）** 就落在这套内核上：REST 读取走 `requireReadable`（陌生人得到 404），实时通道在 `SUBSCRIBE /topic/collab/{id}` 时同样走 `requireReadable`，`SEND` 写入走 `requireWritable`——两条路径同一套判定。

---

## 6. 评论 / 批注 `pr_paper_comments`

编辑器**正文**里的批注，区别于阅读器 PDF 标注下的回复（`pr_annotation_comments`）。

- `anchor`（`VARCHAR(64)`）= Tiptap comment 标记的 id；`quote`（`TEXT`）= 被批注的原文片段，锚点因后续编辑失效时仍可读。
- 接口 `CommentController`：`/api/papers/{id}/comments` 的 `GET / POST / PATCH / DELETE`。
- 权限：任何可读者（含 `VIEWER` / 导师）都能新增评论；`resolved` 的切换限作者或 `EDITOR`；删除限「评论作者或论文作者」。

---

## 7. 结构化协作者 `pr_paper_collaborators`

- 接口 `CollaboratorController`：`GET / POST / DELETE /api/papers/{id}/collaborators`，另有 `GET /api/papers/shared-with-me` 列出「别人分享给我的」论文。
- **路由顺序**：`/api/papers/shared-with-me` 是字面路径，必须声明在 `/{id}` 之前，否则会被当成 `id = "shared-with-me"` 解析。
- 与既有的自由文本 `participants`（署名，仅用于展示）互补——`pr_paper_collaborators` 提供的是**真实的读写授权**。管理协作者（增删）走 `requireOwner`。

---

## 8. 只读分享 `pr_paper_shares`

- 作者签发 / 列出 / 撤销：`/api/papers/{id}/shares`（均 `requireOwner`）。
- 公开读取：`GET /api/share/{token}`（`permitAll`，免登录），返回 `PublicSharePaperDto(contentHtml, contentJson, …)`——读的是回写进 `pr_papers` 的只读正文。
- `token` 由 `SecureRandom` 生成 32 字节、URL-safe、无填充（约 43 字符，落进 `VARCHAR(64)`）。
- `resolvePublic` 对**无效 / 已撤销 / 已过期**统一抛 `ShareLinkInvalidException`（业务码 **1015**，HTTP **404**），**不区分具体原因**——避免泄露某篇论文是否存在、或曾被分享过。
- 审计：签发与撤销都写审计日志。
- `role` 字段预留 `EDITOR` 以便将来做「可编辑邀请链接」，本轮只签发 `VIEWER`。

---

## 9. 数据库迁移 `V20__collaboration.sql`

四张表，`paper_id` 一律 `→ pr_papers(id) ON DELETE CASCADE`，且都被 `PaperDeletionService` 显式清理（`PaperDeletionInvariantTest` 会扫描每个 `V*.sql` 里指向 `pr_papers(id)` 的外键并强制这一点）：

| 表 | 要点 |
| --- | --- |
| `pr_paper_collaborators` | `user_id → pr_users ON DELETE CASCADE`，`role`（EDITOR\|VIEWER）、`created_by`，`UNIQUE(paper_id, user_id)` |
| `pr_paper_collab_state` | `paper_id` 主键，`state TEXT`（base64），`updated_at` |
| `pr_paper_shares` | `token VARCHAR(64) UNIQUE`，`role` 默认 `VIEWER`，`created_by`，`expires_at` 可空（空=永不过期），`revoked` |
| `pr_paper_comments` | `anchor VARCHAR(64)`，`quote TEXT`，`body TEXT`，`resolved` |

迁移是纯新增，无需 backfill。

---

## 10. 业务错误码

- **1015** = `ShareLinkInvalidException`（HTTP 404）——分享链接无效 / 已撤销 / 已过期。
- 本轮的分享失效码原本写作 `1014`，但合入 `main` 时发现 `1014` 已被 W9 的正文体积闸门 `ContentTooLargeException`（HTTP 413）占用，故顺延 `1014 → 1015`。错误码登记表见 `BusinessException.kt`。

---

## 11. 验收标准映射

1. **两人同时编辑同一段落，不出现乱码 / 丢内容** —— 冲突消解由客户端 Yjs（CRDT）完成，服务端只中继不合并，两端各自收敛到一致结果，不存在「后写覆盖」。
2. **断线重连后本地未同步的改动不丢** —— `StompYjsProvider.onConnect` 每次（重）连都重新订阅并**重发一份完整状态** `Y.encodeStateAsUpdate(doc)`，离线期间产生的本地增量随之被对端与服务端吸收。
3. **未授权用户拿不到文档内容** —— `PaperAccessService.requireReadable` 对无关系者返回 404；REST 与 STOMP（`SUBSCRIBE`/`SEND`）两条路径共用同一套 ACL；`/ws` 的握手虽 `permitAll`，但入站通道 `CONNECT` 强制 JWT 校验并绑定服务端身份。

---

## 12. 测试

- 后端 `./gradlew clean test bootJar` → **23 个测试类 / 169 个测试，0 失败**，产物 `paper-reader-backend-0.1.63.jar`。
- 前端 `vitest` → **35 文件 / 273 测试**；`pnpm run build` 通过（含公开路由 `/[locale]/share/[token]`）。
- 14 种语言均补齐 W7 的 38 个新文案键，且与 `zh` 基准保持一致（`locale-coverage.test.ts` 绿）。

---

## 13. 并行迭代：版本号与迁移号顺延

`0.1.60`–`0.1.63` 是从同一基点切出的四个并行 worktree：W6（`0.1.60`）、W8（`0.1.62`）、W9（`0.1.61`）先落地，W7（`0.1.63`）**最后**落地，因此版本号顺序与落地顺序刻意不一致，版本文件为准。

由此产生两处顺延，都记在 `docs/ATTENTION.md`：

- **Flyway 迁移号 `V19 → V20`**：本分支原把协作迁移写作 `V19__collaboration.sql`，但合入的 W6 已经带来 `V19__paper_content_versions.sql`。两个 `V19` 会让 Flyway 在**生产启动时**失败；而测试用的是 Hibernate `ddl-auto` 而非 Flyway，绿色构建**发现不了**这个碰撞。故合并后 `git mv` 顺延为 `V20`，并同步 5 处 `.kt` 文档注释里的「见 V19__collaboration.sql」引用。
- **业务码 `1014 → 1015`**：见第 10 节。

---

## 14. 已知限制 / 后续

- `/topic/group.*`（论坛群聊订阅）本轮**未**随 collab/chat 一起收紧，属遗留项，后续单独处理。
- 多客户端同时在线时，`PUT …/collab/state` 的防抖快照可能由多个对等端**冗余提交**（各自都把已收敛的全量状态写一遍）。功能正确（LWW + 客户端已收敛），但存在写放大，后续可加「仅由一个对等端负责持久化」的选主优化。
- `pr_paper_shares.role` 预留了 `EDITOR`，但本轮只签发 `VIEWER`；「可编辑邀请链接」是后续工作。

