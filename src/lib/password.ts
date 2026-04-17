import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function isHashed(value: string): Promise<boolean> {
  // bcrypt hashes always start with $2b$ or $2a$
  return value.startsWith('$2b$') || value.startsWith('$2a$')
}
