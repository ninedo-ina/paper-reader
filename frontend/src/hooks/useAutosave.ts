"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * 自动保存状态机：
 * - idle     尚无改动 / 初始态
 * - dirty    有未保存改动，正在等防抖窗口
 * - saving   正在保存
 * - saved    已落库且此后没有新改动
 * - failed   保存失败（多为网络问题），会自动重试
 * - rejected 本地自检或服务端判定「再存也没用」（体积超限、无权限、参数非法），不重试
 * - conflict 版本冲突：别的会话已经写过，后写被服务端拒绝，需用户重新加载
 */
export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "failed" | "rejected" | "conflict"

/** 与后端约定的版本冲突错误码（BusinessException code=1008 / HTTP 409） */
export const CONTENT_CONFLICT_CODE = 1008
/** 正文体积超限（BusinessException code=1014 / HTTP 413），见后端 ContentTooLargeException */
export const CONTENT_TOO_LARGE_CODE = 1014

/**
 * 重试没有意义的错误码：权限不足、参数非法、资源不存在、体积超限。
 * 这几类按同样的正文再发一百次也是同样的结果，继续重试只会放大流量、
 * 并且让编辑器一直停在「正在重试」的假象里。
 */
const NON_RETRYABLE_CODES: readonly number[] = [1002, 1003, 1004, CONTENT_TOO_LARGE_CODE]

const DEFAULT_DEBOUNCE_MS = 2000
const RETRY_MS = 5000

function errorCode(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null
  const code = (err as { code?: unknown }).code
  return typeof code === "number" ? code : null
}

function isConflict(err: unknown): boolean {
  return errorCode(err) === CONTENT_CONFLICT_CODE
}

function isRetryable(err: unknown): boolean {
  const code = errorCode(err)
  if (code === null) return true // 没有业务码：多半是网络/5xx，重试有意义
  return !NON_RETRYABLE_CODES.includes(code)
}

/**
 * 被拦下的保存。`size`/`limit` 只在体积超限时有值，供上层把「超了多少」讲清楚。
 */
export interface AutosaveRejection {
  code: number
  message?: string
  /** 实际字节数（超限时） */
  size?: number
  /** 上限字节数（超限时） */
  limit?: number
}

interface UseAutosaveOptions<T> {
  /** 取当前要保存的内容；返回 null 表示还没准备好（如编辑器未就绪），本次跳过 */
  getPayload: () => T | null
  /** 实际保存动作；版本冲突时应抛出带 code===1008 的错误 */
  save: (payload: T) => Promise<void>
  /** 停止编辑多久后自动保存（毫秒），默认 2000 */
  debounceMs?: number
  /**
   * 内容指纹。指纹与上次成功保存的一致时直接跳过请求（写放大控制）。
   * 默认 JSON.stringify —— 对编辑器 payload 已经够用，且不依赖键顺序以外的任何东西。
   */
  fingerprint?: (payload: T) => string
  /**
   * 提交前自检。返回非 null 表示本地就把它拦下：不发请求、不重试，直接进 rejected。
   * 服务端始终是权威判定，这里只是别把注定被拒的正文反复发上去。
   */
  guard?: (payload: T, fingerprint: string) => AutosaveRejection | null
}

export interface AutosaveController {
  status: AutosaveStatus
  isDirty: boolean
  /** 最近一次被拦下的原因；离开 rejected 态后清空 */
  rejection: AutosaveRejection | null
  /** 编辑器内容变化时调用：标脏并安排一次防抖自动保存 */
  markDirty: () => void
  /** 立即保存（手动保存按钮 / 失败后重试用） */
  saveNow: () => void
  /** 冲突已由外部处理（重新加载最新内容后）时复位为干净态 */
  reset: () => void
}

/**
 * 防抖自动保存 + 失败重试 + 冲突识别 + 写放大控制。写作不再依赖「记得点保存」：
 * 停止编辑 debounceMs 后自动落库；断网导致的失败会定时重试，且监听 `online` 事件在
 * 网络恢复的第一时间补写；后写覆盖被服务端拒绝时停止重试并进入 conflict，交给上层提示。
 *
 * 写放大方面做了三层收敛：
 * 1. 指纹去重：内容与上次成功保存的完全一致（改了又改回去）时，一个请求都不发；
 * 2. 本地自检：guard 判超限就直接拦下，不进网络层；
 * 3. 不可重试错误不再进重试循环。
 */
