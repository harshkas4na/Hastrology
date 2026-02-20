import { createClient } from '@supabase/supabase-js'
import type { ReactNode } from 'react'

// Always fetch fresh data — no caching
export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────────────

type DbUser = {
  wallet_address: string
  created_at: string
  trade_made_at: string | null
  dob: string | null
  birth_time: string | null
  birth_place: string | null
  twitter_username: string | null
}

type DbHoroscope = {
  wallet_address: string
  date: string        // 'YYYY-MM-DD' stored in IST
  created_at: string  // UTC timestamp of generation
  verified: boolean
}

type Pattern = 'never' | 'once' | 'daily' | 'sporadic'

type UserAnalytics = DbUser & {
  horoscopes: DbHoroscope[]
  totalReads: number
  readDates: string[]
  pattern: Pattern
  gapDates: string[]
  hasTradeMadeAt: boolean
  hasVerifiedHoroscope: boolean
  isTrader: boolean
  verifiedCount: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtIST(ts: string): string {
  return new Date(ts).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function fmtTimeIST(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[m]}`
}

function short(w: string): string {
  return `${w.slice(0, 8)}...${w.slice(-4)}`
}

function pct(n: number, d: number): string {
  return d === 0 ? '0%' : `${Math.round((n / d) * 100)}%`
}

// Convert UTC timestamp to IST date string 'YYYY-MM-DD'
function toISTDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function analyzePattern(sortedDates: string[]): { pattern: Pattern; gaps: string[] } {
  if (sortedDates.length === 0) return { pattern: 'never', gaps: [] }
  if (sortedDates.length === 1) return { pattern: 'once', gaps: [] }

  const gaps: string[] = []
  for (let i = 1; i < sortedDates.length; i++) {
    const a = new Date(sortedDates[i - 1] + 'T00:00:00Z')
    const b = new Date(sortedDates[i] + 'T00:00:00Z')
    const diffDays = Math.round((b.getTime() - a.getTime()) / 86_400_000)
    if (diffDays > 1) {
      for (let d = 1; d < diffDays; d++) {
        const gap = new Date(a.getTime() + d * 86_400_000)
        gaps.push(gap.toISOString().split('T')[0])
      }
    }
  }
  return { pattern: gaps.length === 0 ? 'daily' : 'sporadic', gaps }
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function getAnalytics() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )

  const [{ data: rawUsers, error: uErr }, { data: rawHoroscopes, error: hErr }] =
    await Promise.all([
      supabase
        .from('users')
        .select('wallet_address, created_at, trade_made_at, dob, birth_time, birth_place, twitter_username')
        .order('created_at', { ascending: false }),
      supabase
        .from('horoscopes')
        .select('wallet_address, date, created_at, verified')
        .order('date', { ascending: true }),
    ])

  if (uErr) throw new Error(`Users fetch failed: ${uErr.message}`)
  if (hErr) throw new Error(`Horoscopes fetch failed: ${hErr.message}`)

  const users: DbUser[] = rawUsers ?? []
  const horoscopes: DbHoroscope[] = rawHoroscopes ?? []

  // Group horoscopes by wallet_address
  const byWallet = new Map<string, DbHoroscope[]>()
  for (const h of horoscopes) {
    if (!byWallet.has(h.wallet_address)) byWallet.set(h.wallet_address, [])
    byWallet.get(h.wallet_address)!.push(h)
  }

  // Build enriched analytics per user
  const userAnalytics: UserAnalytics[] = users.map(user => {
    const hs = byWallet.get(user.wallet_address) ?? []
    const readDates = [...new Set(hs.map(h => h.date))].sort()
    const { pattern, gaps } = analyzePattern(readDates)
    const verifiedCount = hs.filter(h => h.verified).length
    const hasTradeMadeAt = !!user.trade_made_at
    const hasVerifiedHoroscope = verifiedCount > 0

    return {
      ...user,
      horoscopes: hs,
      totalReads: hs.length,
      readDates,
      pattern,
      gapDates: gaps,
      hasTradeMadeAt,
      hasVerifiedHoroscope,
      isTrader: hasTradeMadeAt || hasVerifiedHoroscope,
      verifiedCount,
    }
  })

  // Summary stats
  const totalUsers        = userAnalytics.length
  const readersCount      = userAnalytics.filter(u => u.totalReads > 0).length
  const returningCount    = userAnalytics.filter(u => u.pattern === 'daily' || u.pattern === 'sporadic').length
  const dailyCount        = userAnalytics.filter(u => u.pattern === 'daily').length
  const sporadicCount     = userAnalytics.filter(u => u.pattern === 'sporadic').length
  const onceCount         = userAnalytics.filter(u => u.pattern === 'once').length
  const tradersCount      = userAnalytics.filter(u => u.isTrader).length
  const totalHoroscopes   = horoscopes.length

  // Horoscope activity by IST date: date → unique wallet count
  const horoscopesByDate = new Map<string, Set<string>>()
  for (const h of horoscopes) {
    if (!horoscopesByDate.has(h.date)) horoscopesByDate.set(h.date, new Set())
    horoscopesByDate.get(h.date)!.add(h.wallet_address)
  }
  const horoscopeDateRows = [...horoscopesByDate.entries()]
    .map(([date, wallets]) => ({ date, count: wallets.size }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Trade activity by IST date: users whose trade_made_at falls on that date
  const tradesByDate = new Map<string, number>()
  for (const u of users) {
    if (u.trade_made_at) {
      const d = toISTDate(u.trade_made_at)
      tradesByDate.set(d, (tradesByDate.get(d) ?? 0) + 1)
    }
  }
  const tradeDateRows = [...tradesByDate.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    users: userAnalytics,
    stats: {
      totalUsers, readersCount, returningCount,
      dailyCount, sporadicCount, onceCount,
      tradersCount, totalHoroscopes,
    },
    horoscopeDateRows,
    tradeDateRows,
    now: new Date().toISOString(),
  }
}

// ─── UI Components ────────────────────────────────────────────────────────────

const PATTERN_CONFIG: Record<Pattern, { label: string; icon: string; chip: string }> = {
  never:    { label: 'Never Read',      icon: '○', chip: 'bg-gray-800 text-gray-500' },
  once:     { label: 'Read Once',       icon: '◑', chip: 'bg-blue-950 text-blue-400' },
  daily:    { label: 'Daily Reader',    icon: '✦', chip: 'bg-green-950 text-green-400' },
  sporadic: { label: 'Sporadic Reader', icon: '~', chip: 'bg-yellow-950 text-yellow-400' },
}

function StatCard({
  title, value, sub, accent,
}: { title: string; value: string | number; sub: string; accent: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className={`text-xs font-semibold uppercase tracking-widest mb-2 ${accent}`}>{title}</div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
    </div>
  )
}

function LogicBlock({
  title, accent, children,
}: { title: string; accent: string; children: ReactNode }) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
      <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${accent}`}>{title}</div>
      <div className="text-gray-400 text-xs leading-relaxed space-y-1">{children}</div>
    </div>
  )
}

