import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { to, taskType, taskCustomer, authorName, noteText } = await req.json()

    if (!to || !taskType || !authorName) {
      return NextResponse.json(
        { error: 'Eksik parametreler' },
        { status: 400 }
      )
    }

    const { data, error } = await resend.emails.send({
      from: 'Cetinler Ajanda <onboarding@resend.dev>',
      to: [to],
      subject: `${authorName} görevinize not ekledi`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #083325; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
              .task-info { background: white; padding: 15px; border-left: 4px solid #1D9E75; margin: 15px 0; }
              .note { background: #fff; padding: 15px; border-radius: 4px; margin: 15px 0; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>🔔 Göreve Yeni Not Eklendi</h2>
              </div>
              <div class="content">
                <p><strong>${authorName}</strong> görevinize not ekledi:</p>

                <div class="task-info">
                  <strong>Görev:</strong> ${taskType}${taskCustomer ? ' - ' + taskCustomer : ''}
                </div>

                <div class="note">
                  <strong>Not:</strong><br>
                  ${noteText || '(Boş not)'}
                </div>

                <p>
                  <a href="https://cetinler-ajanda.vercel.app/app"
                     style="background: #1D9E75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    Görevi Görüntüle
                  </a>
                </p>
              </div>
              <div class="footer">
                Bu bir otomatik bildirimdir. Cetinler Saha Ajandası
              </div>
            </div>
          </body>
        </html>
      `,
    })

    if (error) {
      console.error('Email gönderim hatası:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Email gönderildi:', to)
    return NextResponse.json({ success: true, id: data?.id })
  } catch (error: any) {
    console.error('Email API hatası:', error)
    return NextResponse.json(
      { error: error.message || 'Email gönderilemedi' },
      { status: 500 }
    )
  }
}
