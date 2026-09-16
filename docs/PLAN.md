## 迭代：v0.1.48（已发布）

发布分支：`feature/v0.1.48`；类型：功能迭代（国际化语言切换）；需求编号：`REQ-202609-0111`；状态：2026-09-16 UTC 已合并 `dev` / `main` 并部署验收（发布记录见 `docs/MAINTENANCE.md`）。

需求要两件事：**全站国际化**（简体中文默认，另加繁体中文、藏语、维吾尔语、德语、阿拉伯语、韩语、日语、法语、越南语、西班牙语、意大利语、波斯语，共 13 种，且「所有细节都不能放过」），以及**修好登录页那个点了没反应的语言切换**——点它要弹出下拉列表选语言，选完进系统后界面要跟着走，同时把个人设置「偏好设置 → 语言」更新成所选语言。

先定位「点了没反应」的根因，这决定了整个切换链路怎么写：`app/layout.tsx` 是**根布局**，位置在 `app/[locale]/` **之上**。next-intl 的 `NextIntlClientProvider`、`<html lang>`、`<html dir>` 都挂在根布局上，而客户端软导航（`router.push`）只重渲染 `[locale]` 以下的子树——根布局不在其中。旧的 `LangToggle` 正是直接改状态/软跳转，于是文案、`lang`、`dir` 全部停在旧语言，看起来就是「按钮是死的」。所以本轮的切换一律走整页跳转。

