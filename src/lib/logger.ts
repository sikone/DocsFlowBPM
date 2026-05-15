const isDebug = process.env.DEBUG === 'true' || process.env.DEBUG === '1'
const isProduction = process.env.NODE_ENV === 'production'

function timestamp(): string {
  return new Date().toISOString()
}

function serialize(arg: unknown): string {
  if (arg instanceof Error) return `${arg.message}\n${arg.stack ?? ''}`
  if (typeof arg === 'object' && arg !== null) {
    try { return JSON.stringify(arg) } catch { return String(arg) }
  }
  return String(arg)
}

function line(level: string, args: unknown[]): string {
  const msg = args.map(serialize).join(' ')
  return isProduction
    ? `[${timestamp()}] [${level}] ${msg}`
    : `[${level}] ${msg}`
}

export const logger = {
  info:  (...args: unknown[]) => console.log(line('INFO', args)),
  warn:  (...args: unknown[]) => console.warn(line('WARN', args)),
  error: (...args: unknown[]) => console.error(line('ERROR', args)),
  debug: (...args: unknown[]) => { if (isDebug) console.log(line('DEBUG', args)) },
}
