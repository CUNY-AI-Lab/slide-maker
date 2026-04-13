import 'dotenv/config'

// Accept provider selection via env or CLI flag: --provider <bedrock|anthropic|openrouter|all>
function parseProvider(input?: string | null): '' | 'bedrock' | 'anthropic' | 'openrouter' {
  const v = (input || '').trim().toLowerCase()
  if (v === 'bedrock' || v === 'anthropic' || v === 'openrouter') return v
  return ''
}

function getCliArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`)
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1]
  const pref = `--${name}=`
  const m = process.argv.find((a) => a.startsWith(pref))
  if (m) return m.slice(pref.length)
  return undefined
}

const cliProvider = getCliArg('provider')

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
  ses: {
    region: process.env.SES_REGION || process.env.AWS_REGION || '',
    from: process.env.SES_FROM_EMAIL ?? 'ailab@gc.cuny.edu',
    enabled: process.env.EMAIL_PROVIDER === 'ses',
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  // AWS Bedrock uses the standard AWS credential chain; we detect enablement via region
  awsRegion: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || process.env.BEDROCK_REGION || '',
  bedrockApiKey: process.env.BEDROCK_API_KEY || '',
  // Optional, to expose admin-only higher tier models
  bedrockSonnet46ModelId: process.env.BEDROCK_SONNET_46_MODEL_ID || '',
  anthropicSonnet46Id: process.env.ANTHROPIC_SONNET_46_MODEL_ID || '',
  // Provider filter (optional): '', 'bedrock', 'anthropic', 'openrouter'
  aiProvider: parseProvider(cliProvider || process.env.AI_PROVIDER || null),
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
if (!env.openrouterApiKey && !env.anthropicApiKey && !env.awsRegion) {
  warnings.push('No AI provider configured (OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or AWS_REGION for Bedrock) — chat will not work')
}
if (env.aiProvider === 'openrouter' && !env.openrouterApiKey) {
  warnings.push('AI_PROVIDER=openrouter but OPENROUTER_API_KEY is not set')
}
if (env.aiProvider === 'anthropic' && !env.anthropicApiKey) {
  warnings.push('AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set')
}
if (env.aiProvider === 'bedrock' && !env.awsRegion) {
  warnings.push('AI_PROVIDER=bedrock but AWS_REGION is not set')
}
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
