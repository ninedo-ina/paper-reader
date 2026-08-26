import { describe, expect, it } from "vitest"
import {
  categoryExtraFieldValue,
  preserveEnrichmentFields,
  publicationPagesValue,
  updateCategoryExtraField,
} from "@/lib/paper-metadata"

describe("paper metadata compatibility helpers", () => {
  it("reads legacy pages while writing the canonical publicationPages key", () => {
    expect(publicationPagesValue({ pages: "5998-6008" })).toBe("5998-6008")
    expect(categoryExtraFieldValue({ pages: "5998-6008" }, "pages")).toBe("5998-6008")
    expect(updateCategoryExtraField({ pages: "old" }, "pages", "new")).toEqual({ publicationPages: "new" })
  })

  it("preserves provider enrichment when switching category forms", () => {
    expect(preserveEnrichmentFields({ volume: "30", arxivVersion: "7", indexing: "SCI" })).toEqual({
      volume: "30",
      arxivVersion: "7",
    })
  })
})
