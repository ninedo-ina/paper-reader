import type { AbstractIntlMessages } from "next-intl"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextIntlClientProvider } from "next-intl"
import AuthLayout from "@/app/[locale]/(auth)/layout"
import zhMessages from "@/i18n/locales/zh/common.json"

// 布局里带语言切换按钮，它按 app router 取路由；jsdom 里没有 router，补个空壳。
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/zh/login",
}))

// jsdom 不做排版，量不出「离顶部多少像素」，所以这里锁的是**让那块内容居中的结构**：
// 顶栏和页脚各自占自己的高度，中间那一行 flex-1 吃掉剩下的空间再 items-center。
// 之前的写法是中间那行只按内容高，富余空间全被页脚的 mt-auto 吸走，大显示器上
// 整块内容就贴在顶栏下面 —— 这正是要修的那个「有点靠顶部」。
function mount() {
  return render(
    <NextIntlClientProvider locale="zh" messages={zhMessages as unknown as AbstractIntlMessages}>
      <AuthLayout>
        <div data-testid="auth-form">登录表单</div>
      </AuthLayout>
    </NextIntlClientProvider>,
  )
}

/** 从表单往上走到 main，收集沿途的容器：表单列 → 栅格 → 内容行 */
function chainToMain(): { main: HTMLElement; chain: HTMLElement[] } {
  const main = document.querySelector("main") as HTMLElement
  const chain: HTMLElement[] = []
  let node = screen.getByTestId("auth-form").parentElement as HTMLElement | null
  while (node && node !== main) {
    chain.push(node)
    node = node.parentElement
  }
  return { main, chain }
}

/** 取 Tailwind 的 z-N；没写就是 z-auto，按 0 算 */
function zIndexOf(el: HTMLElement): number {
  const m = /(?:^|\s)z-(\d+)(?:\s|$)/.exec(el.className)
  return m ? Number(m[1]) : 0
}

describe("auth layout vertical rhythm", () => {
  beforeEach(() => {
    // 布局背景里的粒子画布在 jsdom 里拿不到 2d context（会往 stderr 喷一堆
    // "Not implemented"）；ParticleField 本来就在 context 为空时直接 return，
    // 这里显式回一个 null，把噪音挡掉。
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    mount()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("lets the sign-in row take the leftover height and centre the card in it", () => {
    const { main, chain } = chainToMain()
    const row = chain[chain.length - 1]

    expect(main.className).toContain("min-h-screen")
    expect(main.className).toContain("flex-col")
    expect(row.parentElement).toBe(main)
    expect(row.className).toContain("flex-1")
    expect(row.className).toContain("items-center")
  })

  it("keeps the row horizontally centred and the footer pinned to the bottom", () => {
    const { main, chain } = chainToMain()
    const grid = chain[chain.length - 2]
    const footer = main.lastElementChild as HTMLElement

    // 水平方向：栅格自己用 mx-auto + max-w-7xl 收在中间，不随窗口无上限拉伸
    expect(grid.className).toContain("grid")
    expect(grid.className).toContain("mx-auto")
    expect(grid.className).toContain("max-w-7xl")
    expect(grid.className).toContain("lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,.8fr)]")

    // 垂直方向：页脚仍然被 mt-auto 顶到最下面，居中用的是中间那行的富余空间
    expect(footer.className).toContain("mt-auto")
    expect(footer.className).not.toContain("flex-1")
  })

  // 语言下拉挂在顶栏里（`z-50` 的菜单），而顶栏和内容行是 main 的两个兄弟。
  // 兄弟之间 z-index 相等时**后面的赢**，内容行在 DOM 里更靠后，于是下拉虽然
  // `z-50` 也会被登录卡片压住 —— 选项落在卡片范围内就既看不见也点不着，这就是
  // 「登录页语言切换失效」的现场。锁住「顶栏严格高于内容行」，别把 z-30 改回去。
  it("paints the header, and the language dropdown hanging out of it, above the sign-in row", () => {
    const { main, chain } = chainToMain()
    const row = chain[chain.length - 1]

    const trigger = document.querySelector('button[aria-haspopup="listbox"]') as HTMLElement
    expect(trigger).not.toBeNull()
    let header = trigger
    while (header.parentElement && header.parentElement !== main) {
      header = header.parentElement
    }

    expect(header.parentElement).toBe(main)
    expect(row.parentElement).toBe(main)
    expect(zIndexOf(header)).toBeGreaterThan(zIndexOf(row))
    // 内容行自己也要留在背景装饰（z-0）之上，别为了拉开差距把它压到背景下面
    expect(zIndexOf(row)).toBeGreaterThan(0)
  })
})
