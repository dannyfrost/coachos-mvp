import { Resend } from 'resend'

interface SendInviteEmailParams {
  to: string
  fullName: string
  activationToken: string
}

interface SendInviteEmailResult {
  sent: boolean
  reason?: string
}

// Never log or return `activationToken` — it is a credential.
export async function sendInviteEmail({
  to,
  fullName,
  activationToken,
}: SendInviteEmailParams): Promise<SendInviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { sent: false, reason: 'Email service is not configured.' }
  }

  const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
  const resend = new Resend(apiKey)

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: "You've been invited to activate your account",
      text: [
        `Hi ${fullName},`,
        '',
        'Your coach has invited you to activate your client account.',
        'Open the app and enter this activation code to set your password:',
        '',
        activationToken,
        '',
        'This code expires in 7 days.',
      ].join('\n'),
    })

    if (error) {
      return { sent: false, reason: 'Email provider rejected the send request.' }
    }
    return { sent: true }
  } catch {
    return { sent: false, reason: 'Email send failed.' }
  }
}
