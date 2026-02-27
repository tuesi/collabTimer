import type { Server, Socket } from 'socket.io'
import { customAlphabet } from 'nanoid'
import { generateUniqueCode } from './helpers/generateCode'
import { isRoomHost, canControl } from './helpers/roomAuth'
import { joinLimiter, timerLimiter } from './helpers/rateLimiter'
import {
  MAX_ROOMS,
  MAX_USERS_PER_ROOM,
  activeCodes,
  socketToCode,
  roomHosts,
  roomHostTokens,
  roomTimers,
  roomSettings,
  createTimer,
  scheduleRoomCleanup,
  cancelRoomCleanup,
  scheduleRoomExpiry,
} from './roomLifecycle'

const generateToken = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 32)

function registerRoomHandlers(io: Server, socket: Socket) {
  socket.on('create_room', () => {
    if (socketToCode.has(socket.id)) {
      socket.emit('error', 'already_has_room')
      return
    }
    if (activeCodes.size >= MAX_ROOMS) {
      socket.emit('error', 'server_full')
      return
    }
    const code = generateUniqueCode(activeCodes)
    const hostToken = generateToken()
    activeCodes.add(code)
    socketToCode.set(socket.id, code)
    roomHosts.set(code, socket.id)
    roomHostTokens.set(code, hostToken)
    roomTimers.set(code, createTimer())
    roomSettings.set(code, { openControls: false })
    scheduleRoomExpiry(io, code)
    socket.join(code)
    socket.emit('room_created', { code, hostToken })
    console.log(`[socket] ${socket.id} created room: ${code}`)
  })

  socket.on('join', (room: string) => {
    if (!joinLimiter.allow(socket.id)) return
    if (!activeCodes.has(room)) {
      socket.emit('room_not_found')
      return
    }
    const roomSize = io.sockets.adapter.rooms.get(room)?.size ?? 0
    if (roomSize >= MAX_USERS_PER_ROOM) {
      socket.emit('room_full')
      return
    }
    cancelRoomCleanup(room)
    socket.join(room)
    const timer = roomTimers.get(room)
    if (timer) socket.emit('timer_state', timer)
    const settings = roomSettings.get(room)
    if (settings) socket.emit('room_settings', settings)
    const isHost = roomHosts.get(room) === socket.id
    socket.emit('room_role', { isHost })
    console.log(`[socket] ${socket.id} joined room: ${room} (host: ${isHost})`)
  })

  socket.on('leave', (room: string) => {
    socket.leave(room)
    console.log(`[socket] ${socket.id} left room: ${room}`)
  })

  socket.on('timer_start', (room: string) => {
    if (!timerLimiter.allow(socket.id)) return
    if (!canControl(socket, room)) return
    const timer = roomTimers.get(room)
    if (!timer || timer.state === 'running') return
    timer.startedAt = Date.now()
    timer.state = 'running'
    io.to(room).emit('timer_state', timer)
  })

  socket.on('timer_pause', (room: string) => {
    if (!timerLimiter.allow(socket.id)) return
    if (!canControl(socket, room)) return
    const timer = roomTimers.get(room)
    if (!timer || timer.state !== 'running' || timer.startedAt === null) return
    timer.elapsed += Date.now() - timer.startedAt
    timer.startedAt = null
    timer.state = 'paused'
    io.to(room).emit('timer_state', timer)
  })

  socket.on('timer_reset', (room: string) => {
    if (!timerLimiter.allow(socket.id)) return
    if (!isRoomHost(socket, room)) return
    const timer = roomTimers.get(room)
    if (!timer) return
    timer.elapsed = 0
    timer.startedAt = null
    timer.state = 'idle'
    io.to(room).emit('timer_state', timer)
  })

  socket.on('timer_set_duration', (room: string, duration: number) => {
    if (!timerLimiter.allow(socket.id)) return
    if (!isRoomHost(socket, room)) return
    const timer = roomTimers.get(room)
    if (!timer) return
    timer.duration = duration
    timer.elapsed = 0
    timer.startedAt = null
    timer.state = 'idle'
    io.to(room).emit('timer_state', timer)
  })

  socket.on('set_open_controls', (room: string, value: boolean) => {
    if (!isRoomHost(socket, room)) return
    const settings = roomSettings.get(room)
    if (!settings) return
    settings.openControls = value
    io.to(room).emit('room_settings', settings)
  })

  socket.on('claim_host', ({ code, token }: { code: string; token: string }) => {
    if (!activeCodes.has(code)) return
    if (roomHostTokens.get(code) !== token) return
    cancelRoomCleanup(code)
    const oldHostId = roomHosts.get(code)
    if (oldHostId) socketToCode.delete(oldHostId)
    roomHosts.set(code, socket.id)
    socketToCode.set(socket.id, code)
    socket.join(code)
    const timer = roomTimers.get(code)
    if (timer) socket.emit('timer_state', timer)
    const settings = roomSettings.get(code)
    if (settings) socket.emit('room_settings', settings)
    socket.emit('room_role', { isHost: true })
    console.log(`[socket] ${socket.id} reclaimed host for room: ${code}`)
  })

  // Use 'disconnecting' so socket.rooms is still populated — this covers
  // both host and non-host sockets leaving a room empty.
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room === socket.id || !activeCodes.has(room)) continue
      const roomSize = io.sockets.adapter.rooms.get(room)?.size ?? 0
      if (roomSize <= 1) scheduleRoomCleanup(io, room)  // <=1: this socket still counted
    }
    const code = socketToCode.get(socket.id)
    if (code) {
      socketToCode.delete(socket.id)
      roomHosts.delete(code)
    }
  })

  socket.on('disconnect', () => {
    joinLimiter.remove(socket.id)
    timerLimiter.remove(socket.id)
    console.log(`[socket] disconnected: ${socket.id}`)
  })
}

export function registerRooms(io: Server) {
  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`)
    registerRoomHandlers(io, socket)
  })
}
