import { Resend } from 'resend'

export interface SendAbsenceAlertEmailParams {
  to: string          // coach's email
  coachName: string
  clientName: string
  level: '24h' | '48h' | '72h'
}

export interface SendAbsenceAlertEmailResult {
  sent: boolean
  reason?: string
}

const LEVEL_DURATION_MAP: Record<'24h' | '48h' | '72h', string> = {
  '24h': '1 day',
  '48h': '2 days',
  '72h': '3 days',
}

export async function sendAbsenceAlertEmail({
  to,
  coachName,
  clientName,
  level,
}: SendAbsenceAlertEmailParams): Promise<SendAbsenceAlertEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { sent: false, reason: 'Email service is not configured.' }
  }

  const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
  const resend = new Resend(apiKey)
  const duration = LEVEL_DURATION_MAP[level] ?? '1 day'

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `${clientName} hasn't checked in`,
      text: [
        `Hi ${coachName},`,
        '',
        `${clientName} hasn't checked in for ${duration} (${level} absence alert).`,
        '',
        'Review their status and take action on your CoachOS dashboard at /alerts.',
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
