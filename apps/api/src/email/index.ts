import nodemailer from 'nodemailer'
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses'
import { env } from '../env.js'

function createTransport() {
  // Prefer SES when AWS region is set and no SMTP host configured
  if (env.ses.enabled) {
    const ses = new SESClient({ region: env.ses.region })
    return nodemailer.createTransport({
      SES: { ses, aws: { SendRawEmailCommand } },
    })
  }

  // Fall back to SMTP
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  })
}

const transporter = createTransport()

const fromAddress = env.ses.enabled ? env.ses.from : env.smtp.from

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verifyUrl = `${env.publicUrl}/verify?token=${token}`

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject: 'Verify your Slide Wiz account',
    html: `
      <h2>Welcome to Slide Wiz</h2>
      <p>Click the link below to verify your email address:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours.</p>
      <p>— CUNY AI Lab</p>
    `,
  })
}

export async function sendDeckSharedEmail(
  to: string,
  sharedByName: string,
  deckTitle: string,
  deckId: string,
  role: string,
): Promise<void> {
  const deckUrl = `${env.publicUrl}/deck/${deckId}`

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject: `${sharedByName} shared a deck with you — "${deckTitle}"`,
    html: `
      <h2>You've been invited to collaborate</h2>
      <p><strong>${sharedByName}</strong> shared the deck <strong>"${deckTitle}"</strong> with you as ${role === 'editor' ? 'an editor' : 'a viewer'}.</p>
      <p><a href="${deckUrl}">Open deck</a></p>
      <p>— CUNY AI Lab</p>
    `,
  })
}
