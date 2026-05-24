'use client'

import { AlertTriangle, FolderOpen, FolderTree, Layers, MessagesSquare, UserPlus, X } from 'lucide-react'
import { useState } from 'react'

import { AddAgentDialog } from '@/components/add-agent-dialog'
import { AgentInfoPopover } from '@/components/agent-info-popover'
import { FileLibraryDialog } from '@/components/file-library-dialog'
import { FileTab } from '@/components/file-tab'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageInput } from '@/components/message-input'
import { MessageList } from '@/components/message-list'
import { cn } from '@/lib/utils'
import {
  useActiveConversation,
  useActiveTab,
  useAppStore,
  useOpenFiles,
} from '@/stores/app-store'

export function ChatPanel() {
  const conv = useActiveConversation()
  const agents = useAppStore((s) => s.agents)
  const streamConnected = useAppStore((s) => s.streamConnected)
  const fileExplorerOpen = useAppStore((s) => s.fileExplorerOpen)
  const previewArtifactId = useAppStore((s) => s.previewArtifactId)
  const setFileExplorerOpen = useAppStore((s) => s.setFileExplorerOpen)
  const closeArtifactPreview = useAppStore((s) => s.closeArtifactPreview)
  const closeFile = useAppStore((s) => s.closeFile)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const [addOpen, setAddOpen] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)

  const openFiles = useOpenFiles(conv?.id ?? '')
  const activeTab = useActiveTab(conv?.id ?? '')

  if (!conv) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
        <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
            <MessagesSquare className="size-7 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold">开始你的多 Agent 协作</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              从左侧选择一个会话继续聊天，或点击「+ 新建对话」选择一个或多个 Agent 开始
            </p>
          </div>
        </div>
      </main>
    )
  }

  const participantAgents = conv.agentIds.map((id) => agents[id]).filter(Boolean)

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 -space-x-2">
            {participantAgents.map((a) => (
              <AgentInfoPopover
                key={a.id}
                agent={a}
                size="md"
                avatarClassName="border-2 border-background"
              />
            ))}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium">{conv.title}</span>
              {conv.workspaceMode === 'local' && conv.workspaceBoundPath && (
                <span
                  title={`本地工作目录：${conv.workspaceBoundPath}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <AlertTriangle className="size-2.5" />
                  本地
                </span>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {conv.mode === 'single' ? '单聊' : '群聊'} · {participantAgents.length} 位 Agent
              {conv.workspaceMode === 'local' && conv.workspaceBoundPath && (
                <>
                  {' · '}
                  <code className="font-mono">{conv.workspaceBoundPath}</code>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* 右侧面板切换（文件树 / 产物预览，互斥）。点同一个再关掉。 */}
          <Button
            size="icon"
            variant={fileExplorerOpen ? 'default' : 'ghost'}
            onClick={() => setFileExplorerOpen(!fileExplorerOpen)}
            title={fileExplorerOpen ? '关闭文件树' : '打开文件树'}
          >
            <FolderTree className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={previewArtifactId ? 'default' : 'ghost'}
            onClick={() => {
              if (previewArtifactId) closeArtifactPreview()
            }}
            disabled={!previewArtifactId}
            title={previewArtifactId ? '关闭产物预览' : '产物预览（点产物卡片打开）'}
          >
            <Layers className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setFilesOpen(true)}
            title="会话文件库"
          >
            <FolderOpen className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setAddOpen(true)}
            title="添加 Agent"
          >
            <UserPlus className="size-4" />
          </Button>
          <Badge variant={streamConnected ? 'default' : 'outline'} className="gap-1.5">
            <span
              className={`size-1.5 rounded-full ${streamConnected ? 'bg-green-500' : 'bg-zinc-400'}`}
            />
            {streamConnected ? '已连接' : '断开'}
          </Badge>
        </div>
      </header>

      {/* Tab bar：仅在有打开的文件时显示（避免单 chat tab 时浪费空间） */}
      {openFiles.length > 0 && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b bg-card/50 px-2 py-1 text-xs">
          <TabButton
            label="对话"
            active={activeTab === 'chat'}
            onClick={() => setActiveTab(conv.id, 'chat')}
          />
          {openFiles.map((p) => (
            <TabButton
              key={p}
              label={p.split('/').pop() ?? p}
              tooltip={p}
              active={activeTab === p}
              onClick={() => setActiveTab(conv.id, p)}
              onClose={() => closeFile(conv.id, p)}
            />
          ))}
        </div>
      )}

      {/* 主体：chat 或 file tab */}
      {activeTab === 'chat' || !openFiles.includes(activeTab) ? (
        <>
          <MessageList conversationId={conv.id} />
          <MessageInput conversationId={conv.id} />
        </>
      ) : (
        <FileTab conversationId={conv.id} relPath={activeTab} />
      )}

      <AddAgentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        conversationId={conv.id}
        existingAgentIds={conv.agentIds}
      />

      <FileLibraryDialog
        open={filesOpen}
        onOpenChange={setFilesOpen}
        conversationId={conv.id}
      />
    </main>
  )
}

function TabButton({
  label,
  tooltip,
  active,
  onClick,
  onClose,
}: {
  label: string
  tooltip?: string
  active: boolean
  onClick: () => void
  onClose?: () => void
}) {
  return (
    <div
      title={tooltip}
      className={cn(
        'group flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 transition',
        active
          ? 'border-primary/30 bg-background shadow-sm'
          : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <button type="button" onClick={onClick} className="max-w-[180px] truncate">
        {label}
      </button>
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="rounded p-0.5 opacity-50 transition hover:bg-accent hover:opacity-100"
          title="关闭"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}
