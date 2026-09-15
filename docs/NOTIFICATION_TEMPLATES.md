# PaperHelper 邮件模板需求（提交给通知中心）

> 需求编号：`REQ-202609-0107`　提出方：PaperHelper（笨迪论文助手，`/root/paper-reader`）
> 承接方：通知中心（`bendywork-notify-center`）
> 状态：PaperHelper 侧已完成对接开发；本文是给通知中心的模板实现依据。

## 1. 背景

PaperHelper 是论文阅读工作台，**没有自建邮箱，也没有注册流程**：用户唯一入口是登录，登录方式之一是邮箱验证码。在此之前验证码只写进后端日志，用户根本收不到，登录链路是断的。

本机已有通知中心（`bendywork-notify-center`），提供统一的「通知记录 + WS / Webhook / 邮件 / 飞书」投递能力，并有系统级 AgentMail 邮件提供商池。PaperHelper 改为**把邮件投递整件事交给通知中心**：自己不再直连任何 SMTP / 邮件 API，只负责调用通知中心并把模板变量传过去。

因此本文有两部分内容：

1. PaperHelper 与通知中心的对接方式（已经实现，通知中心无需改动，仅作背景）；
2. **请通知中心实现的三个邮件模板**及其字段、配色、验收标准。

## 2. 对接方式（PaperHelper 已实现）

```text
PaperHelper 后端 (Kotlin/Spring Boot)
  │  1. POST /api/auth/token        { access_key, access_secret }   -> { token }
  │  2. POST /api/notify            Authorization: Bearer <token>
  ▼
通知中心 Worker ──► 通知记录 ──► 邮件渠道（AgentMail 提供商池）──► 用户邮箱
```

请求体（已上线字段，本轮新增 `template` / `template_data`）：

| 字段 | 说明 |
| --- | --- |
| `target_package_name` / `target_app_id` | 固定为自己：`com.bendywork.paperhelper` / `paperhelper` |
| `target_user_ids` | 站内推送目标；已知用户传真实 userId，未注册的新邮箱传 `guest`（不匹配任何在线连接，避免验证码被广播） |
| `type` | 事件类型，见下表 |
| `title` | 通知标题（同时是邮件的兜底主题） |
| `body` | 通知正文（同时是邮件的纯文本兜底内容） |
| `data` | 业务附加数据 |
| `email_to` | **收件人，始终显式传**（验证码收件人 + 消息接收人） |
| `template` | **本轮新增**：模板名；不传或未知模板时按现有纯文本逻辑发送 |
| `template_data` | **本轮新增**：模板变量（见各模板字段表） |

PaperHelper 侧对通知中心的调用**失败不影响主流程**：验证码仍然写 Redis、私信仍然入库，只记一条 WARN 日志并降级（邮件发不出去时用户可重试）。所以模板没上线之前，PaperHelper 可以先行部署，邮件退化成纯文本，不会报错。

## 3. 模板总体要求

- **配色：黑白灰，只用灰阶**，不要紫/蓝/绿等彩色主题。建议色板：
  背景 `#f4f4f5`、卡片 `#ffffff`、主文字 `#18181b`、次文字 `#52525b`、弱化文字 `#a1a1aa`、描边 `#e4e4e7`、码底 `#fafafa`。
- **观感要「洋气」**：大留白、细描边、克制的字重层级、字距略放开的标题、无圆角滥用（卡片 12–16px），不要用大色块、渐变、阴影堆叠。
- **HTML 邮件**，HTML 与纯文本**同时提供**（`multipart/alternative`）；HTML 发不出去时纯文本必须仍然可读。
- **兼容**：表格布局 + 内联样式，不依赖外部 CSS/图片/字体；Web font 一律不用，字体栈用
  `-apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", Helvetica, Arial, sans-serif`。
  正文宽度 600px 以内，窄屏可读。
- **文案**：中文为主，产品名统一「笨迪论文助手 PaperHelper」；不要在邮件里出现密钥、内部 IP、堆栈等技术信息。
- **变量必须转义**：用户名、消息内容为用户输入，插入 HTML 前必须做 HTML 转义。

## 4. 需要的模板

事件类型与模板一一对应：

| `type` | `template` | 场景 |
| --- | --- | --- |
| `auth.email_code` | `paperhelper-login-code` | 邮箱验证码登录 |
| `message.private` | `paperhelper-message` | 收到他人私信 |
| `message.group` | `paperhelper-message` | 收到群消息 |
| `forum.comment` | `paperhelper-circle` | 科研圈子里自己的帖子被评论/回复 |

### 4.1 `paperhelper-login-code` — 登录验证码

最关键的一封：收不到就等于登不进。

- **主题**：`你的登录验证码 {{code}}`
- **结构**：顶部细黑条（3px `#18181b`）→ 产品名 → 一句说明「你正在登录笨迪论文助手，请使用下面的验证码完成登录」→ **验证码大字块**（6 位数字，字号 32–36px、`letter-spacing` 0.32em、等宽字体、`#fafafa` 底 + 1px 虚线 `#d4d4d8` 描边、内边距 20px 左右）→ 「验证码 {{expires_minutes}} 分钟内有效」→ 灰色小字「如果不是你本人操作，忽略这封邮件即可，你的账号不会有任何变化」→ 页脚。
- **不要**放按钮（6 位码没有可点的链接），不要放「点击登录」。

