import { readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { NextRequest, NextResponse } from 'next/server'

import { isPathSafe } from '@/server/workspace-utils'

/**
 * GET /api/fs/listdir?path=<absPath>
 *
 * 列出指定目录下的**子目录**（用于 DirPickerDialog）。
 * - path 不传：默认 homedir()
 * - 必须是绝对路径 + 是目录 + 通过 isPathSafe
 * - 隐藏 dotfile（不在 DirPicker 里展示，避免噪音）
 * - 返回 parent 用于「上一级」导航；根目录时 parent 为 null
 */
export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get('path')
  const target = requested?.trim() || homedir()

  if (!path.isAbsolute(target)) {
    return NextResponse.json({ error: 'path must be absolute' }, { status: 400 })
  }

  const resolved = path.resolve(target)

  // 允许浏览 home 自身（用作起点）但仍走 isPathSafe 拦截已知敏感子路径
  if (resolved !== path.resolve(homedir()) && !isPathSafe(resolved)) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 403 })
  }

  let stat
  try {
    stat = statSync(resolved)
  } catch {
    return NextResponse.json({ error: 'Path does not exist' }, { status: 404 })
  }
  if (!stat.isDirectory()) {
    return NextResponse.json({ error: 'Not a directory' }, { status: 400 })
  }

  let raw
  try {
    raw = readdirSync(resolved, { withFileTypes: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Cannot read directory: ${msg}` }, { status: 403 })
  }

  const entries = raw
    .filter((e) => !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
    .filter((e) => e.isDirectory) // 只暴露目录
    .sort((a, b) => a.name.localeCompare(b.name))

  const parent = (() => {
    const p = path.dirname(resolved)
    return p === resolved ? null : p
  })()

  return NextResponse.json({
    path: resolved,
    parent,
    entries,
  })
}
