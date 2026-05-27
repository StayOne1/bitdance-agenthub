// 把 next build 输出里的静态资源 / public 拷进 .next/standalone 子树；
// 清理 pnpm 在 .next/standalone/node_modules/.pnpm/node_modules/ 留下的 dangling symlinks。
// better-sqlite3 的 ABI 修正不在这里做（见 scripts/electron-after-pack.mjs：electron-builder
// 打完包后再覆盖 standalone 副本，因为只有那个时点顶层 better-sqlite3 已被 rebuild 到 Electron ABI）。
// 详见 Spec 12 §6 / §7。

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const standaloneDir = path.join(root, '.next', 'standalone')

if (!fs.existsSync(standaloneDir)) {
  console.error('✗ No .next/standalone — 先跑 `next build`')
  process.exit(1)
}

function copyIfExists(src, dest, label) {
  if (!fs.existsSync(src)) return
  fs.cpSync(src, dest, { recursive: true, force: true })
  console.log(`✓ ${label}`)
}

// .next/static → .next/standalone/.next/static（前端 chunks / 图标走这个）
copyIfExists(
  path.join(root, '.next', 'static'),
  path.join(standaloneDir, '.next', 'static'),
  'copied .next/static → standalone/.next/',
)

// public → .next/standalone/public（favicon / 静态图等）
copyIfExists(
  path.join(root, 'public'),
  path.join(standaloneDir, 'public'),
  'copied public → standalone/',
)

// 清理 broken symlinks。Next standalone 的 file tracer 只拷贝实际被 require 的包，
// 但 pnpm 的 .pnpm/node_modules/<pkg> hoist 入口可能指向未被拷贝的旧版本（典型：
// .pnpm/node_modules/semver -> ../semver@6.3.1/...，而 standalone 只带了 semver@7.8.1）。
// 这些链接运行时无害（没代码 require 缺失版本），但 electron-builder 打包阶段 stat 会 ENOENT。
const broken = []
function scan(dir) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const p = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) {
      try {
        fs.statSync(p)
      } catch {
        broken.push(p)
      }
    } else if (entry.isDirectory()) {
      scan(p)
    }
  }
}
scan(standaloneDir)
for (const link of broken) {
  try {
    fs.unlinkSync(link)
  } catch {
    // ignore；下一个步骤可能会再处理
  }
}
console.log(`✓ removed ${broken.length} broken symlink(s)`)



