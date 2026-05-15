import Redis from 'ioredis'
import { logger } from '@/lib/logger'

const globalForRedis = globalThis as unknown as { _redis: Redis | null | undefined }

function createClient(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url) return null

  const client = new Redis(url, {
    connectTimeout: 3000,
    commandTimeout: 300,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    lazyConnect: false,
  })

  client.on('error', (err: Error) => logger.error('Redis error:', err.message))

  return client
}

if (globalForRedis._redis === undefined) {
  globalForRedis._redis = createClient()
}

const redis = globalForRedis._redis

export const SESSION_CACHE_PREFIX = 'cache:session:'
export const UNREAD_CACHE_PREFIX = 'cache:unread:'

export async function cacheGet(key: string): Promise<string | null> {
  if (!redis) return null
  try {
    return await redis.get(key)
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!redis) return
  try {
    await redis.set(key, value, 'EX', ttlSeconds)
  } catch {}
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return
  try {
    await redis.del(...keys)
  } catch {}
}