// Inline bar — width proportional to count vs maxCount
function Bar({ count, max, color }: { count: number; max: number; color: string }) {
  const w = max === 0 ? 0 : Math.round((count / max) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 bg-gray-800 rounded-full h-1.5 shrink-0">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-white font-semibold text-sm tabular-nums">{count}</span>
    </div>
  )
}

function UserCard({ user, idx }: { user: UserAnalytics; idx: number }) {
  const pc = PATTERN_CONFIG[user.pattern]

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">

      {/* Row 1: identity + badges */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-gray-700 text-sm font-mono w-6 shrink-0">#{idx}</span>
          <div>
            <span className="font-mono text-sm text-white" title={user.wallet_address}>
              {short(user.wallet_address)}
            </span>
            {user.twitter_username && (
              <span className="ml-2 text-xs text-sky-400">@{user.twitter_username}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${pc.chip}`}>
            {pc.icon} {pc.label}
          </span>
          {user.isTrader ? (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-950 text-amber-400">
              ⚡ Traded
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-800 text-gray-500">
              ○ Not Traded
            </span>
          )}
        </div>
      </div>

      {/* Row 2: meta info */}
      <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-xs text-gray-500 pl-9">
        <span>Joined: {fmtIST(user.created_at)} IST</span>
        {user.dob && <span>DOB: {user.dob}</span>}
        {user.birth_place && <span>From: {user.birth_place}</span>}
      </div>

      {/* Row 3: horoscope chips */}
      {user.totalReads > 0 ? (
        <div className="pl-9 space-y-2">
          <div className="text-xs text-gray-400">
            <span className="text-white font-medium">{user.totalReads}</span>
            {' '}horoscope{user.totalReads > 1 ? 's' : ''} generated
          </div>
          <div className="flex flex-wrap gap-2">
            {user.horoscopes.map((h, i) => (
              <div key={i} className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs">
                <div className="text-purple-400 font-semibold">{fmtDate(h.date)}</div>
                <div className="text-gray-500 mt-0.5">at {fmtTimeIST(h.created_at)} IST</div>
                {h.verified && (
                  <div className="text-amber-400 text-[10px] mt-0.5">✓ verified by trade</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="pl-9 text-xs text-gray-600 italic">No horoscopes generated yet</div>
      )}

      {/* Row 4: gaps (sporadic only) */}
      {user.pattern === 'sporadic' && user.gapDates.length > 0 && (
        <div className="pl-9 text-xs">
          <span className="text-yellow-600 font-medium">Missed days: </span>
          <span className="text-gray-500">{user.gapDates.map(d => fmtDate(d)).join(', ')}</span>
        </div>
      )}

      {/* Row 5: trade details */}
      {user.isTrader && (
        <div className="pl-9 text-xs text-amber-700 space-y-0.5">
          {user.hasTradeMadeAt && (
            <div>
              <span className="font-mono">trade_made_at</span>: {fmtIST(user.trade_made_at!)} IST
              <span className="text-gray-600 ml-1">(1 trade timestamp stored — multiple trades not counted separately)</span>
            </div>
          )}
          {user.hasVerifiedHoroscope && (
            <div>
              {user.verifiedCount} horoscope{user.verifiedCount > 1 ? 's' : ''} verified via trade
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const { users, stats, horoscopeDateRows, tradeDateRows, now } = await getAnalytics()

  const maxHoroCount  = Math.max(...horoscopeDateRows.map(r => r.count), 1)
  const maxTradeCount = Math.max(...tradeDateRows.map(r => r.count), 1)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">🔭 Hastrology Admin</h1>
            <p className="text-gray-600 text-xs mt-0.5">
              Fetched: {fmtIST(now)} IST &nbsp;·&nbsp; {stats.totalHoroscopes} total horoscopes in DB
            </p>
          </div>
          <a
            href="/"
            className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-gray-300 transition-colors"
          >
            ↻ Refresh
          </a>
        </div>

        {/* ── Key Numbers ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            sub="registered wallets"
            accent="text-blue-400"
          />
          <StatCard
            title="Returning Users"
            value={stats.returningCount}
            sub={`${pct(stats.returningCount, stats.totalUsers)} came back 2+ days`}
            accent="text-purple-400"
          />
          <StatCard
            title="Traders"
            value={stats.tradersCount}
            sub={`${pct(stats.tradersCount, stats.totalUsers)} have a trade record`}
            accent="text-amber-400"
          />
          <StatCard
            title="Total Horoscopes"
            value={stats.totalHoroscopes}
            sub={`across ${stats.readersCount} user${stats.readersCount !== 1 ? 's' : ''}`}
            accent="text-green-400"
          />
        </div>

        {/* ── Activity by Date ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Horoscope reads by date */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-4">
              Horoscopes by Day
            </h2>
            {horoscopeDateRows.length === 0 ? (
              <p className="text-gray-600 text-xs italic">No horoscopes yet</p>
            ) : (
              <div className="space-y-2.5">
                {horoscopeDateRows.map(({ date, count }) => (
                  <div key={date} className="flex items-center justify-between gap-3">
                    <span className="text-gray-400 text-xs font-mono w-16 shrink-0">{fmtDate(date)}</span>
                    <div className="flex-1">
                      <Bar count={count} max={maxHoroCount} color="bg-purple-500" />
                    </div>
                    <span className="text-gray-600 text-xs shrink-0">
                      {count} user{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trades by date */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1">
              Traders by Day
            </h2>
            <p className="text-[10px] text-gray-600 mb-4">
              One timestamp per user — multiple trades not counted · unverified trades invisible
            </p>
            {tradeDateRows.length === 0 ? (
              <p className="text-gray-600 text-xs italic">No trade records yet</p>
            ) : (
              <div className="space-y-2.5">
                {tradeDateRows.map(({ date, count }) => (
                  <div key={date} className="flex items-center justify-between gap-3">
                    <span className="text-gray-400 text-xs font-mono w-16 shrink-0">{fmtDate(date)}</span>
                    <div className="flex-1">
                      <Bar count={count} max={maxTradeCount} color="bg-amber-500" />
                    </div>
                    <span className="text-gray-600 text-xs shrink-0">
                      {count} user{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── Reader Breakdown ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Reader Breakdown
          </h2>
          <div className="grid grid-cols-4 gap-2 text-center">
            {(
              [
                ['✦', 'Daily',    stats.dailyCount,                         'text-green-400'],
                ['~', 'Sporadic', stats.sporadicCount,                      'text-yellow-400'],
                ['◑', 'Once',     stats.onceCount,                          'text-blue-400'],
                ['○', 'Never',    stats.totalUsers - stats.readersCount,    'text-gray-500'],
              ] as const
            ).map(([icon, label, count, color]) => (
              <div key={label} className="bg-gray-950 rounded-lg p-3">
                <div className={`text-lg ${color}`}>{icon}</div>
                <div className="text-xl font-bold text-white mt-1">{count}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
                <div className="text-[10px] text-gray-700 mt-0.5">{pct(count, stats.totalUsers)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── All Users ── */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            All Users ({stats.totalUsers}) — newest first
          </h2>
          {users.length === 0 ? (
            <div className="text-gray-600 text-sm py-8 text-center">No users found.</div>
          ) : (
            <div className="space-y-2">
              {users.map((user, i) => (
                <UserCard key={user.wallet_address} user={user} idx={i + 1} />
              ))}
            </div>
          )}
        </div>

        {/* ── How We Judge Things (at the bottom) ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            📊 How We Judge Things
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            <LogicBlock title="Horoscope Reader" accent="text-purple-400">
              <p>
                User has ≥ 1 row in the <code>horoscopes</code> table.
              </p>
              <p className="text-gray-600">
                A row is inserted only after Solana payment is confirmed and the AI generates
                the horoscope. If the user paid but generation failed, no row exists.
              </p>
            </LogicBlock>

            <LogicBlock title="Returning User" accent="text-purple-400">
              <p>
                User has horoscopes on <strong className="text-white">2 or more different IST days</strong>
                — i.e. pattern is Daily or Sporadic.
              </p>
              <p className="text-gray-600">
                &ldquo;Once&rdquo; users (exactly 1 day) and &ldquo;Never&rdquo; users are excluded.
              </p>
            </LogicBlock>

            <LogicBlock title="Daily vs Sporadic Reader" accent="text-green-400">
              <p>
                We compare consecutive pairs of <code>horoscopes.date</code> (sorted ascending).
              </p>
              <p>
                <span className="text-green-400">Daily</span> → every gap = 1 day.&nbsp;
                <span className="text-yellow-400">Sporadic</span> → any gap &gt; 1 day.&nbsp;
                Skipped dates shown on each user card.
              </p>
              <p className="text-gray-600">
                <code>horoscopes.date</code> is stored in IST, so &ldquo;one per day&rdquo;
                is Indian time.
              </p>
            </LogicBlock>

            <LogicBlock title="Trade Activity — What We Can & Can't Track" accent="text-amber-400">
              <p>
                A user is counted as a <span className="text-amber-400">Trader</span> if either:
              </p>
              <p>
                <span className="text-amber-400">Signal 1 — </span>
                <code>users.trade_made_at</code> is not null: set when a Flash trade is executed
                in our app. <strong className="text-white">Only one timestamp stored per user</strong>
                — if they trade again, the old value is overwritten. We cannot count multiple trades.
              </p>
              <p>
                <span className="text-amber-400">Signal 2 — </span>
                <code>horoscopes.verified = true</code>: set when a trade confirms a horoscope.
                This only fires for the horoscope-verification flow.
              </p>
              <p className="text-red-900 font-medium">
                Unverified trades (transaction not confirmed, DB update failed, or trade done outside
                our app entirely): <strong className="text-red-500">zero DB record</strong>. We
                cannot detect or count these at all. The traders count is a lower bound — at least
                N distinct users made at least 1 trade, but the real total could be higher.
              </p>
            </LogicBlock>

            <LogicBlock title="Horoscope Read Time" accent="text-blue-400">
              <p>
                <code>horoscopes.created_at</code> — UTC timestamp of when the horoscope was
                written to the DB (right after payment + AI generation).
              </p>
              <p className="text-gray-600">
                Displayed in IST (UTC+5:30). The actual read could be a few seconds later, but
                this is the closest proxy we have.
              </p>
            </LogicBlock>

            <LogicBlock title="Horoscopes by Day Count" accent="text-blue-400">
              <p>
                <code>horoscopes.date</code> (IST date) grouped and counted. Since the DB enforces
                UNIQUE(wallet_address, date), each cell = one distinct user who generated on that day.
              </p>
              <p className="text-gray-600">
                The bar chart max is relative to the busiest day.
              </p>
            </LogicBlock>

          </div>
        </div>

      </div>
    </div>
  )
}
