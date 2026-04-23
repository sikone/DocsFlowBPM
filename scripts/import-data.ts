import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'

const prisma = new PrismaClient()

function log(label: string, count: number) {
  console.log(`  ✓ ${label}: ${count}`)
}

async function main() {
  const raw = readFileSync('migration-data.json', 'utf-8')
  const d = JSON.parse(raw)

  console.log('Importing data to PostgreSQL...\n')

  // 1. Departments (no deps)
  if (d.departments.length) {
    await prisma.department.createMany({ data: d.departments, skipDuplicates: true })
    log('departments', d.departments.length)
  }

  // 2. Users (depends on Department)
  if (d.users.length) {
    await prisma.user.createMany({ data: d.users, skipDuplicates: true })
    log('users', d.users.length)
  }

  // 3. Sessions (depends on User)
  if (d.sessions.length) {
    await prisma.session.createMany({ data: d.sessions, skipDuplicates: true })
    log('sessions', d.sessions.length)
  }

  // 4. Folders — self-referential: insert without parentId first, then patch
  if (d.folders.length) {
    await prisma.folder.createMany({
      data: d.folders.map((f: any) => ({ ...f, parentId: null })),
      skipDuplicates: true,
    })
    const withParent = d.folders.filter((f: any) => f.parentId)
    for (const f of withParent) {
      await prisma.folder.update({ where: { id: f.id }, data: { parentId: f.parentId } })
    }
    log('folders', d.folders.length)
  }

  // 5. DocumentTypes (no deps)
  if (d.documentTypes.length) {
    await prisma.documentType.createMany({ data: d.documentTypes, skipDuplicates: true })
    log('documentTypes', d.documentTypes.length)
  }

  // 6. DocumentTemplates (depends on DocumentType, User)
  if (d.documentTemplates.length) {
    await prisma.documentTemplate.createMany({ data: d.documentTemplates, skipDuplicates: true })
    log('documentTemplates', d.documentTemplates.length)
  }

  // 7. Documents (depends on DocumentType, Folder, User)
  if (d.documents.length) {
    await prisma.document.createMany({ data: d.documents, skipDuplicates: true })
    log('documents', d.documents.length)
  }

  // 8. DocumentTags (depends on User)
  if (d.documentTags.length) {
    await prisma.documentTag.createMany({ data: d.documentTags, skipDuplicates: true })
    log('documentTags', d.documentTags.length)
  }

  // 9. DocumentTagLinks (depends on Document, DocumentTag)
  if (d.documentTagLinks.length) {
    await prisma.documentTagLink.createMany({ data: d.documentTagLinks, skipDuplicates: true })
    log('documentTagLinks', d.documentTagLinks.length)
  }

  // 10. FavoriteDocuments (depends on User, Document)
  if (d.favoriteDocuments.length) {
    await prisma.favoriteDocument.createMany({ data: d.favoriteDocuments, skipDuplicates: true })
    log('favoriteDocuments', d.favoriteDocuments.length)
  }

  // 11. ActivityLogs (depends on User)
  if (d.activityLogs.length) {
    await prisma.activityLog.createMany({ data: d.activityLogs, skipDuplicates: true })
    log('activityLogs', d.activityLogs.length)
  }

  // 12. Notifications (depends on User)
  if (d.notifications.length) {
    await prisma.notification.createMany({ data: d.notifications, skipDuplicates: true })
    log('notifications', d.notifications.length)
  }

  // 13. Comments (depends on Document, User)
  if (d.comments.length) {
    await prisma.comment.createMany({ data: d.comments, skipDuplicates: true })
    log('comments', d.comments.length)
  }

  // 14. ProcessDefinitions (no deps)
  if (d.processDefinitions.length) {
    await prisma.processDefinition.createMany({ data: d.processDefinitions, skipDuplicates: true })
    log('processDefinitions', d.processDefinitions.length)
  }

  // 15. ProcessDocumentTypes (depends on ProcessDefinition, DocumentType)
  if (d.processDocumentTypes.length) {
    await prisma.processDocumentType.createMany({ data: d.processDocumentTypes, skipDuplicates: true })
    log('processDocumentTypes', d.processDocumentTypes.length)
  }

  // 16. Tasks (depends on Document, User)
  if (d.tasks.length) {
    await prisma.task.createMany({ data: d.tasks, skipDuplicates: true })
    log('tasks', d.tasks.length)
  }

  // 17. SystemSettings (no deps)
  if (d.systemSettings.length) {
    await prisma.systemSettings.createMany({ data: d.systemSettings, skipDuplicates: true })
    log('systemSettings', d.systemSettings.length)
  }

  // 18. DocumentAttachments (depends on Document, User)
  if (d.documentAttachments.length) {
    await prisma.documentAttachment.createMany({ data: d.documentAttachments, skipDuplicates: true })
    log('documentAttachments', d.documentAttachments.length)
  }

  // 19. Counterparties (no deps)
  if (d.counterparties.length) {
    await prisma.counterparty.createMany({ data: d.counterparties, skipDuplicates: true })
    log('counterparties', d.counterparties.length)
  }

  // 20. Contacts (no deps)
  if (d.contacts.length) {
    await prisma.contact.createMany({ data: d.contacts, skipDuplicates: true })
    log('contacts', d.contacts.length)
  }

  // 21. CounterpartyContacts (depends on Counterparty, Contact)
  if (d.counterpartyContacts.length) {
    await prisma.counterpartyContact.createMany({ data: d.counterpartyContacts, skipDuplicates: true })
    log('counterpartyContacts', d.counterpartyContacts.length)
  }

  // 22. ApprovalRoutes (no deps)
  if (d.approvalRoutes.length) {
    await prisma.approvalRoute.createMany({ data: d.approvalRoutes, skipDuplicates: true })
    log('approvalRoutes', d.approvalRoutes.length)
  }

  // 23. ApprovalRouteSteps (depends on ApprovalRoute, User, Department)
  if (d.approvalRouteSteps.length) {
    await prisma.approvalRouteStep.createMany({ data: d.approvalRouteSteps, skipDuplicates: true })
    log('approvalRouteSteps', d.approvalRouteSteps.length)
  }

  // 24. DocumentApprovals (depends on Document, ApprovalRoute, ProcessDefinition, User)
  if (d.documentApprovals.length) {
    await prisma.documentApproval.createMany({ data: d.documentApprovals, skipDuplicates: true })
    log('documentApprovals', d.documentApprovals.length)
  }

  // 25. DocumentApprovalSteps (depends on DocumentApproval, User, Department)
  if (d.documentApprovalSteps.length) {
    await prisma.documentApprovalStep.createMany({ data: d.documentApprovalSteps, skipDuplicates: true })
    log('documentApprovalSteps', d.documentApprovalSteps.length)
  }

  // 26. ApprovalStepDecisions (depends on DocumentApprovalStep, User)
  if (d.approvalStepDecisions.length) {
    await prisma.approvalStepDecision.createMany({ data: d.approvalStepDecisions, skipDuplicates: true })
    log('approvalStepDecisions', d.approvalStepDecisions.length)
  }

  // 27. DocumentPermissions (depends on Document, User)
  if (d.documentPermissions.length) {
    await prisma.documentPermission.createMany({ data: d.documentPermissions, skipDuplicates: true })
    log('documentPermissions', d.documentPermissions.length)
  }

  console.log('\n✓ Migration complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
