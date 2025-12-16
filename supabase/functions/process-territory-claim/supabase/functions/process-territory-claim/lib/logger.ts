export const createLogger = (traceId: string) => {
  const base = { traceId }
  const log = (level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) => {
    const payload = { level, message, ...base, ...(meta || {}) }
    console.log(JSON.stringify(payload))
  }

  return {
    info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  }
}
