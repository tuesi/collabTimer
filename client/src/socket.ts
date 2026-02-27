import { io } from 'socket.io-client'

const url = import.meta.env.VITE_SOCKET_URL ?? ''
export const socket = io(url, { autoConnect: true })