| `template_data` 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | string | 6 位数字验证码，**必填** |
| `expires_minutes` | number | 有效期分钟数，当前为 `5` |
| `email` | string | 请求登录的邮箱（展示用） |

### 4.2 `paperhelper-message` — 消息通知（私信 / 群消息）

- **主题**：`{{sender_name}} 给你发了私信` / `{{sender_name}} 在「{{group_name}}」发了消息`
  （用 `template_data.kind` 区分：`private` / `group`）
- **结构**：产品名 → 「{{sender_name}} 给你发了消息」（群里则带群名）→ **消息摘要块**（原文最多 200 字，超出截断加省略号；左对齐、`#fafafa` 底、左侧 3px `#18181b` 竖线、圆角 8px）→ 灰色小字「你收到这封邮件是因为对方在笨迪论文助手里给你发了消息」→ 页脚。
- 摘要里的换行保留为 `<br>`，HTML 转义后再处理。
- **不要**把完整会话、历史消息或发送者邮箱放进邮件。

| `template_data` 字段 | 类型 | 说明 |
| --- | --- | --- |
| `kind` | string | `private` \| `group` |
| `sender_name` | string | 发送者昵称（必填） |
| `group_name` | string | 群名，`kind=group` 时必填 |
| `preview` | string | 消息摘要（必填，后端已截断到 200 字） |
| `sent_at` | string | 发送时间，形如 `2026-09-15 10:24`（已按 `Asia/Shanghai` 格式化） |

### 4.3 `paperhelper-circle` — 科研圈子通知

- **主题**：`{{actor_name}} 评论了你的帖子`
- **结构**：产品名 → 「{{actor_name}} 在科研圈子里评论了你的帖子」→ **帖子标题**（`#18181b`、字重 600）→ **评论摘要块**（同 4.2 的摘要样式）→ 灰色小字说明 → 页脚。
- 自评自帖、评论别人的帖子都不发（PaperHelper 侧已过滤）。

| `template_data` 字段 | 类型 | 说明 |
| --- | --- | --- |
| `actor_name` | string | 评论者昵称（必填） |
| `post_title` | string | 被评论的帖子标题（必填） |
| `preview` | string | 评论摘要（必填，后端已截断到 200 字） |
| `sent_at` | string | 时间，同上 |

## 5. 验收标准

1. `POST /api/notify` 带 `template` + `template_data` 时，收到的邮件是上述 HTML 版式，且纯文本部分同样完整可读；不带 `template` 或 `template` 未注册时，行为与现在完全一致（纯文本），不得报错、不得拒发。
2. 三个模板在 Gmail、Apple Mail、Outlook 网页版下版式一致：无横向滚动、无彩色元素、无外部资源依赖。
3. `code`、`sender_name`、`preview` 等用户输入经过 HTML 转义（用 `<script>` 当昵称不会破坏版式）。
4. 模板渲染失败时降级为纯文本发送，邮件仍然投递成功。
5. 通知中心侧有模板渲染的单元测试，覆盖：正常渲染、未知模板返回 null、变量缺失、HTML 转义。

## 6. PaperHelper 侧已同步做的事

- 后端新增通知中心客户端（AKSK 换 token、带超时、token 缓存），接入三处调用：邮箱验证码登录、私信、群消息、科研圈子评论。
- 失败降级：通知中心不可用时不影响登录、发消息、评论主流程，只记 WARN。
- 配置项：`NOTIFY_CENTER_BASE_URL`、`NOTIFY_CENTER_ACCESS_KEY`、`NOTIFY_CENTER_ACCESS_SECRET`、`NOTIFY_CENTER_TARGET_PACKAGE`、`NOTIFY_CENTER_TARGET_APP_ID`、`NOTIFY_CENTER_ENABLED`。
- 群消息按「同一个人同一个群 10 分钟内最多一封」做节流，避免刷屏和邮件额度被一条消息吃光。

## 7. 不在本次范围内

- PaperHelper 站内通知中心（前端 `notification-store` 那套，只存在浏览器本地），本轮不接通知中心 WS。
- 注册欢迎邮件、论文解析完成通知、周报等其它邮件场景。
- 通知中心后台的模板可视化编辑器。

## 8. 实现状态（2026-09-15 UTC 已闭环）

通知中心侧（仓库 `yokeay/bendywork-notify-center`）已按本文档实现并发布：

- `v0.1.13`（提交 `c14cc23`）：新增 `src/templates.ts` 模板注册表与 `src/email_body.ts`，三个模板名与本文件第 4 节完全一致，`template` / `template_data` 作为可选字段加在 `POST /api/notify` 上，不落库、不加 D1 schema。
- `v0.1.14`（提交 `6337e7b`）：修字体栈问题 —— 常量插进 `style="..."` 时用双引号包字体名会提前闭合属性，AgentMail 重新序列化 HTML 时丢掉后半截，等宽字体在真实邮件里消失。改用单引号并补回归测试。
- 验证：对生产 `POST https://paper.pilo.eu.cc/api/auth/send-code`，1 秒后信箱收到 `multipart/alternative` 邮件，主题「笨迪论文助手登录验证码」，HTML 两条 `font-family` 完整、无游离双引号、配色全在灰阶色板内。

后续改模板变量或版式，两侧要同步改：本文档是需求侧契约，`bendywork-notify-center` 的 `maintain.md` 是实现侧记录。
