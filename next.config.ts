import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Electron 打包用：生成 .next/standalone 自包含 server（详见 Spec 12 §2 / §6）
  output: 'standalone',

  // 不让 webpack bundle 这两个 native / SDK 依赖；运行时走 require，保留 native binding 与子进程能力
  serverExternalPackages: ['better-sqlite3', '@anthropic-ai/claude-agent-sdk'],
}

export default nextConfig
