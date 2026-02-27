function makeRateLimiter(maxCalls: number, windowMs: number) {
  const log = new Map<string, number[]>()
  return {
    allow(id: string): boolean {
      const now = Date.now()
      const times = (log.get(id) ?? []).filter(t => now - t < windowMs)
      if (times.length >= maxCalls) return false
      times.push(now)
      log.set(id, times)
      return true
    },
    remove(id: string) { log.delete(id) },
  }
}

export const joinLimiter = makeRateLimiter(5, 10_000)   // 5 joins per 10 s
export const timerLimiter = makeRateLimiter(10, 1_000)  // 10 timer ops per 1 s
