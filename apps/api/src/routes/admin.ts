import { Hono } from 'hono'
import { eq, and, gte, sql, desc } from 'drizzle-orm'
import { hash } from '@node-rs/argon2'
import { createId } from '@paralleldrive/cuid2'
import { isValidCunyEmail } from '@slide-maker/shared'
import type { Session, User } from 'lucia'
import { db } from '../db/index.js'
import { users, decks, deckAccess, chatMessages, tokenUsage, passwordResets } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { adminMiddleware } from '../middleware/admin.js'
import { sendAdminPasswordResetEmail } from '../email/index.js'

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

// POST /users — Create a new user (admin-created, pre-approved)
admin.post('/users', async (c) => {
  const body = await c.req.json()
  const { email, password, name, role } = body

  if (!email || !password || !name) {
    return c.json({ error: 'Email, password, and name are required' }, 400)
  }

  const trimmedName = typeof name === 'string' ? name.trim() : ''
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return c.json({ error: 'Name must be 2-100 characters' }, 400)
  }
  if (/<[^>]*>/.test(trimmedName)) {
    return c.json({ error: 'Name cannot contain HTML tags' }, 400)
  }

  if (typeof email !== 'string' || !email.includes('@')) {
    return c.json({ error: 'Invalid email address' }, 400)
  }

  if (!isValidCunyEmail(email)) {
    return c.json({ error: 'Only *.cuny.edu email addresses are allowed' }, 400)
  }

  if (typeof password !== 'string' || password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }

  // Check for existing user
  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).get()
  if (existing) {
    return c.json({ error: 'A user with this email already exists' }, 409)
  }

  const passwordHash = await hash(password)
  const userId = createId()
  const validRole = role && ['admin', 'editor', 'viewer'].includes(role) ? role : 'editor'

  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    name: trimmedName,
    passwordHash,
    emailVerified: true,
    status: 'approved',
    role: validRole,
    createdAt: new Date(),
  })

  const created = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    status: users.status,
  }).from(users).where(eq(users.id, userId)).get()

  return c.json({ user: created }, 201)
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

// POST /users/:id/reset-password — Send a password reset email to a user
admin.post('/users/:id/reset-password', async (c) => {
  const id = c.req.param('id')
  const adminUser = c.get('user')

  const user = await db.select().from(users).where(eq(users.id, id)).get()
  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  // Delete any existing reset tokens for this user
  await db.delete(passwordResets).where(eq(passwordResets.userId, user.id))

  // Create reset token (24 hour expiry for admin-initiated resets)
  const token = createId()
  await db.insert(passwordResets).values({
    id: createId(),
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })

  try {
    await sendAdminPasswordResetEmail(user.email, token, adminUser.name)
  } catch (err) {
    console.error('Failed to send admin password reset email:', err)
    return c.json({ error: 'Failed to send reset email' }, 500)
  }

  return c.json({ message: `Password reset email sent to ${user.email}` })
})

export default admin
