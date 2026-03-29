import { Hono } from 'hono'
import { eq, and, gte, sql, desc } from 'drizzle-orm'
import type { Session, User } from 'lucia'
import { db } from '../db/index.js'
import { users, decks, deckAccess, chatMessages, tokenUsage } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { adminMiddleware } from '../middleware/admin.js'

type AdminEnv = {
  Variables: {
    user: User
    session: Session
  }
}

const admin = new Hono<AdminEnv>()

// All admin routes require auth + admin
admin.use('*', authMiddleware, adminMiddleware)

// GET /users — Legacy: list users with optional status filter
admin.get('/users', async (c) => {
  const status = c.req.query('status')

  let query = db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    status: users.status,
    emailVerified: users.emailVerified,
    createdAt: users.createdAt,
  }).from(users)

  if (status) {
    const result = await query.where(eq(users.status, status as 'pending' | 'approved' | 'rejected'))
    return c.json({ users: result })
  }

  const result = await query
  return c.json({ users: result })
})

// GET /users/all — List ALL users with enriched details
admin.get('/users/all', async (c) => {
  const yearStart = new Date(new Date().getFullYear(), 0, 1)

  // Get all users
  const allUsers = await db.select().from(users)

  // Get deck counts per user
  const deckCounts = await db.select({
    userId: decks.createdBy,
    count: sql<number>`COUNT(*)`,
  }).from(decks).groupBy(decks.createdBy)

  const deckCountMap = new Map(deckCounts.map((d) => [d.userId, d.count]))

  // Get token usage per user this year
  const tokenTotals = await db.select({
    userId: tokenUsage.userId,
    total: sql<number>`SUM(input_tokens + output_tokens)`,
  }).from(tokenUsage)
    .where(gte(tokenUsage.createdAt, yearStart))
    .groupBy(tokenUsage.userId)

  const tokenMap = new Map(tokenTotals.map((t) => [t.userId, t.total]))

  // Get last active (latest chat message) per user via deck ownership
  const lastActiveRows = await db.select({
    userId: decks.createdBy,
    lastActive: sql<number>`MAX(${chatMessages.createdAt})`,
  }).from(chatMessages)
    .innerJoin(decks, eq(chatMessages.deckId, decks.id))
    .groupBy(decks.createdBy)

  const lastActiveMap = new Map(lastActiveRows.map((r) => [r.userId, r.lastActive]))

  const enrichedUsers = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
    tokenCap: u.tokenCap,
    deckCount: deckCountMap.get(u.id) ?? 0,
    tokensUsed: tokenMap.get(u.id) ?? 0,
    lastActive: lastActiveMap.get(u.id) ?? null,
  }))

  // Summary stats
  const totalDecks = deckCounts.reduce((sum, d) => sum + d.count, 0)
  const totalTokens = tokenTotals.reduce((sum, t) => sum + t.total, 0)
  const pendingCount = allUsers.filter((u) => u.status === 'pending').length

  return c.json({
    users: enrichedUsers,
    stats: {
      totalUsers: allUsers.length,
      pendingApproval: pendingCount,
      totalDecks,
      totalTokens,
    },
  })
})

// PATCH /users/:id — Update user details
admin.patch('/users/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const user = await db.select().from(users).where(eq(users.id, id)).get()
  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  const updates: Record<string, unknown> = {}

  if (body.role && ['admin', 'editor', 'viewer'].includes(body.role)) {
    updates.role = body.role
  }

  if (body.status && ['approved', 'rejected', 'pending'].includes(body.status)) {
    updates.status = body.status
  }

  if (body.tokenCap !== undefined && typeof body.tokenCap === 'number' && body.tokenCap >= 0) {
    updates.tokenCap = body.tokenCap
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400)
  }

  await db.update(users).set(updates).where(eq(users.id, id))

  const updated = await db.select().from(users).where(eq(users.id, id)).get()
  return c.json({ user: updated })
})

// GET /users/:id/usage — Detailed token usage for a user
admin.get('/users/:id/usage', async (c) => {
  const id = c.req.param('id')
  const yearStart = new Date(new Date().getFullYear(), 0, 1)

  const user = await db.select().from(users).where(eq(users.id, id)).get()
  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  // Total this year
  const totalRow = await db.select({
    total: sql<number>`SUM(input_tokens + output_tokens)`,
    inputTotal: sql<number>`SUM(input_tokens)`,
    outputTotal: sql<number>`SUM(output_tokens)`,
  }).from(tokenUsage)
    .where(and(eq(tokenUsage.userId, id), gte(tokenUsage.createdAt, yearStart)))
    .get()

  // Monthly breakdown
  const monthly = await db.select({
    month: sql<number>`CAST(strftime('%m', ${tokenUsage.createdAt} / 1000, 'unixepoch') AS INTEGER)`,
    total: sql<number>`SUM(input_tokens + output_tokens)`,
  }).from(tokenUsage)
    .where(and(eq(tokenUsage.userId, id), gte(tokenUsage.createdAt, yearStart)))
    .groupBy(sql`strftime('%m', ${tokenUsage.createdAt} / 1000, 'unixepoch')`)
    .orderBy(sql`strftime('%m', ${tokenUsage.createdAt} / 1000, 'unixepoch')`)

  // Model breakdown
  const byModel = await db.select({
    provider: tokenUsage.provider,
    model: tokenUsage.model,
    total: sql<number>`SUM(input_tokens + output_tokens)`,
  }).from(tokenUsage)
    .where(and(eq(tokenUsage.userId, id), gte(tokenUsage.createdAt, yearStart)))
    .groupBy(tokenUsage.provider, tokenUsage.model)
    .orderBy(desc(sql`SUM(input_tokens + output_tokens)`))

  const totalUsed = totalRow?.total ?? 0
  const cap = user.tokenCap ?? 1000000

  return c.json({
    userId: id,
    userName: user.name,
    tokenCap: cap,
    totalUsed,
    remaining: Math.max(0, cap - totalUsed),
    inputTotal: totalRow?.inputTotal ?? 0,
    outputTotal: totalRow?.outputTotal ?? 0,
    monthly,
    byModel,
  })
})

// POST /users/:id/approve (legacy)
admin.post('/users/:id/approve', async (c) => {
  const id = c.req.param('id')
  const user = await db.select().from(users).where(eq(users.id, id)).get()

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  await db.update(users).set({ status: 'approved' }).where(eq(users.id, id))
  return c.json({ message: 'User approved', userId: id })
})

// POST /users/:id/reject (legacy)
admin.post('/users/:id/reject', async (c) => {
  const id = c.req.param('id')
  const user = await db.select().from(users).where(eq(users.id, id)).get()

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  await db.update(users).set({ status: 'rejected' }).where(eq(users.id, id))
  return c.json({ message: 'User rejected', userId: id })
})

export default admin