- **语言注册表 `src/i18n/locales.ts` 是唯一事实来源**：`LOCALES` 顺序即切换器展示顺序，`LOCALE_META` 记每种语言的母语名、英文名与书写方向（`ar` / `fa` / `ug` 为 `rtl`），另导出 `LOCALE_COOKIE = NEXT_LOCALE`、`DEFAULT_LOCALE = zh`、`isAppLocale`、`matchLocale`（把 `zh-TW`、`ug-Arab-CN` 这类浏览器标签归一化到站点语言）。加语言只改这一处 + 补一份 `locales/<code>/common.json`。
- **`en` 保留**：需求列出的 13 种里没有英文，但站点原本就有 `en`，线上已有用户把偏好设成 `en`，`/en/*` 老链接也在。直接下掉会让这批用户和老链接一起失效，因此保留在列表末尾，只作兼容项；切换器里照常展示。
- **切换链路 `src/i18n/switch-locale.ts`**：`applyLocale()` 一次做三件事——写 `NEXT_LOCALE` Cookie（`next-intl` 中间件据此记住语言，之后访问 `/` 也会落到这个语言）、在 `localStorage` 打一个「用户亲自选过」的标记、整页 `window.location.assign` 到同一路由的新语言地址。**不能只看 Cookie 判断用户选没选过**：中间件每次请求都会按协商结果把 `NEXT_LOCALE` 写上，Cookie 有值 ≠ 用户选过；`hasExplicitLocaleChoice()` 读的就是那个 localStorage 标记。
- **登录页下拉**：`src/components/ui/LanguageSwitcher.tsx` 是真下拉（点击外部关闭、当前项打勾、`aria-selected`），每项同时给出母语名和英文名（如「العربية / Arabic」）；已登录时选完顺手 `PUT /api/settings` 写回偏好，失败只 `console.warn` 不阻断切换。
- **偏好设置里的语言**：`个人设置 → 偏好设置` 与 `设置页` 都换成共用的 `LanguagePicker`。设置页原来那个语言项只改本地 state、不写后端，现在保存即写 `UserSettings.language`，切换后整页跟随。后端 `UserSettings.language`（默认 `zh`）与 `GET/PUT /api/settings` 早就在，**本轮后端零改动**。
- **换设备登录跟着账号走（`src/i18n/locale-preference.ts`）**：登录成功后 `settleLocaleAfterLogin()` —— 这台设备上用户主动选过语言，就把所选语言写进账号偏好；没选过（新设备，语言是中间件协商出来的默认值），则读取账号偏好并把界面整页切过去。两条路径都不会覆盖用户的显式选择。
- **RTL**：根布局按 `LOCALE_META[locale].dir` 设置 `<html dir>`；布局代码统一改成 Tailwind 逻辑方向工具类（`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`text-start`/`border-e`），否则阿拉伯语、波斯语、维吾尔语下会留下一堆钉死在左边的元素。
- **组件外文案**：API 客户端、AI Provider 与其响应解析、Zustand store、设备工具等不在 React 里，拿不到 `useTranslations`。新增 `src/i18n/runtime.ts` + 根布局里的 `RuntimeLocaleBridge`（渲染期登记，不是 `useEffect`，保证首屏之后立刻发起的请求已经能取到消息表），这些模块在**调用时**取文案而不是模块求值时取，避免语言切换后还留着旧语言的常量。
- **无语言前缀的路径**：`/callback` 被中间件刻意绕开 intl 处理，拿不到 locale 头。`src/i18n/request.ts` 补了一次 Cookie 兜底（`next-intl` 自身没有 Cookie 回退），否则 GitHub 回调页的 `<html lang/dir>` 和文案会永远停在简体中文；另外用 `zh` 做消息兜底合并，任何一种语言缺键时都还能显示。

验收标准：新增 `locale-switch.test.ts`（前缀替换、Cookie/标记写入、`matchLocale` 归一化、RTL 列表）与 `language-switcher.test.tsx`（下拉列全 14 种语言、当前项选中态、选阿拉伯语触发 `applyLocale`、未登录不写偏好、已登录写偏好、重选当前语言不跳转），全部通过；`tsc --noEmit`、`vitest run`、`npm run lint`、`next build` 与后端 `./gradlew clean test bootJar` 全绿；按 `feature/v0.1.48 -> dev -> main` 发布，线上核对各语言页面（含 `/ar/login` 的 `dir="rtl"`、繁体/藏文/维吾尔文文案）与 `/api/health` 版本号。

本轮**无数据库迁移、无接口改动、无新依赖**（v0.1.47 的 `V15` 随基线一并带入）：12 种新增语言的文案来自批量翻译（人工抽查），版本号（前后端 `VERSION`、`package.json`、`build.gradle.kts`、favicon `?v=`）统一升到 `0.1.48`。

发布时线上验收又抓到「登录页语言切换」的**第二个根因**，一并修掉后发布：软导航那条修好之后，下拉能弹出来，但菜单挂在顶栏里、顶栏与登录内容行是同为 `z-10` 的兄弟，内容行在 DOM 里更靠后，同 `z-index` 时后者赢——菜单被登录卡片压住，落在卡片范围内的选项既看不见也点不着（线上 `elementFromPoint` 命中登录卡片）。顶栏改为 `relative z-30`，并加了 `auth-layout.test.tsx` 的层叠用例锁住「顶栏严格高于内容行」。最终测试数为前端 20 个文件 121 项。

## 上一迭代：v0.1.47（已发布）

发布分支：`feature/v0.1.47`；类型：缺陷修复 + UI（登录后的默认身份）；需求编号：`REQ-202609-0110`。

用户反馈：登录进去个人中心里用户名是空的、邮箱是空的、头像是「?」。这不是个人中心渲染错了，是**登录后根本没拉资料**：根布局的 `SessionLoader` 只在整页加载时跑一次，而登录成功走的是客户端路由跳转，根布局不会重挂载，`useUserStore.profile` 一直停在 `null`。登录接口本身只返回 token，不含用户信息，所以顶栏和个人中心一起空着。

- `stores/auth-store.ts` 的 `applyTokens` 在写入 token 后立刻 `loadProfile()`；`stores/user-store.ts` 用 `inflight` 对并发调用去重，避免和 `SessionLoader` 重复请求 `/auth/me`。三条登录路径（邮箱验证码、密码、GitHub）都汇合在 `applyTokens`，一处改动全部覆盖。
- 新增 `frontend/src/lib/user-display.ts` 统一身份展示：`defaultAvatar` 取邮箱首字母（英文大写 / 数字原样 / 中文原样），底色按邮箱哈希取自固定调色板，前景色按 WCAG 相对亮度在白色与 `#1f2933` 之间择优，保证对比度 ≥ 4.5；`defaultDisplayName` 依次取用户昵称 → `用户{id}` → 邮箱前缀 → `用户`。个人中心、顶栏、聊天气泡共用。
- 头像设置菜单（上传图片 / 网络图片）改为监听 `document` 的 `mousedown` 与 `Escape` 关闭，菜单与触发按钮豁免。
- GitHub 登录此前申请了 `scope=user:email` 却从不读 `/user/emails`，邮箱私密时只能落 `{login}@github.user` 占位。现在兜底取主邮箱，并在下次登录时回填历史占位账号（真实邮箱已属于他人则保留占位 + WARN）。
- 迁移 `V15__widen_user_avatar.sql` 把 `pr_users.avatar_url` 从 `VARCHAR(500)` 放宽到 `VARCHAR(1000000)`：「从本地上传」存的是 base64 data URL，`VARCHAR(500)` 存不下，该功能此前必然报错。前端同步加 900000 字符上限。

