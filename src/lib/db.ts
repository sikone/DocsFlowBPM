import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaVersion: string | undefined
}

// Force new PrismaClient if schema has changed
const SCHEMA_VERSION = 'v2' // Bump this to force PrismaClient reload

export const db =
  (globalForPrisma.prisma && globalForPrisma.prismaVersion === SCHEMA_VERSION)
    ? globalForPrisma.prisma
    : new PrismaClient({
        log: ['query'],
      })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
  globalForPrisma.prismaVersion = SCHEMA_VERSION
}