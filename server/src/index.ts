import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { registerRooms } from './rooms'

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
})

// Limit concurrent Socket.IO connections per IP to prevent connection flooding.
const MAX_CONNECTIONS_PER_IP = 20
const connectionsByIp = new Map<string, number>()

io.use((socket, next) => {
  const ip = socket.handshake.address
  const count = connectionsByIp.get(ip) ?? 0
  if (count >= MAX_CONNECTIONS_PER_IP) {
    return next(new Error('too_many_connections'))
  }
  connectionsByIp.set(ip, count + 1)
  socket.on('disconnect', () => {
    const current = connectionsByIp.get(ip) ?? 1
    if (current <= 1) connectionsByIp.delete(ip)
    else connectionsByIp.set(ip, current - 1)
  })
  next()
})

const PORT = process.env.PORT ?? 3001

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

registerRooms(io)

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
