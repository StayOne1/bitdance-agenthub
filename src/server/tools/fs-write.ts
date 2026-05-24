import { z } from 'zod'

import { getWorkspaceForConversation, writeFileInWorkspace } from '@/server/fs-service'

import type { ToolDef } from './types'

const ArgsSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
})

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

    const workspace = await getWorkspaceForConversation(ctx.conversationId)
    if (!workspace) return { ok: false, error: 'Workspace not found' }

    try {
      const result = writeFileInWorkspace(workspace, parsed.data.path, parsed.data.content)
      return { ok: true, value: result }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  },
}