export function useAutosave<T>({
  getPayload,
  save,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  fingerprint,
  guard,
}: UseAutosaveOptions<T>): AutosaveController {
  const [status, setStatus] = useState<AutosaveStatus>("idle")
  const [isDirty, setIsDirty] = useState(false)
  const [rejection, setRejection] = useState<AutosaveRejection | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 正在保存时的编辑序号，用来判断「保存期间又改了」，避免把新改动误标成已保存。
  const editSeqRef = useRef(0)
  const savingRef = useRef(false)
  // 上次成功落库的内容指纹：用于跳过「改回原样」的重复提交。
  const lastPersistedRef = useRef<string | null>(null)
  // 用 ref 持有最新的取值/保存函数与配置，避免它们的身份变化重建回调、丢失定时器。
  const getPayloadRef = useRef(getPayload)
  const saveRef = useRef(save)
  const debounceMsRef = useRef(debounceMs)
  const fingerprintRef = useRef(fingerprint)
  const guardRef = useRef(guard)
  const saveNowRef = useRef<() => void>(() => {})
  getPayloadRef.current = getPayload
  saveRef.current = save
  debounceMsRef.current = debounceMs
  fingerprintRef.current = fingerprint
  guardRef.current = guard

  const fingerprintOf = useCallback((payload: T): string => {
    const fn = fingerprintRef.current
    return fn ? fn(payload) : JSON.stringify(payload)
  }, [])

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

    const fingerprint = fingerprintOf(payload)
    const blocked = guardRef.current?.(payload, fingerprint) ?? null
    if (blocked) {
      // 本地自检没过：不发请求，也不进重试循环，让用户先把正文精简下来。
      setRejection(blocked)
      setStatus("rejected")
      return
    }

    if (fingerprint === lastPersistedRef.current) {
      // 与服务端已落库的内容逐字节一致（例如改完又改回去）：跳过写请求。
      setRejection(null)
      setIsDirty(false)
      setStatus("saved")
      return
    }

    const seqAtSave = editSeqRef.current
    savingRef.current = true
    setRejection(null)
    setStatus("saving")

    saveRef.current(payload)
      .then(() => {
        // 保存期间又改了时，指纹代表的仍是刚落的这一版，照记不误。
        lastPersistedRef.current = fingerprint
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
        } else if (isRetryable(err)) {
          setStatus("failed")
          // 断网等临时失败：定时重试；`online` 监听会在网络恢复时更快补写。
          clearRetry()
          retryRef.current = setTimeout(() => saveNowRef.current(), RETRY_MS)
        } else {
          // 服务端也会独立判一次体积（前端拿不到限额时会漏判），照实报给用户，不重试。
          const code = errorCode(err)
          setRejection({
            code: code ?? 0,
            message: err instanceof Error ? err.message : undefined,
          })
          setStatus("rejected")
        }
      })
      .finally(() => {
        savingRef.current = false
      })
  }, [clearDebounce, clearRetry, fingerprintOf, scheduleDebounced])
  saveNowRef.current = saveNow

  const markDirty = useCallback(() => {
    editSeqRef.current += 1
    setIsDirty(true)
    setRejection(null)
    setStatus("dirty")
    scheduleDebounced()
  }, [scheduleDebounced])

  const reset = useCallback(() => {
    clearDebounce()
    clearRetry()
    editSeqRef.current += 1
    savingRef.current = false
    // 外部（重新加载/切换论文）接手了内容，指纹不再代表屏幕上的这一版。
    lastPersistedRef.current = null
    setRejection(null)
    setIsDirty(false)
    setStatus("idle")
  }, [clearDebounce, clearRetry])

  // 网络恢复时，若还有没存上的改动或上次失败，立刻补写一次。
  // rejected 不在其列：再发一次结果一样。
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

  return { status, isDirty, rejection, markDirty, saveNow, reset }
}
