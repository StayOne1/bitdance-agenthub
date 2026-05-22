import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

import * as schema from './schema'

const DATA_DIR = path.resolve(process.cwd(), '.agenthub-data')
const DB_PATH = path.join(DATA_DIR, 'agenthub.db')

mkdirSync(DATA_DIR, { recursive: true })
mkdirSync(path.join(DATA_DIR, 'workspaces'), { recursive: true })

// 跨 Next.js HMR 保活单例（dev 模式下避免每次保存代码都新建 connection）
const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database
}

const sqlite =
  globalForDb.sqlite ??
  new Database(DB_PATH, {
    // 启用 WAL 模式，并发读写性能更好
    fileMustExist: false,
  })

if (!globalForDb.sqlite) {
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  globalForDb.sqlite = sqlite
}

export const db = drizzle(sqlite, { schema })
export { schema }