验收标准：`user-display.test.ts`（首字母 / 对比度 ≥ 4.5 / 前景≠底色 / 默认用户名链路）、`profile-dialog.test.tsx`（个人中心显示邮箱与 `用户{id}`、点空白关闭菜单、Escape 关闭、点菜单内不关闭）全绿；后端 `AuthServiceTest` 新增 4 条 GitHub 邮箱用例；`tsc --noEmit`、`vitest run`、`next build`、`./gradlew clean test bootJar` 通过；按 `feature/v0.1.47 -> dev -> main` 发布并线上核对 `/api/health` 与个人中心。

## 上一迭代：v0.1.45（已发布）

发布分支：`feature/v0.1.45`；类型：UI 打磨迭代（登录页垂直居中）；需求编号：`REQ-202609-0106`。

登录页的骨架是 `main.flex.min-h-screen.flex-col` 三段：顶栏、中间内容区（左轮播 + 右登录表单的栅格）、页脚。中间那行原来是按内容高排的（`mx-auto grid ... py-6`），页脚带 `mt-auto` 把**所有**富余空间吸走。结果就是：`min-h-screen` 保证了整页铺满，但富余的空间全落在页脚上边，内容块紧贴顶栏——笔记本那种矮屏幕看不出来，换到大显示器上，视口越高内容越往顶部挤，用户反馈「有点太靠顶部了、看着别扭」。

- 中间那行加 `flex-1 items-center`，变成一个吃掉剩余高度的 flex 行，栅格在里面垂直居中：顶栏和页脚各自占自己的高度，中间块拿到的是「视口高 − 顶栏 − 页脚」，无论窗口多高都停在正中间。
- **不动栅格自己的 `items-stretch`**：左栏 `LoginExperience` 内部有一条 `mt-auto` 的说明文案，靠拉伸才能和右侧更高的登录卡片底部对齐；把栅格改成 `items-center` 会缩掉左栏高度、把那条文案拽上来。这次只挪整块的垂直位置，内部构图保持不变。
- 水平方向本来就对：栅格 `mx-auto max-w-7xl`。保留 `py-6`，保证矮窗口下内容贴到顶栏/页脚时仍有最小间距；flex 项默认 `min-height: auto`，内容超出视口时页面照常滚动，不会裁切。

