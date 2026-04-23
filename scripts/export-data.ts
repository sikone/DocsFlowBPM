import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'

const prisma = new PrismaClient()

async function main() {
  console.log('Exporting data from SQLite...\n')

  const data = {
    departments:          await prisma.department.findMany(),
    users:                await prisma.user.findMany(),
    sessions:             await prisma.session.findMany(),
    folders:              await prisma.folder.findMany(),
    documentTypes:        await prisma.documentType.findMany(),
    documentTemplates:    await prisma.documentTemplate.findMany(),
    documents:            await prisma.document.findMany(),
    documentTags:         await prisma.documentTag.findMany(),
    documentTagLinks:     await prisma.documentTagLink.findMany(),
    favoriteDocuments:    await prisma.favoriteDocument.findMany(),
    activityLogs:         await prisma.activityLog.findMany(),
    notifications:        await prisma.notification.findMany(),
    comments:             await prisma.comment.findMany(),
    processDefinitions:   await prisma.processDefinition.findMany(),
    processDocumentTypes: await prisma.processDocumentType.findMany(),
    tasks:                await prisma.task.findMany(),
    systemSettings:       await prisma.systemSettings.findMany(),
    documentAttachments:  await prisma.documentAttachment.findMany(),
    counterparties:       await prisma.counterparty.findMany(),
    contacts:             await prisma.contact.findMany(),
    counterpartyContacts: await prisma.counterpartyContact.findMany(),
    approvalRoutes:       await prisma.approvalRoute.findMany(),
    approvalRouteSteps:   await prisma.approvalRouteStep.findMany(),
    documentApprovals:    await prisma.documentApproval.findMany(),
    documentApprovalSteps: await prisma.documentApprovalStep.findMany(),
    approvalStepDecisions: await prisma.approvalStepDecision.findMany(),
    documentPermissions:  await prisma.documentPermission.findMany(),
  }

  writeFileSync('migration-data.json', JSON.stringify(data, null, 2))

  for (const [key, val] of Object.entries(data)) {
    const count = (val as unknown[]).length
    if (count > 0) console.log(`  ${key}: ${count}`)
  }

  console.log('\n✓ Exported to migration-data.json')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
