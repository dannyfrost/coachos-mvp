import { Resend } from 'resend'

export interface SendNewMessageEmailParams {
  to: string          // coach's email
  coachName: string
  senderName: string  // who sent the message (the client, or another coach-side user)
  content: string      // message body
}

export interface SendNewMessageEmailResult {
  sent: boolean
  reason?: string
}

export async function sendNewMessageEmail({
  to,
  coachName,
  senderName,
  content,
}: SendNewMessageEmailParams): Promise<SendNewMessageEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { sent: false, reason: 'Email service is not configured.' }
  }

  const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
  const resend = new Resend(apiKey)
  const displayContent =
    content.length > 300 ? `${content.slice(0, 300)}…` : content

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `New message from ${senderName}`,
      text: [
        `Hi ${coachName},`,
        '',
        `You have a new message from ${senderName}:`,
        '',
        displayContent,
        '',
        'Reply on your CoachOS dashboard at /messages.',
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
