import { readFileSync, statSync } from 'node:fs'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db, schema } from '@/db/client'
import { assertPathWithinWorkspace, getEffectiveCwd } from '@/server/workspace-utils'

import type { ToolDef } from './types'

const ArgsSchema = z.object({
  path: z.string().min(1),
})

const MAX_FILE_BYTES = 1_048_576 // 1 MB
const MAX_TEXT_CHARS = 50_000

/**
 * fs_read —— 读 workspace 内的文本文件。
 *
 * 路径可以是相对（基于 workspace effective cwd）或绝对，但 resolve 后必须落在
 * effective cwd 子树内，否则拒绝。
 */
export const fsReadTool: ToolDef = {
  name: 'fs_read',
  description:
    'Read a text file from the workspace. Path can be relative (to the workspace root) or absolute (must still resolve inside the workspace). Returns UTF-8 contents truncated to 50,000 characters. Use this to inspect source code, configs, etc.',
  parameters: {
    type: 'object',
    required: ['path'],
    properties: {
      path: {
        type: 'string',
        description: 'File path. Relative paths resolve from the workspace root.',
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

    let absPath: string
    try {
      absPath = assertPathWithinWorkspace(workspace, parsed.data.path)
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }

    try {
      const stat = statSync(absPath)
      if (!stat.isFile()) return { ok: false, error: `Not a file: ${parsed.data.path}` }
      if (stat.size > MAX_FILE_BYTES) {
        return {
          ok: false,
          error: `File too large (${(stat.size / 1024 / 1024).toFixed(2)} MB > 1 MB limit)`,
        }
      }

      const raw = readFileSync(absPath, 'utf8')
      const truncated = raw.length > MAX_TEXT_CHARS
      const content = truncated
        ? raw.slice(0, MAX_TEXT_CHARS) + `\n\n[TRUNCATED at ${MAX_TEXT_CHARS} chars]`
        : raw

      return {
        ok: true,
        value: {
          path: parsed.data.path,
          absolutePath: absPath,
          cwd: getEffectiveCwd(workspace),
          size: stat.size,
          content,
          truncated,
        },
      }
    } catch (err) {
      return {
        ok: false,
        error: `Failed to read: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
}
