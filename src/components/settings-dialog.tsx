'use client'

import { Eye, EyeOff, Loader2, Settings as SettingsIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { AppSettingsRow } from '@/db/schema'
import { fetchAppSettings, updateAppSettings, type AppSettingsPatchBody } from '@/lib/api'

interface SettingsForm {
  anthropicApiKey: string
  anthropicBaseUrl: string
  openaiApiKey: string
  deepseekApiKey: string
  arkApiKey: string
}

/**
 * 全局 API key / endpoint 设置面板。
 *
 * 4 个 provider key + Anthropic 自定义 base URL。明文展示，因为本地单用户场景安全
 * 收益小且会引入 keychain / safeStorage 复杂度（详见 spec / CLAUDE.md §5.4）。
 *
 * 优先级（adapter 侧）：agent.apiKey > app_settings > process.env。
 */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<SettingsForm>({
    anthropicApiKey: '',
    anthropicBaseUrl: '',
    openaiApiKey: '',
    deepseekApiKey: '',
    arkApiKey: '',
  })
  const [reveal, setReveal] = useState<Record<keyof SettingsForm, boolean>>({
    anthropicApiKey: false,
    anthropicBaseUrl: false,
    openaiApiKey: false,
    deepseekApiKey: false,
    arkApiKey: false,
  })

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetchAppSettings()
      .then((s) => setForm(rowToForm(s)))
      .catch((err) => console.error('[SettingsDialog] load failed', err))
      .finally(() => setLoading(false))
  }, [open])

  const handleSave = async () => {
    if (busy) return
    setBusy(true)
    try {
      // 空串归一 null，明确「清空」语义
      const patch: AppSettingsPatchBody = {
        anthropicApiKey: form.anthropicApiKey.trim() || null,
        anthropicBaseUrl: form.anthropicBaseUrl.trim() || null,
        openaiApiKey: form.openaiApiKey.trim() || null,
        deepseekApiKey: form.deepseekApiKey.trim() || null,
        arkApiKey: form.arkApiKey.trim() || null,
      }
      await updateAppSettings(patch)
      onOpenChange(false)
    } catch (err) {
      console.error('[SettingsDialog] save failed', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>API 设置</DialogTitle>
          <DialogDescription>
            填写常用 provider 的 API key。填写后将覆盖系统环境变量；留空则继续使用 env var（如有）。
            Agent 单独配置的 key 仍然优先级最高。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <KeyField
              label="Anthropic API Key"
              hint="用于 Claude Code adapter / custom anthropic provider。"
              value={form.anthropicApiKey}
              reveal={reveal.anthropicApiKey}
              onChange={(v) => setForm((f) => ({ ...f, anthropicApiKey: v }))}
              onToggleReveal={() => setReveal((r) => ({ ...r, anthropicApiKey: !r.anthropicApiKey }))}
            />
            <KeyField
              label="Anthropic Base URL（可选）"
              hint="走第三方网关时填，如 https://anyrouter.top；留空走官方 endpoint。"
              type="text"
              value={form.anthropicBaseUrl}
              reveal
              onChange={(v) => setForm((f) => ({ ...f, anthropicBaseUrl: v }))}
            />
            <KeyField
              label="OpenAI API Key"
              value={form.openaiApiKey}
              reveal={reveal.openaiApiKey}
              onChange={(v) => setForm((f) => ({ ...f, openaiApiKey: v }))}
              onToggleReveal={() => setReveal((r) => ({ ...r, openaiApiKey: !r.openaiApiKey }))}
            />
            <KeyField
              label="DeepSeek API Key"
              value={form.deepseekApiKey}
              reveal={reveal.deepseekApiKey}
              onChange={(v) => setForm((f) => ({ ...f, deepseekApiKey: v }))}
              onToggleReveal={() => setReveal((r) => ({ ...r, deepseekApiKey: !r.deepseekApiKey }))}
            />
            <KeyField
              label="Volcano Ark API Key"
              value={form.arkApiKey}
              reveal={reveal.arkApiKey}
              onChange={(v) => setForm((f) => ({ ...f, arkApiKey: v }))}
              onToggleReveal={() => setReveal((r) => ({ ...r, arkApiKey: !r.arkApiKey }))}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button onClick={() => void handleSave()} disabled={busy || loading}>
            {busy ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KeyField({
  label,
  hint,
  value,
  reveal,
  type = 'password',
  onChange,
  onToggleReveal,
}: {
  label: string
  hint?: string
  value: string
  reveal: boolean
  type?: 'password' | 'text'
  onChange: (v: string) => void
  onToggleReveal?: () => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium">{label}</label>
      <div className="relative">
        <Input
          type={type === 'text' || reveal ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className={onToggleReveal ? 'pr-9 font-mono text-xs' : 'font-mono text-xs'}
        />
        {onToggleReveal && (
          <button
            type="button"
            onClick={onToggleReveal}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            title={reveal ? '隐藏' : '显示'}
          >
            {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        )}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/80">{hint}</p>}
    </div>
  )
}

/** 设置 button 入口，挂在 Sidebar header。 */
export function SettingsButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setOpen(true)}
        title="API 设置"
        aria-label="API 设置"
      >
        <SettingsIcon className="size-4" />
      </Button>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

function rowToForm(row: AppSettingsRow): SettingsForm {
  return {
    anthropicApiKey: row.anthropicApiKey ?? '',
    anthropicBaseUrl: row.anthropicBaseUrl ?? '',
    openaiApiKey: row.openaiApiKey ?? '',
    deepseekApiKey: row.deepseekApiKey ?? '',
    arkApiKey: row.arkApiKey ?? '',
  }
}
