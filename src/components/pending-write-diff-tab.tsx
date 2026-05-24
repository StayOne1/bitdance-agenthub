'use client'

import { Check, FilePlus2, FilePenLine, Loader2, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'

import { Button } from '@/components/ui/button'
import { approvePendingWrite, rejectPendingWrite } from '@/lib/api'
import { useAppStore, usePendingWrites } from '@/stores/app-store'

/**
 * PendingWriteDiffTab —— 中间区的「pending fs_write diff」标签页内容。
 *
 * 用 react-diff-viewer-continued 紧凑 mono 样式渲染 oldContent vs newContent，
 * 底部固定 action bar，提供应用 / 拒绝按钮。
 *
 * Pending 一旦被 resolve（SSE / 用户操作），自动关闭 tab。
 */
export function PendingWriteDiffTab({
  conversationId,
  pendingId,
}: {
  conversationId: string
  pendingId: string
}) {
  const pending = usePendingWrites(conversationId).find((p) => p.id === pendingId)
  const agent = useAppStore((s) => (pending ? s.agents[pending.agentId] : null))
  const closeFile = useAppStore((s) => s.closeFile)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null)
  const [error, setError] = useState<string | null>(null)

  // pending 不见了（已被 resolve）→ 自动关 tab
  useEffect(() => {
    if (!pending) closeFile(conversationId, `diff:${pendingId}`)
  }, [pending, closeFile, conversationId, pendingId])

  const diffStyles = useMemo(() => buildDiffStyles(isDark), [isDark])

  const handleApprove = useCallback(async () => {
    setBusy('approve')
    setError(null)
    try {
      await approvePendingWrite(conversationId, pendingId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(null)
    }
  }, [conversationId, pendingId])

  const handleReject = useCallback(async () => {
    setBusy('reject')
    setError(null)
    try {
      await rejectPendingWrite(conversationId, pendingId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(null)
    }
  }, [conversationId, pendingId])

  if (!pending) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        审批已处理，关闭中...
      </div>
    )
  }

  const isNew = pending.oldContent === null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b bg-card/30 px-3 py-2 text-xs">
        {isNew ? (
          <FilePlus2 className="size-3.5 shrink-0 text-emerald-600" />
        ) : (
          <FilePenLine className="size-3.5 shrink-0 text-[#3370FF]" />
        )}
        <code className="min-w-0 flex-1 truncate font-mono">{pending.path}</code>
        <span className="shrink-0 text-muted-foreground">
          {agent?.name ?? 'Agent'} 想{isNew ? '创建' : '修改'}
        </span>
      </div>

      {/* Diff body */}
      <div className="min-h-0 flex-1 overflow-auto bg-background pending-diff-body">
        <ReactDiffViewer
          oldValue={pending.oldContent ?? ''}
          newValue={pending.newContent}
          splitView={true}
          useDarkTheme={isDark}
          compareMethod={DiffMethod.WORDS_WITH_SPACE}
          leftTitle={isNew ? '(文件不存在)' : '当前内容'}
          rightTitle="Agent 写入后"
          styles={diffStyles}
        />
      </div>

      {/* Action bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-card/40 px-3 py-2">
        {error ? (
          <span className="font-mono text-xs text-destructive">{error}</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            Review 模式 — 应用前可拒绝，或直接 [拒绝] 后到对应文件 tab 自己改
          </span>
        )}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReject}
            disabled={!!busy}
            className="h-7"
          >
            {busy === 'reject' ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <X className="mr-1 size-3.5" />
            )}
            拒绝
          </Button>
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={!!busy}
            className="h-7 bg-[#3370FF] text-white hover:bg-[#2860e5]"
          >
            {busy === 'approve' ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Check className="mr-1 size-3.5" />
            )}
            应用
          </Button>
        </div>
      </div>
    </div>
  )
}

function buildDiffStyles(isDark: boolean) {
  const fontFamily =
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
  const base = {
    diffContainer: {
      fontSize: 12,
      lineHeight: 1.55,
    },
    contentText: {
      fontFamily,
      fontSize: 12,
    },
    gutter: {
      fontFamily,
      fontSize: 11,
      minWidth: 36,
      padding: '0 6px',
    },
    line: {
      padding: '0 6px',
    },
    titleBlock: {
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: 11,
      padding: '6px 12px',
      textTransform: 'none' as const,
      letterSpacing: 0,
    },
    splitView: {},
  }
  if (isDark) {
    return {
      ...base,
      variables: {
        dark: {
          diffViewerBackground: 'transparent',
          diffViewerColor: '#d4d4d8',
          addedBackground: 'rgba(34, 197, 94, 0.10)',
          addedColor: '#bbf7d0',
          removedBackground: 'rgba(244, 63, 94, 0.12)',
          removedColor: '#fecdd3',
          wordAddedBackground: 'rgba(34, 197, 94, 0.30)',
          wordRemovedBackground: 'rgba(244, 63, 94, 0.32)',
          addedGutterBackground: 'rgba(34, 197, 94, 0.14)',
          removedGutterBackground: 'rgba(244, 63, 94, 0.16)',
          addedGutterColor: '#86efac',
          removedGutterColor: '#fda4af',
          gutterBackground: 'transparent',
          gutterBackgroundDark: 'transparent',
          gutterColor: '#52525b',
          codeFoldGutterBackground: 'transparent',
          codeFoldBackground: 'rgba(255,255,255,0.03)',
          emptyLineBackground: 'rgba(255,255,255,0.02)',
          diffViewerTitleBackground: 'rgba(255,255,255,0.03)',
          diffViewerTitleColor: '#a1a1aa',
          diffViewerTitleBorderColor: 'rgba(255,255,255,0.08)',
        },
      },
    }
  }
  return {
    ...base,
    variables: {
      light: {
        diffViewerBackground: 'transparent',
        diffViewerColor: '#18181b',
        addedBackground: '#e6ffec',
        addedColor: '#14532d',
        removedBackground: '#ffeef0',
        removedColor: '#7f1d1d',
        wordAddedBackground: '#abf2bc',
        wordRemovedBackground: '#fdb8c0',
        addedGutterBackground: '#cdf5d8',
        removedGutterBackground: '#ffd7dc',
        addedGutterColor: '#15803d',
        removedGutterColor: '#b91c1c',
        gutterBackground: 'transparent',
        gutterBackgroundDark: 'transparent',
        gutterColor: '#a1a1aa',
        codeFoldGutterBackground: '#f4f4f5',
        codeFoldBackground: '#fafafa',
        emptyLineBackground: '#fafafa',
        diffViewerTitleBackground: '#fafafa',
        diffViewerTitleColor: '#52525b',
        diffViewerTitleBorderColor: '#e4e4e7',
      },
    },
  }
}
