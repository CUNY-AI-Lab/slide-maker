import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// ── Auth ──

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  role: text('role', { enum: ['admin', 'editor', 'viewer'] }).notNull().default('editor'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
})

export const emailVerifications = sqliteTable('email_verifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
})

// ── Decks ──

export const decks = sqliteTable('decks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  themeId: text('theme_id'),
  metadata: text('metadata', { mode: 'json' }).notNull().default('{}'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const deckAccess = sqliteTable('deck_access', {
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'editor', 'viewer'] }).notNull(),
})

export const slides = sqliteTable('slides', {
  id: text('id').primaryKey(),
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  layout: text('layout').notNull().default('layout-split'),
  order: integer('order').notNull(),
  splitRatio: text('split_ratio').notNull().default('0.45'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const contentBlocks = sqliteTable('content_blocks', {
  id: text('id').primaryKey(),
  slideId: text('slide_id').notNull().references(() => slides.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  zone: text('zone').notNull().default('content'),
  data: text('data', { mode: 'json' }).notNull().default('{}'),
  order: integer('order').notNull(),
  stepOrder: integer('step_order'),
})

// ── Resources ──

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  layout: text('layout').notNull(),
  modules: text('modules', { mode: 'json' }).notNull().default('[]'),
  thumbnail: text('thumbnail'),
  builtIn: integer('built_in', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by'),
})

export const themes = sqliteTable('themes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  css: text('css').notNull(),
  fonts: text('fonts', { mode: 'json' }).notNull(),
  colors: text('colors', { mode: 'json' }).notNull(),
  builtIn: integer('built_in', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by'),
})

export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  type: text('type', { enum: ['chart', 'map', 'diagram', 'widget'] }).notNull(),
  source: text('source').notNull(),
  config: text('config', { mode: 'json' }).notNull().default('{}'),
  builtIn: integer('built_in', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by'),
})

export const uploadedFiles = sqliteTable('uploaded_files', {
  id: text('id').primaryKey(),
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  path: text('path').notNull(),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

// ── Chat History ──

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  mutations: text('mutations', { mode: 'json' }),
  provider: text('provider').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

// ── Deck Locks (for sharing/locking) ──

export const deckLocks = sqliteTable('deck_locks', {
  deckId: text('deck_id').primaryKey().references(() => decks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  userName: text('user_name').notNull(),
  lockedAt: integer('locked_at', { mode: 'timestamp_ms' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
})
