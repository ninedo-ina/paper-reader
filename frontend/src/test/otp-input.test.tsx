import { useState } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OtpInput } from "@/components/settings/OtpInput"

/** 受控组件，测试里补一层 state 才能真实地「输入」 */
function Harness({ onChange, initial = "" }: { onChange?: (value: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <OtpInput
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

function cells(): HTMLInputElement[] {
  return [0, 1, 2, 3, 4, 5].map(
    (index) => screen.getByLabelText(`动态码第 ${index + 1} 位`) as HTMLInputElement,
  )
}

/** 把六格拼回一个字符串，比较起来更直观 */
function joined(inputs: HTMLInputElement[]): string {
  return inputs.map((input) => input.value).join("")
}

describe("otp input", () => {
  afterEach(cleanup)

  it("renders six single-digit cells with the first one marked as a one-time code", () => {
    render(<Harness />)
    const inputs = cells()

    expect(inputs).toHaveLength(6)
    expect(inputs[0].getAttribute("autocomplete")).toBe("one-time-code")
    expect(inputs[0].getAttribute("inputmode")).toBe("numeric")
  })

  it("advances to the next cell as digits are typed", () => {
    render(<Harness />)
    const inputs = cells()

    fireEvent.change(inputs[0], { target: { value: "1" } })
    expect(inputs[0].value).toBe("1")
    expect(document.activeElement).toBe(inputs[1])

    fireEvent.change(inputs[1], { target: { value: "2" } })
    expect(joined(cells())).toBe("12")
    expect(document.activeElement).toBe(inputs[2])
  })

  it("distributes a pasted code across the cells", () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    fireEvent.change(cells()[0], { target: { value: "123456" } })

    expect(onChange).toHaveBeenLastCalledWith("123456")
    expect(joined(cells())).toBe("123456")
  })

  it("keeps the other digits when a single cell is replaced", () => {
    const onChange = vi.fn()
    render(<Harness initial="1234" onChange={onChange} />)

    fireEvent.change(cells()[1], { target: { value: "9" } })

    expect(onChange).toHaveBeenLastCalledWith("1934")
    expect(joined(cells())).toBe("1934")
  })

  it("backspaces into the previous cell and clears it", () => {
    const onChange = vi.fn()
    render(<Harness initial="12" onChange={onChange} />)
    const inputs = cells()

    fireEvent.keyDown(inputs[2], { key: "Backspace" })

    expect(onChange).toHaveBeenLastCalledWith("1")
    expect(joined(cells())).toBe("1")
    expect(document.activeElement).toBe(inputs[1])
  })

  it("moves between cells with the arrow keys", () => {
    render(<Harness initial="123456" />)
    const inputs = cells()

    fireEvent.keyDown(inputs[3], { key: "ArrowLeft" })
    expect(document.activeElement).toBe(inputs[2])

    fireEvent.keyDown(inputs[2], { key: "ArrowRight" })
    expect(document.activeElement).toBe(inputs[3])
  })
})