验收标准：`auth-layout.test.tsx` 锁住结构（内容行 `flex-1` + `items-center`、栅格 `mx-auto max-w-7xl` + 原有 `lg:grid-cols-[...]`、页脚 `mt-auto` 且不带 `flex-1`），把 `flex-1 items-center` 去掉该用例必须失败；`tsc --noEmit`、`vitest run`、`npm run lint`、`next build` 与后端 `./gradlew clean test bootJar` 全绿；按 `feature/v0.1.45 -> dev -> main` 发布并在线上核对登录页。

本轮无数据库迁移、无接口改动、无新依赖：只改一个布局文件与一条测试，版本号（前后端 VERSION、`package.json`、`build.gradle.kts`、favicon `?v=`）统一升到 `0.1.45`，后端仅随版本号重新构建与重启，Kotlin 代码未改。

## 迭代：v0.1.44（已发布）

发布分支：`feature/v0.1.44`；类型：功能迭代（接入通知中心）；需求编号：`REQ-202609-0107`。

PaperHelper 是「无注册、只有登录」的产品，登录靠邮箱验证码。但本项目本地并没有真实发信能力（`spring.mail.*` 在生产是空配置），验证码实际上只落在后端日志里，用户根本收不到。本机已经有一套通知中心（`bendywork-notify-center`），本次把 PaperHelper 接进去，由它来发登录验证码和消息通知邮件。

- 新增 `service/NotifyCenterClient.kt`：AKSK 换 Bearer token（`POST /api/auth/token`，缓存到 `expires_in - 60`）后调 `POST /api/notify`。四个业务方法——登录验证码、私信、群组消息、圈子评论——都是 `@Async("notifyExecutor")`，通知中心挂了也只记 WARN 日志，绝不影响登录与发消息主流程。
- 新增专用 `notifyRestTemplate`（连接/读取各 5 秒）与 `notifyExecutor`（1~2 线程、队列 200）；原有 GROBID 用的 `restTemplate` 标 `@Primary`，避免 Bean 歧义。
- 邮件模板不在本轮定义 HTML，只按约定传 `template` / `template_data` 两个新字段（`paperhelper-login-code` / `paperhelper-message` / `paperhelper-circle`），模板样式由通知中心侧实现。字段与验收标准写在 `docs/NOTIFICATION_TEMPLATES.md`，交通知中心团队对照实现。
- **登录验证码的 `body` 里带码**：通知中心的模板渲染对未知模板会回退成纯文本，把码放进 `body` 能保证「模板还没上线」时用户照样登得进去；`title` 是固定文案、不含验证码（标题会进通知记录被持久化）。`target_user_ids` 用真实用户 id，未注册邮箱用字面量 `guest`——**绝不能用 `0` / `-1`**，通知中心把它们当作「推给所有在线连接」。
- 防刷：`sendEmailCode` 加 60 秒/邮箱的 Redis 冷却（与前端倒计时一致）；群消息按「群 × 成员」10 分钟节流，保护通知中心每月 3000 封的额度。
- 配置走 `app.notify.*`（`NOTIFY_CENTER_BASE_URL` / `_ACCESS_KEY` / `_ACCESS_SECRET` 等），生产值写在 gitignore 的 `backend/.env`，不进仓库。

验收标准：后端单测覆盖「登录码写入 Redis 并交给通知中心」「冷却期内不再发信」「四类通知的请求体字段」「超长内容截断不切坏 emoji」「token 只取一次并复用」「通知中心 5xx/取 token 失败都只记日志不影响主流程」；`./gradlew clean test bootJar` 与前端 `tsc --noEmit`、`vitest run`、`next build` 全绿；按 `feature/v0.1.44 -> dev -> main` 发布，通知中心侧模板上线后在线上实测收到验证码邮件。

本轮**无数据库迁移**（只加配置项）、**无前端业务改动**（仅版本号与 favicon 缓存参数）；对通知中心**不动 D1 schema**，`template` / `template_data` 只在内存里透传，避免触发账号级 D1 行读配额问题。

