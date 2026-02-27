import type { Server } from 'socket.io'

export const MAX_ROOMS = 1000
export const MAX_USERS_PER_ROOM = 20
export const ROOM_CLEANUP_DELAY_MS = 15_000
export const ROOM_MAX_AGE_MS = 6 * 60 * 60 * 1000  // 6 hours

export type TimerState = {
  duration: number      // total seconds
  elapsed: number       // ms accumulated before current run
  startedAt: number | null  // Date.now() when current run started
  state: 'idle' | 'running' | 'paused'
}

export type RoomSettings = {
  openControls: boolean  // any member can start/pause
}

export const activeCodes = new Set<string>()
export const socketToCode = new Map<string, string>()    // socketId -> code they created
export const roomHosts = new Map<string, string>()       // code -> host socketId
export const roomHostTokens = new Map<string, string>()  // code -> secret host token
export const roomTimers = new Map<string, TimerState>()
export const roomSettings = new Map<string, RoomSettings>()
export const roomCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>()
export const roomExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function createTimer(): TimerState {
  return { duration: 300, elapsed: 0, startedAt: null, state: 'idle' }
}

// Removes all state for a room and cancels any pending timers.
export function destroyRoom(code: string) {
  activeCodes.delete(code)
  roomTimers.delete(code)
  roomSettings.delete(code)
  roomHostTokens.delete(code)
  roomHosts.delete(code)
  for (const [sid, c] of socketToCode) {
    if (c === code) socketToCode.delete(sid)
  }
  const cleanup = roomCleanupTimers.get(code)
  if (cleanup) { clearTimeout(cleanup); roomCleanupTimers.delete(code) }
  const expiry = roomExpiryTimers.get(code)
  if (expiry) { clearTimeout(expiry); roomExpiryTimers.delete(code) }
  console.log(`[room] destroyed room: ${code}`)
}

// Schedules cleanup of an empty room after a short delay (handles brief disconnects).
export function scheduleRoomCleanup(io: Server, code: string) {
  const existing = roomCleanupTimers.get(code)
  if (existing) clearTimeout(existing)
  const t = setTimeout(() => {
    roomCleanupTimers.delete(code)
    if ((io.sockets.adapter.rooms.get(code)?.size ?? 0) === 0) {
      destroyRoom(code)
    }
  }, ROOM_CLEANUP_DELAY_MS)
  roomCleanupTimers.set(code, t)
}

export function cancelRoomCleanup(code: string) {
  const existing = roomCleanupTimers.get(code)
  if (existing) {
    clearTimeout(existing)
    roomCleanupTimers.delete(code)
  }
}

// Hard TTL: destroy the room after ROOM_MAX_AGE_MS regardless of activity.
export function scheduleRoomExpiry(io: Server, code: string) {
  const t = setTimeout(() => {
    roomExpiryTimers.delete(code)
    io.to(code).emit('room_expired')
    io.socketsLeave(code)
    destroyRoom(code)
    console.log(`[room] expired room (TTL): ${code}`)
  }, ROOM_MAX_AGE_MS)
  roomExpiryTimers.set(code, t)
}
