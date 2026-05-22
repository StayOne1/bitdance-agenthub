import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight">AgentHub</h1>
            <Badge variant="secondary">v0.1.0</Badge>
          </div>
          <p className="text-lg text-muted-foreground">多 Agent 协作平台 · IM 范式</p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            脚手架就绪
          </h2>
          <ul className="space-y-1 text-sm">
            <li>✓ Next.js 16 + React 19 + TypeScript</li>
            <li>✓ Tailwind v4 + shadcn/ui</li>
            <li>✓ SQLite + Drizzle ORM (6 tables initialized)</li>
            <li>✓ Zustand + Immer · zod · nanoid</li>
            <li>✓ Anthropic SDK · OpenAI SDK · Claude Agent SDK</li>
          </ul>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            下一步
          </h2>
          <p className="text-sm text-muted-foreground">
            按 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">specs/</code> 实现 IM 主界面、Adapter 层与 Orchestrator。
          </p>
        </div>

        <div className="flex gap-3">
          <Button>开始对话</Button>
          <Button variant="outline">查看 Specs</Button>
        </div>
      </div>
    </div>
  )
}
