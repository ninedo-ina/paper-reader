import { Extension } from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { numberingTransaction } from "@/lib/academic-numbering"

/**
 * 把派生编号（脚注序、引用序、图表公式序）回写到节点的 number 属性上。
 *
 * 走 appendTransaction 而不是 onUpdate：编号修正必须和触发它的那次编辑落在同一个事务周期里，
 * 否则 NodeView 会先渲染一版旧编号、下一帧再被改成新的，文末的编号会肉眼可见地闪一下。
 */
export const AcademicNumbering = Extension.create({
  name: "academicNumbering",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("academicNumbering"),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null
          return numberingTransaction(newState)
        },
      }),
    ]
  },

  onCreate() {
    // 初次载入（含从 JSON 还原正文）不经过 appendTransaction，这里补跑一次。
    // 不进撤销栈：用户撤销一次不该把编号改回去。
    const tr = numberingTransaction(this.editor.state)
    if (!tr) return
    tr.setMeta("addToHistory", false)
    this.editor.view.dispatch(tr)
  },
})
