## v0.1.50 侧栏菜单计数徽标改为标题角标

- 本轮需求编号 `REQ-202609-0126`，分支 `feature/v0.1.50`，从 `b0409ef` 展开。根因不是计数来源，是布局：`TabBar` 每个页签 `flex-1` 在 `w-72`（288px，内容 287px）的左栏里均分到 ≈72px，扣掉 `px-3` 后只剩 ≈48px 给「标题 + 徽标」，中文于是按字断行，变成逐字竖排。
- **徽标必须是脱离文档流的绝对定位角标：`absolute -top-2 -end-2`。不要再改回 `inline-flex` 行内并排 + `gap-*`**，那正是本轮要修的 bug —— 行内徽标会抢标题宽度，`frontend/src/test/tabbar-badge.test.tsx` 已用 `badge.classList.contains("absolute")` 上锁（实测把 `absolute` 去掉，该用例在 `tabbar-badge.test.tsx:44` 以 `expected false to be true` 失败）。
- **标题外面的 `relative inline-flex min-w-0 max-w-full` 包装层和标题上的 `truncate` 都不要删**：包装层是角标的定位容器（删了角标会飘到页签左上角而不是标题右上角），`truncate` 负责极端窄容器下兜底，删了会退回逐字换行。
- **方向与偏移一律用逻辑类（`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`text-start`），不得用 `ml-`/`mr-`/`left-`/`right-`/`text-left`。** 本轮 `Sidebar.tsx` 里原有的 `ml-auto` + `text-left` 已换成 `-end-2` + `text-start`，回退会让 `ar`/`fa`/`ug` 三种 RTL 语言下角标钉死在右边、标题左对齐失效。
- `TabBar` 是共用组件，「我的书架」左栏（`components/papers/PaperList.tsx`）与阅读器右栏（`components/layout/RightPanel.tsx:170`）同时受益；右栏目前 tabs 无 `count`，改 `TabBar` 会一起影响，改之前先确认右栏窄容器下的表现。
- `data-tab-key` 属性和下划线指示器的 `ResizeObserver` 逻辑本轮未动，**不要为了改角标顺手重排**：指示器靠 `querySelectorAll("[data-tab-key]")` 定位。
- 本轮**无接口改动、无数据库迁移、无新依赖**，后端 Kotlin 零改动。按全局「代码完成 = 合入生产分支并部署」的口径本轮只重建并重启了前端 PM2 进程（`paper-reader-frontend`），**后端 `paper-reader-backend` 刻意未重启**（必须带 `backend/.env` 启动，无关重启只会制造事故），因此线上 `/api/health` 仍返回 `0.1.49`，这是有意为之的版本漂移，不是部署漏做。
- 本轮 `feature/v0.1.50` 先合入 `main`，随后把 `dev` 快进到同一提交（`dev` 当时停在 `b0409ef`，是本轮的祖先，快进不产生合并提交）。后续分支仍按 `feature → dev → main` 走，开分支前先确认 `dev` 不落后于 `main`。

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
