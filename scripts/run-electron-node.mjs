// 跨平台用 Electron 内嵌 Node（ABI 与 packaged app 一致）跑 npm CLI 入口。
//
// 用法：node scripts/run-electron-node.mjs <script-path> [args...]
//
// 为什么：better-sqlite3 .node 文件绑定特定 ABI。Electron 33 用 ABI 130（私有），
// 系统 Node 24 用 ABI 137。让所有 dev/build/db script 都通过这个 wrapper 跑，
// 整个工具链共享 Electron ABI 130，pnpm install 之后只需 `pnpm electron:rebuild` 一次
// 把 .node 钉到 ABI 130，从此 dev 永远不会因 ABI 不匹配崩。
//
// 详见 Spec 12 §6。

import { spawn } from 'node:child_process'

const [, , scriptPath, ...args] = process.argv

if (!scriptPath) {
  console.error('Usage: node run-electron-node.mjs <script-path> [args...]')
  process.exit(1)
}

const child = spawn('electron', [scriptPath, ...args], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  shell: process.platform === 'win32',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(0)
  } else {
    process.exit(code ?? 0)
  }
})
