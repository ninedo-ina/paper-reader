"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * 自动保存状态机：
 * - idle    尚无改动 / 初始态
 * - dirty   有未保存改动，正在等防抖窗口
 * - saving  正在保存
 * - saved   已落库且此后没有新改动
 * - failed  保存失败（多为网络问题），会自动重试
 * - conflict 版本冲突：别的会话已经写过，后写被服务端拒绝，需用户重新加载
 */
export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "failed" | "conflict"

/** 与后端约定的版本冲突错误码（BusinessException code=1008 / HTTP 409） */
export const CONTENT_CONFLICT_CODE = 1008

const DEFAULT_DEBOUNCE_MS = 2000
const RETRY_MS = 5000

function isConflict(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === CONTENT_CONFLICT_CODE
}

interface UseAutosaveOptions<T> {
  /** 取当前要保存的内容；返回 null 表示还没准备好（如编辑器未就绪），本次跳过 */
  getPayload: () => T | null
  /** 实际保存动作；版本冲突时应抛出带 code===1008 的错误 */
  save: (payload: T) => Promise<void>
  /** 停止编辑多久后自动保存（毫秒），默认 2000 */
  debounceMs?: number
}

export interface AutosaveController {
  status: AutosaveStatus
  isDirty: boolean
  /** 编辑器内容变化时调用：标脏并安排一次防抖自动保存 */
  markDirty: () => void
  /** 立即保存（手动保存按钮 / 失败后重试用） */
  saveNow: () => void
  /** 冲突已由外部处理（重新加载最新内容后）时复位为干净态 */
  reset: () => void
}

/**
 * 防抖自动保存 + 失败重试 + 冲突识别。写作不再依赖「记得点保存」：
 * 停止编辑 debounceMs 后自动落库；断网导致的失败会定时重试，且监听 `online` 事件在
 * 网络恢复的第一时间补写；后写覆盖被服务端拒绝时停止重试并进入 conflict，交给上层提示。
 */
export function useAutosave<T>({ getPayload, save, debounceMs = DEFAULT_DEBOUNCE_MS }: UseAutosaveOptions<T>): AutosaveController {
  const [status, setStatus] = useState<AutosaveStatus>("idle")
  const [isDirty, setIsDirty] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 正在保存时的编辑序号，用来判断「保存期间又改了」，避免把新改动误标成已保存。
  const editSeqRef = useRef(0)
  const savingRef = useRef(false)
  // 用 ref 持有最新的取值/保存函数与配置，避免它们的身份变化重建回调、丢失定时器。
  const getPayloadRef = useRef(getPayload)
  const saveRef = useRef(save)
  const debounceMsRef = useRef(debounceMs)
  const saveNowRef = useRef<() => void>(() => {})
  getPayloadRef.current = getPayload
  saveRef.current = save
  debounceMsRef.current = debounceMs

  // 这三个只读写 ref，身份可以永久稳定：稳定下来后，引用它们的回调才不必跟着重建、丢定时器。
  const clearDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])
  const clearRetry = useCallback(() => {
    if (retryRef.current) {
      clearTimeout(retryRef.current)
      retryRef.current = null
    }
  }, [])
  const scheduleDebounced = useCallback(() => {
    clearDebounce()
    // 经 ref 间接触发，避免 saveNow 与 scheduleDebounced 相互依赖成环
    debounceRef.current = setTimeout(() => saveNowRef.current(), debounceMsRef.current)
  }, [clearDebounce])

  const saveNow = useCallback(() => {
    clearDebounce()
    clearRetry()
    if (savingRef.current) return // 已在保存中：完成后会根据编辑序号决定是否再存
    const payload = getPayloadRef.current()
    if (payload === null) return

    const seqAtSave = editSeqRef.current
    savingRef.current = true
    setStatus("saving")

    saveRef.current(payload)
      .then(() => {
        if (editSeqRef.current === seqAtSave) {
          // 保存期间没有新改动 → 真正干净
          setIsDirty(false)
          setStatus("saved")
        } else {
          // 保存期间又改了 → 仍然脏，安排下一次
          setStatus("dirty")
          scheduleDebounced()
        }
      })
      .catch((err) => {
        if (isConflict(err)) {
          // 后写覆盖被拒：重试也没用，等用户重新加载。保持 dirty 以免被误认为已保存。
          setStatus("conflict")
        } else {
          setStatus("failed")
          // 断网等临时失败：定时重试；`online` 监听会在网络恢复时更快补写。
          clearRetry()
          retryRef.current = setTimeout(() => saveNowRef.current(), RETRY_MS)
        }
      })
      .finally(() => {
        savingRef.current = false
      })
  }, [clearDebounce, clearRetry, scheduleDebounced])
  saveNowRef.current = saveNow

  const markDirty = useCallback(() => {
    editSeqRef.current += 1
    setIsDirty(true)
    setStatus("dirty")
    scheduleDebounced()
  }, [scheduleDebounced])

  const reset = useCallback(() => {
    clearDebounce()
    clearRetry()
    editSeqRef.current += 1
    savingRef.current = false
    setIsDirty(false)
    setStatus("idle")
  }, [clearDebounce, clearRetry])

  // 网络恢复时，若还有没存上的改动或上次失败，立刻补写一次。
  useEffect(() => {
    const onOnline = () => {
      if (savingRef.current) return
      setStatus((s) => {
        if (s === "failed" || s === "dirty") saveNowRef.current()
        return s
      })
    }
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [])

  // 卸载时清干净定时器，避免对已卸载组件 setState。
  useEffect(
    () => () => {
      clearDebounce()
      clearRetry()
    },
    [clearDebounce, clearRetry],
  )

  return { status, isDirty, markDirty, saveNow, reset }
}
