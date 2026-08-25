import { beforeEach, describe, expect, it } from "vitest"
import { useReaderStore } from "@/stores/reader-store"

const activeAnnotation = {
  id: 1,
  paperId: 10,
  pageNumber: 2,
  quotedText: "active",
  content: "",
  images: [],
  position: { x: 0, y: 0, width: 1, height: 1 },
  commentCount: 0,
  createdAt: "2026-08-25T00:00:00Z",
}

const deletedAnnotation = { ...activeAnnotation, id: 2, paperId: 20 }

describe("reader paper cache cleanup", () => {
  beforeEach(() => {
    useReaderStore.setState({
      annotations: [activeAnnotation, deletedAnnotation],
      allAnnotations: [activeAnnotation, deletedAnnotation],
      selectedText: "current selection",
      aiMode: "explain",
      navigationTarget: { pageNumber: 2, timestamp: 1 },
    })
  })

  it("removes deleted-paper data without clearing another active paper context", () => {
    useReaderStore.getState().removePaperData(20, false)

    const state = useReaderStore.getState()
    expect(state.annotations).toEqual([activeAnnotation])
    expect(state.allAnnotations).toEqual([activeAnnotation])
    expect(state.selectedText).toBe("current selection")
    expect(state.aiMode).toBe("explain")
    expect(state.navigationTarget?.pageNumber).toBe(2)
  })

  it("clears active reading context when the current paper is deleted", () => {
    useReaderStore.getState().removePaperData(10, true)

    const state = useReaderStore.getState()
    expect(state.selectedText).toBe("")
    expect(state.aiMode).toBeNull()
    expect(state.navigationTarget).toBeNull()
  })
})
