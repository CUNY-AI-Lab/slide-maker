import 'dotenv/config'

export const env = {
  port: Number(process.env.API_PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./data/slide-maker.db',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-secret-change-me',
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'noreply@ailab.gc.cuny.edu',
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  tavilyApiKey: process.env.TAVILY_API_KEY ?? '',
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:5173',
} as const

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production')
}

// Validate critical env vars on startup
const warnings: string[] = []
if (!env.openrouterApiKey && !env.anthropicApiKey) {
  warnings.push('No AI provider key set (OPENROUTER_API_KEY or ANTHROPIC_API_KEY) — chat will not work')
}
if (!env.smtp.host) {
  warnings.push('SMTP_HOST not set — email verification will not work')
}
if (warnings.length > 0) {
  console.warn(`\n⚠ Environment warnings:\n  ${warnings.join('\n  ')}\n`)
}
