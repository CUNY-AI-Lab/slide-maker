import nodemailer from 'nodemailer'
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses'
import { escapeHtml } from '@slide-maker/shared'
import { env } from '../env.js'

function stripTags(str: string): string {
  return str.replace(/<[^>]*>/g, '')
}

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

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetUrl = `${env.publicUrl}/reset-password?token=${token}`

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject: 'Reset your Slide Wiz password',
    html: `
      <h2>Password Reset</h2>
      <p>We received a request to reset the password for your Slide Wiz account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>Or copy this link: ${resetUrl}</p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      <p>— CUNY AI Lab</p>
    `,
  })
}

export async function sendAdminPasswordResetEmail(to: string, token: string, adminName: string): Promise<void> {
  const resetUrl = `${env.publicUrl}/reset-password?token=${token}`

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject: 'Your Slide Wiz password has been reset',
    html: `
      <h2>Password Reset by Administrator</h2>
      <p>An administrator (${escapeHtml(adminName)}) has initiated a password reset for your Slide Wiz account.</p>
      <p><a href="${resetUrl}">Click here to set a new password</a></p>
      <p>Or copy this link: ${resetUrl}</p>
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
    subject: `${stripTags(sharedByName)} shared a deck with you — "${stripTags(deckTitle)}"`,
    html: `
      <h2>You've been invited to collaborate</h2>
      <p><strong>${escapeHtml(sharedByName)}</strong> shared the deck <strong>"${escapeHtml(deckTitle)}"</strong> with you as ${role === 'editor' ? 'an editor' : 'a viewer'}.</p>
      <p><a href="${deckUrl}">Open deck</a></p>
      <p>— CUNY AI Lab</p>
    `,
  })
}