发布结果（2026-09-15 UTC）：`feature/v0.1.44` 提交 `6327bfe` 已合入 `dev` / `main` 并完成生产部署，`/api/health` 返回 `0.1.44`；对生产 `POST /api/auth/send-code` 实测，1 秒后信箱收到带验证码的 HTML 邮件，验收通过。通知中心侧模板随后上线（`v0.1.13`，字体栈修复 `v0.1.14`），细节见 `docs/MAINTENANCE.md`。

## 迭代：v0.1.43（已发布）

发布分支：`feature/v0.1.43`；类型：UI 打磨迭代（扫码绑定二维码）；需求编号：`REQ-202609-0104`。

v0.1.40 做扫码绑定向导时，二维码为了「两种主题都够对比度」做了主题反相：深色主题下码点变浅、底色变 `#101823` 深底。实际用下来用户反馈这块深底「很别扭、很严肃、很突兀」，要求去掉强制深底、改成圆角方形、看着有亲和力。

- 配色固定为深色码点 `#1f2933` + 白底 `#ffffff`，不再读 `useTheme`：验证器 App 的识别依赖浅色静默区，深底浅点本来就有扫不出来的风险，浅底也更稳妥。`ThemeAwareQrCode.tsx` 因此改名为 `QrCodeCard.tsx`（名字不再撒谎），旧的 `PALETTE.dark` 删除。
- 柔和的观感交给外层卡片：`rounded-2xl` + `border-[var(--border-subtle)]` + `bg-white` + `shadow-sm` + `p-3`，内边距顺带提供白色的静默区；`margin` 由 2 降到 1，避免码点周围多出一圈无谓的留白。
- 内层浅色方块**不加圆角、不加 `overflow-hidden`**：圆角会把码点四周的静默区切掉，影响部分机型识别。圆角只加在外层卡片上。

验收标准：开启两步验证时二维码始终是深色码点 + 白底（深浅主题一致），外面是圆角白卡片而不是一块裸的深色方块；生成失败仍回退到「请使用下方密钥手动添加」；`qr-code-card.test.tsx` 锁住配色与卡片样式；`tsc --noEmit`、`vitest run`、`next lint`、`next build` 与后端测试/`bootJar` 通过；按 `feature/v0.1.43 -> dev -> main` 发布并完成生产验收。

本轮无数据库迁移、无接口改动、无新依赖：请求体与字段完全不变，版本号（前后端 VERSION、`package.json`、`build.gradle.kts`、favicon `?v=`）统一升到 `0.1.43`，后端仅随版本号重新构建与重启，Kotlin 代码未改。

## 当前迭代：v0.1.42（已发布）

发布分支：`feature/v0.1.42`；类型：UI 打磨迭代（两步验证表单）；需求编号：`REQ-202609-0104`。

v0.1.40 把两步验证补成闭环时，表单沿用了最朴素的排法：标签压在输入框正上方、两项之间只有 `space-y-1.5` 的 6px；6 位动态码是单个 `w-40` 输入框靠 `tracking-[0.3em]` 把字符撑开，字距一大反而看不出输入了几位；手动密钥只能靠鼠标划选。本轮只动表现层，把这四处改掉：

- 动态码改成 6 个独立格子（`OtpInput`）：输入自动跳下一格，粘贴或系统一次性验证码自动填充会整串铺开，退格在空格子上回退并清掉上一位，左右方向键移动，聚焦即全选（改一位不会连带清掉后面）。第一格带 `autocomplete="one-time-code"`，手机输入法能识别。
- 手动密钥旁加「复制」按钮，复用与恢复码同一套 `copyToClipboard`（Clipboard API 优先，http 环境回退到临时 textarea），成功/失败都给 toast。
- 「当前密码」「6 位动态码」改成左标签右输入：`FieldRow` 里标签列定宽 `sm:w-24` 且右对齐、输入列 `sm:flex-1`、两列之间 `sm:gap-6`（24px）。窄屏（`sm` 以下）仍回到上下堆叠，避免输入框被挤成一条缝。
- 同样的左右布局与格子输入一并应用到「重新生成恢复码」「关闭两步验证」两处表单，免得同页出现三种排版。

