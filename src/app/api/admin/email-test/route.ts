import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import nodemailer from 'nodemailer'
import os from 'os'

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ success: false, message: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })

    const body = await request.json()
    const { to, host, port, secure, smtpUser, password, from, fromName } = body as {
      to: string
      host: string
      port: number
      secure: boolean
      smtpUser: string
      password?: string
      from: string
      fromName?: string
    }

    if (!to || !host || !port || !from) {
      return NextResponse.json({ success: false, message: 'Обязательные поля: адрес получателя, хост, порт, e-mail отправителя' }, { status: 400 })
    }

    // If password not provided in request — fetch stored one from DB
    let resolvedPassword = password
    if (!resolvedPassword) {
      const row = await db.systemSettings.findUnique({ where: { key: 'smtpPassword' } })
      resolvedPassword = row?.value ?? ''
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: smtpUser ? { user: smtpUser, pass: resolvedPassword } : undefined,
      tls: { rejectUnauthorized: false },
    })

    const sentAt = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })

    await transporter.sendMail({
      from: fromName ? `"${fromName}" <${from}>` : from,
      to,
      subject: 'DocsFlow — тестовое письмо',
      text: [
        'Тестовое сообщение от системы DocsFlow.',
        '',
        '── Техническая информация ──────────────────',
        `Время отправки : ${sentAt} (МСК)`,
        `Сервер         : ${os.hostname()}`,
        `SMTP хост      : ${host}:${port}`,
        `Шифрование     : ${secure ? 'SSL/TLS' : 'STARTTLS / plain'}`,
        `Логин          : ${smtpUser || '(не задан)'}`,
        `От             : ${fromName ? `${fromName} <${from}>` : from}`,
        `Кому           : ${to}`,
        `Инициатор      : ${user.name} (${user.email})`,
        '────────────────────────────────────────────',
        '',
        'Если вы получили это письмо — настройки почты работают корректно.',
      ].join('\n'),
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
          <div style="background:#10b981;padding:16px 24px;border-radius:8px 8px 0 0">
            <h2 style="margin:0;color:#fff;font-size:16px">DocsFlow — тестовое письмо</h2>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:20px 24px;border-radius:0 0 8px 8px">
            <p style="margin:0 0 16px">Тестовое сообщение от системы <strong>DocsFlow</strong>.</p>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b;white-space:nowrap">Время отправки</td><td style="padding:6px 10px">${sentAt} (МСК)</td></tr>
              <tr><td style="padding:6px 10px;color:#64748b;white-space:nowrap">Сервер</td><td style="padding:6px 10px;font-family:monospace">${os.hostname()}</td></tr>
              <tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b;white-space:nowrap">SMTP хост</td><td style="padding:6px 10px;font-family:monospace">${host}:${port}</td></tr>
              <tr><td style="padding:6px 10px;color:#64748b;white-space:nowrap">Шифрование</td><td style="padding:6px 10px">${secure ? 'SSL/TLS' : 'STARTTLS / plain'}</td></tr>
              <tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b;white-space:nowrap">Логин</td><td style="padding:6px 10px;font-family:monospace">${smtpUser || '(не задан)'}</td></tr>
              <tr><td style="padding:6px 10px;color:#64748b;white-space:nowrap">От</td><td style="padding:6px 10px">${fromName ? `${fromName} &lt;${from}&gt;` : from}</td></tr>
              <tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b;white-space:nowrap">Кому</td><td style="padding:6px 10px">${to}</td></tr>
              <tr><td style="padding:6px 10px;color:#64748b;white-space:nowrap">Инициатор</td><td style="padding:6px 10px">${user.name} (${user.email})</td></tr>
            </table>
            <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Если вы получили это письмо — настройки почты работают корректно.</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true, message: `Письмо успешно отправлено на ${to}` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
