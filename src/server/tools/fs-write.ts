import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db, schema } from '@/db/client'
import { assertPathWithinWorkspace, getEffectiveCwd } from '@/server/workspace-utils'

import type { ToolDef } from './types'

const ArgsSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
})

const MAX_WRITE_BYTES = 100 * 1024 // 100 KB / 文件
const SANDBOX_TOTAL_BYTES = 100 * 1024 * 1024 // 100 MB
const SANDBOX_TOTAL_FILES = 1000

/**
 * fs_write —— 在 workspace 内写文件。
 *
 * 路径走 assertPathWithinWorkspace 沙箱；父目录自动 mkdir -p；
 * 单文件大小 100 KB 上限；sandbox 模式额外检查 workspace 总量配额，
 * local 模式不限（用户管理自己的目录）。
 */
export const fsWriteTool: ToolDef = {
  name: 'fs_write',
  description:
    "Write a UTF-8 text file inside the workspace. Path can be relative (resolved against the workspace root) or absolute (must still be inside the workspace). Parent directories are created automatically. Each file is capped at 100 KB; in sandbox mode the workspace as a whole is capped at 100 MB / 1000 files. Use this to scaffold code, write documents, etc.",
  parameters: {
    type: 'object',
    required: ['path', 'content'],
    properties: {
      path: {
        type: 'string',
        description: 'Destination path inside the workspace.',
      },
      content: {
        type: 'string',
        description: 'UTF-8 text content (max 100 KB).',
      },
    },
  },
  async handler(args, ctx) {
    const parsed = ArgsSchema.safeParse(args)
    if (!parsed.success) {
      return { ok: false, error: `Invalid args: ${parsed.error.message}` }
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(schema.workspaces.conversationId, ctx.conversationId),
    })
    if (!workspace) return { ok: false, error: 'Workspace not found' }

    const bytes = Buffer.byteLength(parsed.data.content, 'utf8')
    if (bytes > MAX_WRITE_BYTES) {
      return {
        ok: false,
        error: `Content too large (${(bytes / 1024).toFixed(1)} KB > 100 KB limit)`,
      }
    }

    let absPath: string
    try {
      absPath = assertPathWithinWorkspace(workspace, parsed.data.path)
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }

    // sandbox 模式额外检查总量配额
    if (workspace.mode === 'sandbox') {
      const usage = scanWorkspaceUsage(workspace.rootPath)
      if (usage.bytes + bytes > SANDBOX_TOTAL_BYTES) {
        return {
          ok: false,
          error: `Workspace quota exceeded (${(usage.bytes / 1024 / 1024).toFixed(1)} MB used + ${(bytes / 1024).toFixed(1)} KB > 100 MB cap)`,
        }
      }
      if (usage.files + 1 > SANDBOX_TOTAL_FILES) {
        return {
          ok: false,
          error: `Workspace file count exceeded (${usage.files} + 1 > 1000 cap)`,
        }
      }
    }

    try {
      mkdirSync(path.dirname(absPath), { recursive: true })
      writeFileSync(absPath, parsed.data.content, 'utf8')
      return {
        ok: true,
        value: {
          path: parsed.data.path,
          absolutePath: absPath,
          cwd: getEffectiveCwd(workspace),
          bytes,
        },
      }
    } catch (err) {
      return {
        ok: false,
        error: `Failed to write: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
}

function scanWorkspaceUsage(rootPath: string): { bytes: number; files: number } {
  let bytes = 0
  let files = 0
  if (!existsSync(rootPath)) return { bytes, files }
  const stack: string[] = [rootPath]
  while (stack.length > 0) {
    const dir = stack.pop()!
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        stack.push(full)
      } else if (e.isFile()) {
        try {
          bytes += statSync(full).size
          files++
        } catch {
          // ignore
        }
      }
    }
  }
  return { bytes, files }
}
