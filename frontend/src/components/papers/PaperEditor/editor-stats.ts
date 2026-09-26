export interface EditorStats {
  /** 词数：CJK 每字算一个词，其余按空白切分后累加 */
  words: number
  /** 字符数：不含空白 */
  characters: number
}

// 逐字计数的文字：CJK 统一表意文字、扩展 A、兼容表意文字，以及日文假名——
// 它们不靠空格分词。韩文谚文（U+AC00–U+D7A3）用空格分词，故意不列进来。
const CJK_CHAR = /[㐀-䶿一-鿿豈-﫿぀-ヿ]/g

/**
 * 统计编辑器纯文本的词数与字符数。
 *
 * 中英混排的论文里，单纯按空白分词会把整段中文算成 1 个词，所以对 CJK 逐字计数、
 * 对其余文字按空白切分，两者相加才是符合直觉的「字数」。字符数一律不含空白。
 */
export function computeEditorStats(text: string): EditorStats {
  const characters = text.replace(/\s/g, "").length

  const cjkCount = (text.match(CJK_CHAR) || []).length
  // 把 CJK 挖走后剩下的按空白切；否则「你好world」会被并成一段数错
  const latin = text.replace(CJK_CHAR, " ").trim()
  const latinWords = latin ? latin.split(/\s+/).length : 0

  return { words: cjkCount + latinWords, characters }
}
