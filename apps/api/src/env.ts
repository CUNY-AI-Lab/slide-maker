import 'dotenv/config'
import { resolveApiHost } from './listen-host.js'

export const env = {
  host: resolveApiHost(),
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
  ses: {
    region: process.env.SES_REGION || process.env.AWS_REGION || '',
    from: process.env.SES_FROM_EMAIL ?? 'ailab@gc.cuny.edu',
    enabled: process.env.EMAIL_PROVIDER === 'ses',
  },
  tavilyApiKey: process.env.TAVILY_API_KEY ?? '',
  braveApiKey: process.env.BRAVE_API_KEY ?? '',
  pexelsApiKey: process.env.PEXELS_API_KEY ?? '',
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:5173',
  /** All origins accepted by CORS and CSRF. In non-production mode,
   *  localhost dev/preview ports are always included so local dev
   *  works even when PUBLIC_URL points at staging. */
  allowedOrigins: (() => {
    const origins = new Set<string>()
    const pub = process.env.PUBLIC_URL
    if (pub) {
      try { origins.add(new URL(pub).origin) } catch { origins.add(pub.replace(/\/$/, '')) }
    }
    if (process.env.NODE_ENV !== 'production') {
      origins.add('http://localhost:5173')
      origins.add('http://localhost:4173')
    }
    if (origins.size === 0) origins.add('http://localhost:5173')
    return [...origins]
  })(),
} as const

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production')
}

// Validate critical env vars on startup
const warnings: string[] = []
if (!env.smtp.host && !env.ses.enabled) {
  warnings.push('No email provider configured — set SMTP_HOST or EMAIL_PROVIDER=ses')
}
if (env.ses.enabled && !env.ses.region) {
  warnings.push('EMAIL_PROVIDER=ses but no AWS region set (SES_REGION or AWS_REGION)')
}
if (!env.pexelsApiKey) {
  warnings.push('PEXELS_API_KEY not set — image search will not work')
}
if (warnings.length > 0) {
  console.warn(`\n⚠ Environment warnings:\n  ${warnings.join('\n  ')}\n`)
}
