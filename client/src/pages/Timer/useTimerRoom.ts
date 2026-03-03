import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../context/SocketContext'

type ServerTimerState = {
  duration: number
  elapsed: number
  startedAt: number | null
  state: 'idle' | 'running' | 'paused'
}

const DEFAULT_SECONDS = 300

export function useTimerRoom(code: string | undefined) {
  const { socket } = useSocket()
  const navigate = useNavigate()
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_SECONDS)
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SECONDS)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [openControls, setOpenControls] = useState(false)
  const [userCount, setUserCount] = useState<number | null>(null)
  const [roomAlert, setRoomAlert] = useState<string | null>(null)
  const serverTimerRef = useRef<ServerTimerState | null>(null)
  const roomAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Display interval that recomputes timeLeft from server timestamps
  useEffect(() => {
    const interval = setInterval(() => {
      const s = serverTimerRef.current
      if (s?.state === 'running' && s.startedAt !== null) {
        const ms = s.duration * 1000 - (s.elapsed + (Date.now() - s.startedAt))
        setTimeLeft(Math.max(0, Math.ceil(ms / 1000)))
      }
    }, 100)
    return () => clearInterval(interval)
  }, [code])

  // Sync state from server
  useEffect(() => {
    function applyServerState(state: ServerTimerState) {
      serverTimerRef.current = state
      setTotalSeconds(state.duration)
      setIsRunning(state.state === 'running')
      setIsPaused(state.state === 'paused')
      const ms = state.state === 'running' && state.startedAt !== null
        ? state.duration * 1000 - (state.elapsed + (Date.now() - state.startedAt))
        : state.duration * 1000 - state.elapsed
      setTimeLeft(Math.max(0, Math.ceil(ms / 1000)))
    }

    function applyRole({ isHost }: { isHost: boolean }) {
      setIsHost(isHost)
    }

    function applySettings({ openControls }: { openControls: boolean }) {
      setOpenControls(openControls)
    }

    function handleRoomNotFound() {
      localStorage.removeItem('host_session')
      navigate('/')
    }

    function showAlert(msg: string) {
      setRoomAlert(msg)
      if (roomAlertTimerRef.current) clearTimeout(roomAlertTimerRef.current)
      roomAlertTimerRef.current = setTimeout(() => setRoomAlert(null), 3000)
    }

    function handleUserJoined() { showAlert('New user joined') }
    function handleUserLeft() { showAlert('User left') }

    socket.emit('join', code)
    const raw = localStorage.getItem('host_session')
    const session = raw ? JSON.parse(raw) : null
    if (session?.code === code) socket.emit('claim_host', { code, token: session.token })

    socket.on('timer_state', applyServerState)
    socket.on('room_role', applyRole)
    socket.on('room_settings', applySettings)
    socket.on('room_not_found', handleRoomNotFound)
    socket.on('user_count', setUserCount)
    socket.on('user_joined', handleUserJoined)
    socket.on('user_left', handleUserLeft)

    return () => {
      socket.emit('leave', code)
      socket.off('timer_state', applyServerState)
      socket.off('room_role', applyRole)
      socket.off('room_settings', applySettings)
      socket.off('room_not_found', handleRoomNotFound)
      socket.off('user_count', setUserCount)
      socket.off('user_joined', handleUserJoined)
      socket.off('user_left', handleUserLeft)
      if (roomAlertTimerRef.current) clearTimeout(roomAlertTimerRef.current)
    }
  }, [code, socket, navigate])

  function toggleTimer() {
    socket.emit(isRunning ? 'timer_pause' : 'timer_start', code)
  }

  function handleReset() {
    socket.emit('timer_reset', code)
  }

  function setDuration(seconds: number) {
    socket.emit('timer_set_duration', code, seconds)
    setTimeLeft(seconds)
    setTotalSeconds(seconds)
  }

  function setOpenControlsEnabled(value: boolean) {
    socket.emit('set_open_controls', code, value)
  }

  return {
    timeLeft,
    totalSeconds,
    isRunning,
    isPaused,
    isHost,
    openControls,
    userCount,
    roomAlert,
    toggleTimer,
    handleReset,
    setDuration,
    setOpenControlsEnabled,
  }
}
