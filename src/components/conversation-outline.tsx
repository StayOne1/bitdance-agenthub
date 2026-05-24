'use client'

import { Filter, ListTree, MessageSquare, Star } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import type { MessageRow } from '@/db/schema'
import { toggleMessageBookmark } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAppStore, useMessagesForConversation } from '@/stores/app-store'

/**
 * ConversationOutline —— ChatPanel header 的「目录」按钮。
 *
 * 点击弹 popover 列出本会话所有 user message（用户提问），点击跳转 + 短暂高亮。
 * 每条 item 右侧有 ☆ 按钮可收藏到 conversation.bookmarkedMessageIds —— 纯 UI 书签，
 * 仅用于导航定位，不影响 LLM 上下文（与独立的 pinnedMessageIds 区分，详见 spec 01）。
 */
export function ConversationOutline({ conversationId }: { conversationId: string }) {
  const messages = useMessagesForConversation(conversationId)
  const highlightMessage = useAppStore((s) => s.highlightMessage)
  const conversation = useAppStore((s) => s.conversations[conversationId])
  const setBookmarkedMessageIds = useAppStore((s) => s.setBookmarkedMessageIds)
  const bookmarkedIds = useMemo(
    () => new Set(conversation?.bookmarkedMessageIds ?? []),
    [conversation?.bookmarkedMessageIds],
  )

  const [onlyStarred, setOnlyStarred] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const userMessages = messages.filter((m) => m.role === 'user')
  const filtered = onlyStarred ? userMessages.filter((m) => bookmarkedIds.has(m.id)) : userMessages
  const starredCount = userMessages.filter((m) => bookmarkedIds.has(m.id)).length

  if (userMessages.length === 0) return null

  const handleJump = (id: string) => {
    const el = document.getElementById(`message-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      highlightMessage(id)
    }
  }

  const handleToggleStar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (busy === id) return
    setBusy(id)
    try {
      const result = await toggleMessageBookmark(id, conversationId)
      setBookmarkedMessageIds(conversationId, result.bookmarkedMessageIds)
    } catch (err) {
      console.error('[ConversationOutline] toggle bookmark failed', err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            title={`对话目录 · ${userMessages.length} 条提问${starredCount > 0 ? ` (${starredCount} 收藏)` : ''}`}
          />
        }
      >
        <ListTree className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 font-medium">
            <ListTree className="size-3.5" />
            对话目录
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {filtered.length}/{userMessages.length}
            </span>
            <button
              type="button"
              onClick={() => setOnlyStarred((v) => !v)}
              disabled={starredCount === 0}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] transition disabled:cursor-not-allowed disabled:opacity-40',
                onlyStarred
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              title={onlyStarred ? '显示全部' : `只看收藏 (${starredCount})`}
            >
              <Filter className="size-3" />
              {onlyStarred ? '已过滤' : '只看收藏'}
            </button>
          </div>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-0.5 p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                没有收藏的提问
              </div>
            ) : (
              filtered.map((m) => (
                <OutlineItem
                  key={m.id}
                  index={userMessages.indexOf(m) + 1}
                  message={m}
                  starred={bookmarkedIds.has(m.id)}
                  busy={busy === m.id}
                  onClick={() => handleJump(m.id)}
                  onToggleStar={(e) => handleToggleStar(m.id, e)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

function OutlineItem({
  index,
  message,
  starred,
  busy,
  onClick,
  onToggleStar,
}: {
  index: number
  message: MessageRow
  starred: boolean
  busy: boolean
  onClick: () => void
  onToggleStar: (e: React.MouseEvent) => void
}) {
  // 取第一个 text part 的内容；没有就 fallback 附件 / 占位
  const textPart = message.parts.find((p) => p.type === 'text')
  const preview = textPart && textPart.type === 'text' ? textPart.content : ''
  const hasAttachments = message.parts.some(
    (p) => p.type === 'image_attachment' || p.type === 'file_attachment',
  )

  const displayText = preview || (hasAttachments ? '(附件消息)' : '(空)')
  const time = new Date(message.createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-accent',
        starred && 'bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/40',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-start gap-2 text-left"
      >
        <span className="mt-0.5 shrink-0 font-mono text-[10px] text-muted-foreground/70 group-hover:text-foreground/70">
          #{index}
        </span>
        <MessageSquare className="mt-0.5 size-3 shrink-0 text-muted-foreground/50" />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 whitespace-pre-wrap break-words leading-snug">
            {displayText}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{time}</div>
        </div>
      </button>
      <button
        type="button"
        onClick={onToggleStar}
        disabled={busy}
        className={cn(
          'mt-0.5 shrink-0 rounded p-0.5 transition disabled:opacity-50',
          starred
            ? 'text-amber-500'
            : 'text-muted-foreground/30 opacity-0 hover:text-amber-500 group-hover:opacity-100',
        )}
        title={starred ? '取消收藏' : '收藏（仅用于导航定位）'}
      >
        <Star className={cn('size-3.5', starred && 'fill-amber-400')} />
      </button>
    </div>
  )
}