验收标准：开启两步验证时 6 位动态码以 6 格呈现且输入/粘贴/退格都正常；手动密钥可一键复制；「当前密码」「6 位动态码」标签与输入框左右分列且中间有明显间距；三处表单排版一致；`OtpInput` 与复制按钮有 vitest 用例；`tsc --noEmit`、`vitest run`、`next build` 与后端测试/`bootJar` 通过；按 `feature/v0.1.42 -> dev -> main` 发布并完成生产验收。

本轮无数据库迁移、无接口改动、无新依赖：请求体与字段完全不变，版本号（前后端 VERSION、`package.json`、`build.gradle.kts`、favicon `?v=`）统一升到 `0.1.42`，后端仅随版本号重新构建与重启，Kotlin 代码未改。

## 当前迭代：v0.1.41（已发布）

发布分支：`feature/v0.1.41`；类型：补丁迭代（两步验证挑战失效提示）；需求编号：`REQ-202609-0104`。

两步验证的挑战 token 只有 5 分钟有效期，而登录页停在这一步更久（切去 Authenticator 复制验证码、GitHub 回调整页跳转后返回）是常见情形。此前 `verifyTwoFactor` 直接调用 `jwtUtil.extractClaims()`，`ExpiredJwtException` 会一路冒到 `GlobalExceptionHandler` 的兜底分支，前端拿到的是 `{"code":9999,"message":"Internal server error"}`——用户看不出该重新登录还是该重输验证码。

本轮把该调用包进 `try/catch (io.jsonwebtoken.JwtException)`，统一转成 `InvalidCredentialsException("登录凭证已失效，请重新登录")`（`code=1006`），前端两步验证步骤会直接把这句话显示出来。改动只覆盖「挑战 token 本身无法解析」这一种情况：解析成功但 scope 不对、验证码错误等既有分支行为不变。`/api/auth/login`、`/api/auth/refresh` 等既有接口对垃圾 token 仍沿用项目原有的 500 约定，即 `GlobalExceptionHandler` 只把 `BusinessException`/`IllegalArgumentException` 翻译成业务码，本轮不扩散改动面。

验收标准：挑战 token 过期或被篡改时，`POST /api/auth/two-factor/verify` 返回 `code=1006` 与「登录凭证已失效，请重新登录」，且不再进入验证码校验与用户查询；`AuthServiceTest` 新增用例锁住该行为；后端测试与 `bootJar` 通过；按 `feature/v0.1.41 -> dev -> main` 发布并完成生产验收。

本轮不涉及数据库迁移、前端业务逻辑、后台管理项目或共享基础设施。

## 当前迭代：v0.1.40（已发布）

发布分支：`feature/v0.1.40`；类型：功能迭代（个人中心两步验证功能完善）；需求编号：`REQ-202609-0104`。

本轮把个人中心的两步验证从占位文案补成完整闭环。后端从零实现 TOTP（RFC 6238，HMAC-SHA1、6 位、30 秒、±1 步容差）与恢复码体系：新增 `pr_user_two_factor`、`pr_user_recovery_codes`、`pr_user_devices` 三张表（Flyway `V14`），密码/邮箱验证码/GitHub 三种登录方式统一汇入 `completeLogin`，开启两步验证且设备未被信任时返回一次性挑战 token，`POST /api/auth/two-factor/verify` 用动态码或恢复码换取正式 token。开启两次验证的路径（首次开启、关闭后再次开启）都会下发 9 个 6 位一次性恢复码，并且只有在两步验证处于开启状态时才有效——关闭时直接删除恢复码记录，使「失效」成为结构保证而不是使用时的判断。

