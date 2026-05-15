export interface EmailTemplateDefault {
  slug: string
  name: string
  description: string
  subject: string
  bodyHtml: string
  isSystem: boolean
}

const SHARED_BODY_SUFFIX = `      <div style="text-align:center;margin:28px 0 20px">
        {{CTA_BUTTON_HTML}}
        {{QUICK_APPROVE_HTML}}
        <p style="margin:10px 0 0;font-size:12px;color:#94a3b8">или скопируйте ссылку: <a href="{{DOC_URL}}" style="color:#10b981;word-break:break-all">{{DOC_URL}}</a></p>
      </div>
      <div style="border-top:1px solid #f1f5f9;margin-top:20px;padding-top:16px;text-align:center">
        <p style="margin:0;font-size:11px;color:#cbd5e1;line-height:1.6">Это автоматическое уведомление от системы <strong>DocsFlow</strong>.<br>Пожалуйста, не отвечайте на это письмо.</p>
      </div>
    </div>
  </div>
</body>
</html>`

function buildBody(headerGradient: string, headerTitle: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${headerTitle} — DocsFlow</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;-webkit-font-smoothing:antialiased">
  <div style="max-width:600px;margin:0 auto;padding:28px 16px 40px">
    <div style="background:${headerGradient};padding:22px 28px;border-radius:12px 12px 0 0">
      <table style="width:100%;border-collapse:collapse"><tr><td style="vertical-align:middle">
        <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;margin-right:12px;vertical-align:middle"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
        <span style="vertical-align:middle">
          <span style="display:block;color:rgba(255,255,255,0.75);font-size:11px;text-transform:uppercase;letter-spacing:0.08em">DocsFlow</span>
          <span style="display:block;color:#fff;font-size:16px;font-weight:700;margin-top:2px">${headerTitle}</span>
        </span>
      </td></tr></table>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:28px 28px 24px">
      <h1 style="margin:0 0 4px;font-size:21px;font-weight:700;color:#0f172a;line-height:1.3">{{DOCUMENT_TITLE}}</h1>
      {{DOCUMENT_NUMBER_BLOCK}}
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #10b981;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:22px">
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;font-weight:600;margin-bottom:5px">Шаг согласования</div>
        <div style="font-size:16px;font-weight:600;color:#1e293b">{{STEP_NAME}}</div>
        {{ASSIGNEE_BLOCK}}
        {{DEADLINE_HTML}}
      </div>
      {{FIELDS_HTML}}
      {{COMMENTS_HTML}}
${SHARED_BODY_SUFFIX}`
}

function buildOverdueBody(headerGradient: string, headerTitle: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${headerTitle} — DocsFlow</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;-webkit-font-smoothing:antialiased">
  <div style="max-width:600px;margin:0 auto;padding:28px 16px 40px">
    <div style="background:${headerGradient};padding:22px 28px;border-radius:12px 12px 0 0">
      <table style="width:100%;border-collapse:collapse"><tr><td style="vertical-align:middle">
        <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;margin-right:12px;vertical-align:middle"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
        <span style="vertical-align:middle">
          <span style="display:block;color:rgba(255,255,255,0.75);font-size:11px;text-transform:uppercase;letter-spacing:0.08em">DocsFlow</span>
          <span style="display:block;color:#fff;font-size:16px;font-weight:700;margin-top:2px">${headerTitle}</span>
        </span>
      </td></tr></table>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:28px 28px 24px">
      <h1 style="margin:0 0 4px;font-size:21px;font-weight:700;color:#0f172a;line-height:1.3">{{DOCUMENT_TITLE}}</h1>
      {{DOCUMENT_NUMBER_BLOCK}}
      <div style="background:#fef2f2;border:1px solid #fecaca;border-left:3px solid #dc2626;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:22px">
        <div style="font-size:11px;color:#991b1b;text-transform:uppercase;letter-spacing:0.07em;font-weight:600;margin-bottom:5px">Шаг согласования</div>
        <div style="font-size:16px;font-weight:600;color:#1e293b">{{STEP_NAME}}</div>
        {{ASSIGNEE_BLOCK}}
        {{DEADLINE_HTML}}
        {{OVERDUE_DURATION_HTML}}
      </div>
      {{FIELDS_HTML}}
      {{COMMENTS_HTML}}
${SHARED_BODY_SUFFIX}`
}

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateDefault[] = [
  {
    slug: 'approval_request',
    name: 'Запрос на согласование',
    description: 'Отправляется при запуске маршрута согласования и при переходе к новому шагу',
    subject: 'Документ «{{DOCUMENT_TITLE}}» ожидает вашего согласования',
    bodyHtml: buildBody('linear-gradient(135deg,#059669 0%,#10b981 100%)', 'Запрос на согласование'),
    isSystem: true,
  },
  {
    slug: 'sla_warning',
    name: 'Предупреждение о сроке согласования',
    description: 'Отправляется когда до дедлайна согласования остался 1 час',
    subject: 'ВАЖНО! Срок согласования документа «{{DOCUMENT_TITLE}}» подходит к концу',
    bodyHtml: buildBody('linear-gradient(135deg,#d97706 0%,#f59e0b 100%)', 'Срок согласования подходит к концу'),
    isSystem: true,
  },
  {
    slug: 'sla_overdue',
    name: 'Заявка просрочена',
    description: 'Отправляется исполнителям и руководителю отдела когда срок согласования истёк',
    subject: 'ПРОСРОЧЕНО! Заявка «{{DOCUMENT_TITLE}}» не согласована в срок',
    bodyHtml: buildOverdueBody('linear-gradient(135deg,#991b1b 0%,#dc2626 100%)', 'Заявка просрочена'),
    isSystem: true,
  },
]

/** Available template variables reference for the admin UI */
export const TEMPLATE_VARIABLES: { name: string; description: string; inSubject?: boolean }[] = [
  { name: '{{DOCUMENT_TITLE}}', description: 'Название документа', inSubject: true },
  { name: '{{DOCUMENT_NUMBER_BLOCK}}', description: 'Блок с номером документа (HTML)' },
  { name: '{{STEP_NAME}}', description: 'Название шага согласования' },
  { name: '{{ASSIGNEE_BLOCK}}', description: 'Блок с именем ответственного (HTML)' },
  { name: '{{DEADLINE_HTML}}', description: 'Значок срока (HTML, пусто если нет)' },
  { name: '{{FIELDS_HTML}}', description: 'Таблица полей документа (HTML)' },
  { name: '{{COMMENTS_HTML}}', description: 'Блок комментариев (HTML)' },
  { name: '{{DOC_URL}}', description: 'Ссылка на документ' },
  { name: '{{CTA_BUTTON_HTML}}', description: 'Кнопка «Перейти к документу» (HTML)' },
  { name: '{{QUICK_APPROVE_HTML}}', description: 'Кнопка быстрого согласования (HTML, пусто если нет)' },
  { name: '{{OVERDUE_DURATION_HTML}}', description: 'Блок с длительностью просрочки (HTML, только в шаблоне sla_overdue)' },
]
