import type { Socket } from 'socket.io'
import { roomHosts, roomSettings } from '../roomLifecycle'

export function inRoom(socket: Socket, room: string): boolean {
  return socket.rooms.has(room)
}

export function isRoomHost(socket: Socket, room: string): boolean {
  return roomHosts.get(room) === socket.id && inRoom(socket, room)
}

export function canControl(socket: Socket, room: string): boolean {
  return isRoomHost(socket, room) || (inRoom(socket, room) && !!roomSettings.get(room)?.openControls)
}