前端补齐扫码绑定向导（主题自适应二维码 + 手动密钥）、恢复码面板（一键复制 / 下载 TXT 文本文件，不做 PDF）、关闭与重新生成流程，并在个人中心新增与「两步验证」同级的「信任设备」菜单，菜单数由 4 个变为 5 个。信任设备页列出所有登录过的设备，支持手动勾选删除；设备表是 token 校验的一环，删除后该设备已签发的 access/refresh token 立即失效，必须重新登录。

验收标准：未开启两步验证的账号可扫码绑定并成功开启；开启后密码/邮箱验证码/GitHub 三种登录都需要二次验证，信任设备可免动态码；每次开启都下发 9 个 6 位恢复码，且「一键复制」「下载 TXT」两种保存方式都可用；恢复码在关闭两步验证后失效；二维码在浅色与深色主题下均可扫描；个人中心出现第 5 个菜单「信任设备」，列表可多选删除，被删设备的 token 立即失效并需重新登录；前端类型检查、测试、生产构建及后端测试和 bootJar 通过；按 `feature/v0.1.40 -> dev -> main` 发布并完成生产验收。

发布结果（2026-09-14 UTC）：`feature/v0.1.40`（`5f88fbf`）已并入 `dev`（`91045dc`）与 `main`（`de2ea29`），生产前后端已重建部署，Flyway 迁移 `V14` 已在生产库执行，`/api/health` 返回 `0.1.40`。

## 当前迭代：v0.1.39

发布分支：`feature/v0.1.39`；类型：Bug 修复迭代（登录页展示区位置微调）；需求编号：`REQ-202609-0103`。

调整登录页左侧展示区（轮播）在栅格单元内的位置：整体往右、往下各内缩一段距离，使展示区与更高的登录卡片在视觉上更平衡。只调整展示区自身的 `padding`，右侧登录表单位置、结构、认证逻辑完全不动；`lg` 以下展示区本来就隐藏，因此窄屏行为不变。本轮同时把前后端版本文件、favicon 缓存参数和文档同步到 `0.1.39`。

验收标准：`lg`/`xl` 断点下展示区相对上一版明显右移并下移，右侧登录卡片位置与 v0.1.38 完全一致；窄屏仍只显示登录表单；中英文均正常；前端类型检查、测试、生产构建及后端测试和 bootJar 通过；按 `feature/v0.1.39 -> dev -> main` 发布并完成生产验收。

本轮不涉及数据库迁移、后端接口、用户数据、后台管理项目或共享基础设施。

发布结果（2026-09-14 UTC）：`feature/v0.1.39`（`da3f4a6`）已并入 `dev`（`cee0ee9`）与 `main`（`ebe9381`），生产前后端已重建部署，`/api/health` 返回 `0.1.39`，登录页公网核验通过。

## 当前迭代：v0.1.33（已发布）

发布分支：`feature/v0.1.33`；类型：Bug 修复迭代（补齐 v0.1.32 遗留问题）；需求编号：`REQ-202609-0071`。

修复 v0.1.32 登录页改版未完成的问题：左右两栏改为等高布局；左侧粒子卡片与右侧登录卡片配色统一改为读取主题 CSS 变量，支持深浅色主动切换；登录页右上角新增主题切换与中英文切换入口；登录卡片底部新增服务条款、隐私政策链接及对应占位页面；整站登录页新增底部版本号与版权信息。

验收标准：亮/暗两种主题下左右卡片高度一致、配色均正确跟随主题；登录页可直接切换主题和语言；条款/隐私链接可访问且返回 200；页脚显示当前版本号与版权；前端类型检查、测试、Lint、生产构建及后端测试和 bootJar 通过；按 `feature/v0.1.33 -> dev -> main` 发布并完成生产验收。

本轮不涉及数据库迁移、后端接口、用户数据、后台管理项目或共享基础设施。

## 当前迭代：v0.1.32（已发布）

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
