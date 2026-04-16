import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'

// Form schemas for document types
const INVOICE_FORM_SCHEMA = [
  { id: 'number', label: 'Номер', type: 'text', required: true, column: 1, row: 1, placeholder: 'Введите номер' },
  { id: 'date', label: 'Дата', type: 'date', required: true, column: 1, row: 2 },
  { id: 'supplier', label: 'Поставщик', type: 'text', required: true, column: 1, row: 3, placeholder: 'Наименование поставщика' },
  { id: 'buyer', label: 'Покупатель', type: 'text', required: true, column: 2, row: 3, placeholder: 'Наименование покупателя' },
  { id: 'amount', label: 'Сумма', type: 'number', required: true, column: 1, row: 4, prefix: '₽' },
  { id: 'description', label: 'Описание', type: 'textarea', required: false, column: 1, row: 5, placeholder: 'Описание счёта' },
]

const CONTRACT_FORM_SCHEMA = [
  { id: 'number', label: 'Номер', type: 'text', required: true, column: 1, row: 1, placeholder: 'Введите номер' },
  { id: 'date', label: 'Дата', type: 'date', required: true, column: 1, row: 2 },
  { id: 'parties', label: 'Стороны', type: 'text', required: true, column: 1, row: 3, placeholder: 'Стороны договора' },
  { id: 'subject', label: 'Предмет', type: 'text', required: true, column: 2, row: 3, placeholder: 'Предмет договора' },
  { id: 'amount', label: 'Сумма', type: 'number', required: true, column: 1, row: 4, prefix: '₽' },
  { id: 'startDate', label: 'Дата начала', type: 'date', required: true, column: 1, row: 5 },
  { id: 'endDate', label: 'Дата окончания', type: 'date', required: true, column: 2, row: 5 },
]

const MEMO_FORM_SCHEMA = [
  { id: 'from', label: 'От кого', type: 'text', required: true, column: 1, row: 1, placeholder: 'ФИО отправителя' },
  { id: 'to', label: 'Кому', type: 'text', required: true, column: 2, row: 1, placeholder: 'ФИО получателя' },
  { id: 'date', label: 'Дата', type: 'date', required: true, column: 1, row: 2 },
  { id: 'subject', label: 'Тема', type: 'text', required: true, column: 1, row: 3, placeholder: 'Тема записки' },
  { id: 'text', label: 'Текст', type: 'textarea', required: true, column: 1, row: 4, placeholder: 'Содержание служебной записки' },
  { id: 'priority', label: 'Приоритет', type: 'select', required: true, column: 2, row: 4, options: ['Низкий', 'Средний', 'Высокий', 'Критичный'] },
]

