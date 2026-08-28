import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@coaching/supabase/server'
import { sendNewMessageEmail } from '../../../../lib/email/send-new-message-email'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_REGEX = new RegExp(`^${UUID}$`, 'i')

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.MESSAGE_WEBHOOK_SECRET
    const authHeader = req.headers.get('authorization')
    if (
      !webhookSecret ||
      !authHeader ||
      !authHeader.startsWith('Bearer ') ||
      authHeader.slice(7) !== webhookSecret
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'message_id is required' }, { status: 400 })
    }

    const messageId = (body as Record<string, unknown>)?.message_id
    if (typeof messageId !== 'string' || !UUID_REGEX.test(messageId)) {
      return NextResponse.json({ error: 'message_id must be a valid UUID' }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()

    // 1. Fetch message row
    const { data: message, error: messageError } = await serviceClient
      .from('messages')
      .select('content, sender_id, recipient_id')
      .eq('id', messageId)
      .maybeSingle()

    if (messageError) {
      console.error('MESSAGE LOOKUP FAILED in notify-new route', messageError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!message) {
      return NextResponse.json({ ok: true, notified: 'none', note: 'Message not found' })
    }

    // 2. Fetch recipient platform user
    const { data: recipient, error: recipientError } = await serviceClient
      .from('platform_users')
      .select('role_type, email, full_name')
      .eq('id', message.recipient_id)
      .maybeSingle()

    if (recipientError) {
      console.error('RECIPIENT LOOKUP FAILED in notify-new route', recipientError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!recipient) {
      return NextResponse.json({ ok: true, notified: 'none', note: 'Recipient not found' })
    }

    // 3. Fetch sender platform user
    const { data: sender, error: senderError } = await serviceClient
      .from('platform_users')
      .select('full_name')
      .eq('id', message.sender_id)
      .maybeSingle()

    if (senderError) {
      console.error('SENDER LOOKUP FAILED in notify-new route', senderError)
    }

    const senderName = sender?.full_name ?? 'Someone'

    // 4. Branch on recipient role_type
    if (recipient.role_type === 'coach') {
      if (recipient.email) {
        await sendNewMessageEmail({
          to: recipient.email,
          coachName: recipient.full_name,
          senderName,
          content: message.content,
        })
      }
      return NextResponse.json({ ok: true, notified: 'email' })
    }

    if (recipient.role_type === 'client') {
      const { data: tokenRow, error: tokenError } = await serviceClient
        .from('push_tokens')
        .select('expo_push_token')
        .eq('user_id', message.recipient_id)
        .maybeSingle()

      if (tokenError) {
        console.error('PUSH TOKEN LOOKUP FAILED in notify-new route', tokenError)
      }

      const pushToken = tokenRow?.expo_push_token?.trim()
      if (pushToken) {
        const pushBody =
          message.content.length > 100
            ? `${message.content.slice(0, 100)}…`
            : message.content

        try {
          const res = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify([
              {
                to: pushToken,
                title: senderName,
                body: pushBody,
              },
            ]),
          })

          if (!res.ok) {
            console.error('EXPO PUSH SEND FAILED (HTTP status)', res.status)
          }
        } catch (err) {
          console.error('EXPO PUSH SEND EXCEPTION', err)
        }

        return NextResponse.json({ ok: true, notified: 'push' })
      }

      return NextResponse.json({ ok: true, notified: 'none', note: 'No push token found' })
    }

    return NextResponse.json({ ok: true, notified: 'none' })
  } catch (err) {
    console.error('NOTIFY NEW MESSAGE EXCEPTION:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
