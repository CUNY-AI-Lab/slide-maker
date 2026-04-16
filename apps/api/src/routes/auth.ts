import { Hono } from 'hono'
import { hash, verify } from '@node-rs/argon2'
import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'
import { isValidCunyEmail } from '@slide-maker/shared'
import type { Session, User } from 'lucia'
import { db } from '../db/index.js'
import { users, emailVerifications, passwordResets } from '../db/schema.js'
import { lucia } from '../auth/lucia.js'
import { authMiddleware } from '../middleware/auth.js'
import { loginRateLimit, registerRateLimit, passwordChangeRateLimit, forgotPasswordRateLimit } from '../middleware/rate-limit.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../email/index.js'

type AuthEnv = {
  Variables: {
    user: User
    session: Session
  }
}

const auth = new Hono<AuthEnv>()

// POST /register
auth.post('/register', registerRateLimit, async (c) => {
  const body = await c.req.json()
  const { email, password, name } = body

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

  if (!isValidCunyEmail(email)) {
    return c.json({ error: 'A valid CUNY email address is required' }, 400)
  }

  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }

  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).get()
  if (existing) {
    return c.json({ error: 'An account with this email already exists' }, 400)
  }

  const passwordHash = await hash(password)
  const userId = createId()
  const now = new Date()

  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    name: trimmedName,
    passwordHash,
    emailVerified: false,
    status: 'pending',
    role: 'editor',
    createdAt: now,
  })

  // Create verification token
  const token = createId()
  await db.insert(emailVerifications).values({
    id: createId(),
    userId,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  })

  // Send verification email (don't fail registration if email fails)
  try {
    await sendVerificationEmail(email.toLowerCase(), token)
  } catch (err) {
    console.error('Failed to send verification email:', err)
  }

  return c.json({ message: 'Registration successful. Please check your email to verify your account.' }, 201)
})

// GET /verify
auth.get('/verify', async (c) => {
  const token = c.req.query('token')
  if (!token) {
    return c.json({ error: 'Verification token is required' }, 400)
  }

  const verification = await db.select().from(emailVerifications).where(eq(emailVerifications.token, token)).get()
  if (!verification) {
    return c.json({ error: 'Invalid or expired verification token' }, 400)
  }

  if (verification.expiresAt < new Date()) {
    await db.delete(emailVerifications).where(eq(emailVerifications.id, verification.id))
    return c.json({ error: 'Verification token has expired' }, 400)
  }

  await db.update(users).set({ emailVerified: true }).where(eq(users.id, verification.userId))
  await db.delete(emailVerifications).where(eq(emailVerifications.id, verification.id))

  return c.json({ message: 'Email verified successfully. Please wait for admin approval.' })
})

// POST /login
auth.post('/login', loginRateLimit, async (c) => {
  const body = await c.req.json()
  const { email, password } = body

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400)
  }

  const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).get()
  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 400)
  }

  const validPassword = await verify(user.passwordHash, password)
  if (!validPassword) {
    return c.json({ error: 'Invalid email or password' }, 400)
  }

  if (!user.emailVerified) {
    return c.json({ error: 'Please verify your email before logging in' }, 403)
  }

  if (user.status !== 'approved') {
    return c.json({ error: 'Your account is pending admin approval' }, 403)
  }

  const session = await lucia.createSession(user.id, {})
  const sessionCookie = lucia.createSessionCookie(session.id)
  c.header('Set-Cookie', sessionCookie.serialize())

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    },
  })
})

// POST /logout
auth.post('/logout', authMiddleware, async (c) => {
  const session = c.get('session')
  await lucia.invalidateSession(session.id)
  const blankCookie = lucia.createBlankSessionCookie()
  c.header('Set-Cookie', blankCookie.serialize())
  return c.json({ message: 'Logged out successfully' })
})

// GET /me
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    },
  })
})

// POST /change-password
auth.post('/change-password', authMiddleware, passwordChangeRateLimit, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) {
    return c.json({ error: 'Current password and new password are required' }, 400)
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return c.json({ error: 'New password must be at least 8 characters' }, 400)
  }

  const dbUser = await db.select().from(users).where(eq(users.id, user.id)).get()
  if (!dbUser) {
    return c.json({ error: 'User not found' }, 404)
  }

  const valid = await verify(dbUser.passwordHash, currentPassword)
  if (!valid) {
    return c.json({ error: 'Current password is incorrect' }, 403)
  }

  const newHash = await hash(newPassword)
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id))

  return c.json({ message: 'Password changed successfully' })
})

// POST /forgot-password
auth.post('/forgot-password', forgotPasswordRateLimit, async (c) => {
  const body = await c.req.json()
  const { email } = body

  if (!email) {
    return c.json({ error: 'Email is required' }, 400)
  }

  // Always return success to prevent email enumeration
  const successMsg = { message: 'If an account with that email exists, a password reset link has been sent.' }

  const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).get()
  if (!user) {
    return c.json(successMsg)
  }

  // Delete any existing reset tokens for this user
  await db.delete(passwordResets).where(eq(passwordResets.userId, user.id))

  // Create reset token (1 hour expiry)
  const token = createId()
  await db.insert(passwordResets).values({
    id: createId(),
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  })

  try {
    await sendPasswordResetEmail(email.toLowerCase(), token)
  } catch (err) {
    console.error('Failed to send password reset email:', err)
  }

  return c.json(successMsg)
})

// POST /reset-password
auth.post('/reset-password', async (c) => {
  const body = await c.req.json()
  const { token, password } = body

  if (!token || !password) {
    return c.json({ error: 'Token and new password are required' }, 400)
  }

  if (typeof password !== 'string' || password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }

  const reset = await db.select().from(passwordResets).where(eq(passwordResets.token, token)).get()
  if (!reset) {
    return c.json({ error: 'Invalid or expired reset link' }, 400)
  }

  if (reset.expiresAt < new Date()) {
    await db.delete(passwordResets).where(eq(passwordResets.id, reset.id))
    return c.json({ error: 'This reset link has expired. Please request a new one.' }, 400)
  }

  const newHash = await hash(password)
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, reset.userId))

  // Clean up the used token
  await db.delete(passwordResets).where(eq(passwordResets.id, reset.id))

  // Invalidate all existing sessions for this user
  await lucia.invalidateUserSessions(reset.userId)

  return c.json({ message: 'Password reset successfully. You can now sign in with your new password.' })
})

export default auth
