import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ0123456789', 4)

export function generateUniqueCode(activeCodes: Set<string>): string {
  let code: string
  do { code = nanoid() } while (activeCodes.has(code))
  return code
}
