import type Database from 'better-sqlite3'

import { db as defaultDb } from '@/db/client'

import type { SearchHit } from '@/shared/types'

export interface SearchOptions {
  query: string
  limit?: number
  offset?: number
  conversationId?: string
  role?: 'user' | 'agent'
  fallback?: 'like'
  /** Injected for testing. */
  db?: Database.Database
}

export interface SearchResult {
  hits: SearchHit[]
  total: number
  tookMs: number
  error?: 'INVALID_QUERY'
}

/**
 * Wrap an FTS5 search term in double quotes to force phrase matching.
 *
 * Why: FTS5 interprets a hyphen as a column-restricted query separator
 * (e.g. 'render-pipeline' becomes "no such column: pipeline"). Quoting
 * makes FTS5 treat the whole string as a literal phrase.
 *
 * Conditions for quoting:
 * - Must contain a hyphen (the problem we're solving)
 * - Must NOT end with * (prefix search — quoting breaks it)
 * - Must NOT contain ( (FTS5 syntax — quoting hides the error we need to catch)
 *
 * All other queries pass through unquoted so FTS5 can error on them.
 */
function maybeQuote(s: string): string {
  if (s.endsWith('*')) return s
  if (s.includes('(')) return s
  if (s.includes('-')) return `"${s.replace(/"/g, '""')}"`
  return s
}

function rowToHit(row: {
  messageId: string
  conversationId: string
  conversationTitle: string
  role: 'user' | 'agent' | 'system'
  agentId: string | null
  agentName: string | null
  agentAvatar: string | null
  createdAt: number
  snippetHtml: string
}): SearchHit {
  return { ...row }
}

export async function searchMessages(opts: SearchOptions): Promise<SearchResult> {
  const start = Date.now()
  const trimmed = opts.query.trim()
  if (!trimmed) {
    return { hits: [], total: 0, tookMs: 0 }
  }

  const target = (opts.db ?? (defaultDb as unknown as Database.Database))
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100)
  const offset = Math.max(opts.offset ?? 0, 0)

  const ftsQuery = maybeQuote(trimmed)
  const params: unknown[] = [
    ftsQuery,
    opts.conversationId ?? null,
    opts.conversationId ?? null,
    opts.role ?? null,
    opts.role ?? null,
    limit,
    offset,
  ]

  const stmt = target.prepare(`
    SELECT
      m.id AS messageId,
      m.conversation_id AS conversationId,
      m.role AS role,
      m.agent_id AS agentId,
      m.created_at AS createdAt,
      snippet(messages_fts, 0, '<mark>', '</mark>', '…', 12) AS snippetHtml,
      c.title AS conversationTitle,
      a.name AS agentName,
      a.avatar AS agentAvatar
    FROM messages_fts
    JOIN messages m      ON m.rowid = messages_fts.rowid
    JOIN conversations c ON c.id = m.conversation_id
    LEFT JOIN agents a   ON a.id = m.agent_id
    WHERE messages_fts MATCH ?
      AND (? IS NULL OR m.conversation_id = ?)
      AND (? IS NULL OR m.role = ?)
    ORDER BY bm25(messages_fts)
    LIMIT ? OFFSET ?
  `)

  let rows: ReturnType<typeof stmt.all>
  try {
    rows = stmt.all(...params) as any
  } catch (err) {
    // FTS5 syntax errors come as SqliteError with message starting with "fts5:"
    if (err instanceof Error && /fts5/.test(err.message)) {
      return { hits: [], total: 0, tookMs: 0, error: 'INVALID_QUERY' }
    }
    throw err
  }

  // total = count of all matching rows (without limit/offset); only run
  // a separate count if the page was actually filled (i.e. more might exist).
  let total = rows.length
  if (rows.length === limit) {
    const countRow = target.prepare(`
      SELECT COUNT(*) AS n FROM messages_fts
      JOIN messages m ON m.rowid = messages_fts.rowid
      WHERE messages_fts MATCH ?
        AND (? IS NULL OR m.conversation_id = ?)
        AND (? IS NULL OR m.role = ?)
    `).get(
      ftsQuery,
      opts.conversationId ?? null, opts.conversationId ?? null,
      opts.role ?? null, opts.role ?? null,
    ) as { n: number }
    total = countRow.n
  }

  return {
    hits: (rows as any[]).map(rowToHit),
    total,
    tookMs: Date.now() - start,
  }
}

export async function countSearchMatches(query: string): Promise<number> {
  const r = await searchMessages({ query })
  return r.total
}