import { homedir, platform } from 'node:os'
import path from 'node:path'

import type { WorkspaceRow } from '@/db/schema'

/**
 * workspace 模式相关 helper：
 *  - getEffectiveCwd：决定 bash / fs 工具的 cwd（local 模式用 boundPath，sandbox 用 rootPath）
 *  - assertPathWithinWorkspace：把工具入参的路径解析到 effective cwd 子树内，越权抛错
 *  - isPathSafe：拒绝明显敏感的系统 / 用户隐私目录（创建会话时校验 boundPath；listdir API 校验导航目标）
 */

export function getEffectiveCwd(workspace: WorkspaceRow): string {
  if (workspace.mode === 'local' && workspace.boundPath) {
    return workspace.boundPath
  }
  return workspace.rootPath
}

/**
 * 把 target（可相对、可绝对）解析为绝对路径，并强制落在 workspace 的 effective cwd 子树内。
 * 越权返回 null（调用方决定怎么响应）。
 */
export function resolveSafePath(workspace: WorkspaceRow, target: string): string | null {
  const cwd = getEffectiveCwd(workspace)
  const abs = path.isAbsolute(target) ? path.resolve(target) : path.resolve(cwd, target)
  const root = path.resolve(cwd)
  if (abs === root) return abs
  if (!abs.startsWith(root + path.sep)) return null
  return abs
}

export function assertPathWithinWorkspace(workspace: WorkspaceRow, target: string): string {
  const resolved = resolveSafePath(workspace, target)
  if (!resolved) {
    throw new Error(`Path "${target}" is outside workspace`)
  }
  return resolved
}

/**
 * 拒绝几类明显敏感的目录：
 *  - 用户的 ssh / aws / gcloud 等凭证
 *  - 系统级目录（/etc, /System, /Windows, /usr, /bin, /sbin, /var, /private, /Library/Keychains 等）
 *  - 用户 home 本身（让用户至少进一层）
 *
 * 这是「软安全」—— 不阻止恶意路径（用户都能直接编辑 DB 绕过），只是把
 * 「随手填错」的坑挡掉。
 */
export function isPathSafe(absPath: string): boolean {
  const home = path.resolve(homedir())
  const normalized = path.resolve(absPath)

  // 用户 home 自身不允许（agent 可以在 home 子目录里工作）
  if (normalized === home) return false

  // 已知敏感子路径（macOS / Linux / Windows 通用拦截）
  const sensitiveSegments = [
    '.ssh',
    '.aws',
    '.gcloud',
    '.kube',
    '.gnupg',
    '.config/gh',
    'Library/Keychains',
  ]
  for (const seg of sensitiveSegments) {
    const sensitive = path.resolve(home, seg)
    if (normalized === sensitive || normalized.startsWith(sensitive + path.sep)) return false
  }

  // 系统根目录（黑名单）
  const isWin = platform() === 'win32'
  const systemRoots = isWin
    ? ['C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)']
    : ['/etc', '/System', '/usr', '/bin', '/sbin', '/var', '/private', '/Library/Keychains']
  for (const root of systemRoots) {
    const r = path.resolve(root)
    if (normalized === r || normalized.startsWith(r + path.sep)) return false
  }

  return true
}