export async function POST() {
  try {
    const results: { entity: string; action: string; status: string }[] = []

    // ─── Seed Users ─────────────────────────────────────────────
    const usersData = [
      { email: 'admin@bpmn.local', password: 'admin123', name: 'Administrator', role: 'ADMIN' },
      { email: 'accountant@bpmn.local', password: 'acc123', name: 'Бухгалтер', role: 'ADVANCED' },
      { email: 'director@bpmn.local', password: 'dir123', name: 'Директор', role: 'ADVANCED' },
      { email: 'employee@bpmn.local', password: 'emp123', name: 'Сотрудник', role: 'USER' },
    ]

    const adminHashedPassword = await hashPassword(usersData[0].password)
    const adminUser = await db.user.upsert({
      where: { email: usersData[0].email },
      update: { name: usersData[0].name, role: usersData[0].role, password: adminHashedPassword },
      create: { ...usersData[0], password: adminHashedPassword },
    })
    results.push({ entity: 'User', action: `upsert ${adminUser.email}`, status: 'ok' })

    for (let i = 1; i < usersData.length; i++) {
      const ud = usersData[i]
      const hashedPassword = await hashPassword(ud.password)
      const u = await db.user.upsert({
        where: { email: ud.email },
        update: { name: ud.name, role: ud.role, password: hashedPassword },
        create: { ...ud, password: hashedPassword },
      })
      results.push({ entity: 'User', action: `upsert ${u.email}`, status: 'ok' })
    }

    // ─── Seed Folders ───────────────────────────────────────────
    const foldersData = [
      { name: 'Мои документы', color: '#3b82f6', icon: 'user', order: 0 },
      { name: 'Общие документы', color: '#10b981', icon: 'folder', order: 1 },
      { name: 'Архив', color: '#6b7280', icon: 'archive', order: 2 },
    ]

    for (const fd of foldersData) {
      const existing = await db.folder.findFirst({ where: { name: fd.name } })
      if (!existing) {
        await db.folder.create({
          data: {
            name: fd.name,
            color: fd.color,
            icon: fd.icon,
            order: fd.order,
            createdById: adminUser.id,
          },
        })
        results.push({ entity: 'Folder', action: `create ${fd.name}`, status: 'ok' })
      } else {
        results.push({ entity: 'Folder', action: `skip ${fd.name} (exists)`, status: 'skipped' })
      }
    }

    // ─── Seed Document Types ────────────────────────────────────
    const docTypesData = [
      {
        name: 'Счёт',
        systemName: 'invoice',
        description: 'Счёт на оплату',
        icon: 'receipt',
        color: '#f59e0b',
        formSchema: INVOICE_FORM_SCHEMA,
      },
      {
        name: 'Договор',
        systemName: 'contract',
        description: 'Договор',
        icon: 'file-signature',
        color: '#3b82f6',
        formSchema: CONTRACT_FORM_SCHEMA,
      },
      {
        name: 'Служебная записка',
        systemName: 'memo',
        description: 'Служебная записка',
        icon: 'file-text',
        color: '#10b981',
        formSchema: MEMO_FORM_SCHEMA,
      },
    ]

    for (const dtd of docTypesData) {
      const existing = await db.documentType.findUnique({
        where: { systemName: dtd.systemName },
      })
      if (!existing) {
        await db.documentType.create({
          data: {
            name: dtd.name,
            systemName: dtd.systemName,
            description: dtd.description,
            icon: dtd.icon,
            color: dtd.color,
            formSchema: JSON.stringify(dtd.formSchema),
          },
        })
        results.push({ entity: 'DocumentType', action: `create ${dtd.name}`, status: 'ok' })
      } else {
        // Update form schema if it's empty/default
        if (existing.formSchema === '[]') {
          await db.documentType.update({
            where: { systemName: dtd.systemName },
            data: {
              formSchema: JSON.stringify(dtd.formSchema),
              description: dtd.description,
              icon: dtd.icon,
              color: dtd.color,
            },
          })
          results.push({ entity: 'DocumentType', action: `update ${dtd.name} (form schema)`, status: 'ok' })
        } else {
          results.push({ entity: 'DocumentType', action: `skip ${dtd.name} (exists)`, status: 'skipped' })
        }
      }
    }

    // ─── Seed Process Definitions ─────────────────────────────
    const processesData = [
      {
        name: 'Согласование документа',
        description: 'Стандартный процесс согласования внутренних документов',
        systemName: 'DOCUMENT_APPROVAL',
        status: 'ACTIVE',
        steps: [
          { id: 's1', name: 'Создание документа', type: 'START', assigneeRole: 'USER', order: 1 },
          { id: 's2', name: 'Проверка руководителем', type: 'APPROVAL', assigneeRole: 'ADVANCED', order: 2 },
          { id: 's3', name: 'Финальное согласование', type: 'APPROVAL', assigneeRole: 'ADMIN', order: 3 },
          { id: 's4', name: 'Уведомление об утверждении', type: 'NOTIFICATION', assigneeRole: 'USER', order: 4 },
        ],
      },
      {
        name: 'Рассмотрение заявки',
        description: 'Процесс рассмотрения и обработки заявок от сотрудников',
        systemName: 'REQUEST_REVIEW',
        status: 'ACTIVE',
        steps: [
          { id: 's1', name: 'Подача заявки', type: 'START', assigneeRole: 'USER', order: 1 },
          { id: 's2', name: 'Предварительная проверка', type: 'APPROVAL', assigneeRole: 'ADVANCED', order: 2 },
          { id: 's3', name: 'Проверка условий', type: 'CONDITION', assigneeRole: 'ADVANCED', order: 3 },
          { id: 's4', name: 'Утверждение директором', type: 'APPROVAL', assigneeRole: 'ADMIN', order: 4 },
          { id: 's5', name: 'Уведомление о результате', type: 'NOTIFICATION', assigneeRole: 'USER', order: 5 },
        ],
      },
      {
        name: 'Обработка договора',
        description: 'Полный цикл обработки и согласования договоров',
        systemName: 'CONTRACT_PROCESSING',
        status: 'DRAFT',
        steps: [
          { id: 's1', name: 'Регистрация договора', type: 'START', assigneeRole: 'USER', order: 1 },
          { id: 's2', name: 'Проверка юридическим отделом', type: 'APPROVAL', assigneeRole: 'ADVANCED', order: 2 },
          { id: 's3', name: 'Финансовая проверка', type: 'APPROVAL', assigneeRole: 'ADVANCED', order: 3 },
          { id: 's4', name: 'Подписание руководством', type: 'APPROVAL', assigneeRole: 'ADMIN', order: 4 },
          { id: 's5', name: 'Уведомление о подписании', type: 'NOTIFICATION', assigneeRole: 'USER', order: 5 },
        ],
      },
    ]

    for (const pd of processesData) {
      const existing = await db.processDefinition.findUnique({
        where: { systemName: pd.systemName },
      })
      if (!existing) {
        await db.processDefinition.create({
          data: {
            name: pd.name,
            description: pd.description,
            systemName: pd.systemName,
            status: pd.status,
            steps: JSON.stringify(pd.steps),
          },
        })
        results.push({ entity: 'ProcessDefinition', action: `create ${pd.name}`, status: 'ok' })
      } else {
        results.push({ entity: 'ProcessDefinition', action: `skip ${pd.name} (exists)`, status: 'skipped' })
      }
    }

    // ─── Seed Document Templates ──────────────────────────────
    const invoiceType = await db.documentType.findUnique({
      where: { systemName: 'invoice' },
    })
    const contractType = await db.documentType.findUnique({
      where: { systemName: 'contract' },
    })
    const memoType = await db.documentType.findUnique({
      where: { systemName: 'memo' },
    })

    const templatesData = []

    if (invoiceType) {
      templatesData.push({
        name: 'Быстрый счёт',
        description: 'Шаблон счёта с предзаполненными полями поставщика',
        typeId: invoiceType.id,
        data: JSON.stringify({ supplier: 'ООО "Компания"' }),
        icon: 'receipt',
        color: '#f59e0b',
      })
    }
    if (contractType) {
      templatesData.push({
        name: 'Стандартный договор',
        description: 'Шаблон договора с предзаполненными сторонами',
        typeId: contractType.id,
        data: JSON.stringify({ parties: 'ООО "Компания" — Заказчик' }),
        icon: 'file-signature',
        color: '#3b82f6',
      })
    }
    if (memoType) {
      templatesData.push({
        name: 'Заявка на отпуск',
        description: 'Шаблон служебной записки для заявления на отпуск',
        typeId: memoType.id,
        data: JSON.stringify({ priority: 'Средний' }),
        icon: 'calendar',
        color: '#10b981',
      })
    }

    for (const td of templatesData) {
      if (!td.typeId) {
        results.push({ entity: 'DocumentTemplate', action: `skip ${td.name} (type not found)`, status: 'skipped' })
        continue
      }

      const existing = await db.documentTemplate.findFirst({
        where: { name: td.name, typeId: td.typeId },
      })
      if (!existing) {
        await db.documentTemplate.create({
          data: {
            name: td.name,
            description: td.description,
            typeId: td.typeId,
            data: td.data,
            icon: td.icon,
            color: td.color,
            createdById: adminUser.id,
          },
        })
        results.push({ entity: 'DocumentTemplate', action: `create ${td.name}`, status: 'ok' })
      } else {
        results.push({ entity: 'DocumentTemplate', action: `skip ${td.name} (exists)`, status: 'skipped' })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      results,
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { error: 'Failed to seed database', details: String(error) },
      { status: 500 }
    )
  }
}
