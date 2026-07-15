"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useImStore } from "@/stores/im-store"
import { Plus, Users } from "lucide-react"

export function GroupChatList() {
  const tc = useTranslations("chat")
  const tcCommon = useTranslations("common")
  const groups = useImStore((s) => s.groups)
  const openGroupChat = useImStore((s) => s.openGroupChat)
  const [showCreate, setShowCreate] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [creating, setCreating] = useState(false)

  // Placeholder for create group — will use API
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return
    setCreating(true)
    const { createGroup } = await import("@/lib/api/chat")
    try {
      const group = await createGroup(groupName, [])
      setShowCreate(false)
      setGroupName("")
      openGroupChat(group.id, group.name)
    } catch { /* ignored */ }
    setCreating(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with create button */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium cursor-pointer transition-colors"
        >
          <Plus size={16} />
          {tc("createGroup")}
        </button>
      </div>

      {/* Create group modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6 w-80">
            <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
              {tc("createGroup")}
            </h3>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={tc("groupNamePlaceholder")}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 outline-none focus:border-zinc-400"
              onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                {tcCommon("cancel")}
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || creating}
                className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-400 text-white rounded-lg font-medium cursor-pointer transition-colors"
              >
                {creating ? tc("creating") : tcCommon("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group list */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 && (
          <div className="p-4 text-center text-sm text-zinc-400">
            {tc("noGroups")}
          </div>
        )}
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => openGroupChat(group.id, group.name)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center shrink-0">
              {group.avatarUrl ? (
                <img
                  src={group.avatarUrl}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <Users size={18} className="text-zinc-600 dark:text-zinc-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                {group.name}
              </div>
              <div className="text-xs text-zinc-400">
                {group.memberCount} members
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
