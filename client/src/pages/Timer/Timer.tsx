import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FaPlay, FaPause, FaRedo, FaCheck, FaCog, FaTimes } from 'react-icons/fa'
import { FiCopy } from 'react-icons/fi'
import { useSocket } from '../../context/SocketContext'
import styles from './Timer.module.scss'

const RADIUS = 140
const STROKE = 8
const r = RADIUS - STROKE / 2
const CIRCUMFERENCE = 2 * Math.PI * r

const DEFAULT_SECONDS = 300

type ServerTimerState = {
  duration: number
  elapsed: number
  startedAt: number | null
  state: 'idle' | 'running' | 'paused'
}

export default function Timer() {
  const { code } = useParams<{ code: string }>()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_SECONDS)
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SECONDS)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [openControls, setOpenControls] = useState(false)
  const [editingField, setEditingField] = useState<'minutes' | 'seconds' | null>(null)
  const [editMinutes, setEditMinutes] = useState('')
  const [editSeconds, setEditSeconds] = useState('')
  const switchingFieldRef = useRef(false)
  const serverTimerRef = useRef<ServerTimerState | null>(null)

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

    socket.emit('join', code)
    const raw = localStorage.getItem('host_session')
    const session = raw ? JSON.parse(raw) : null
    if (session?.code === code) socket.emit('claim_host', { code, token: session.token })
    socket.on('timer_state', applyServerState)
    socket.on('room_role', applyRole)
    socket.on('room_settings', applySettings)
    socket.on('room_not_found', handleRoomNotFound)

    return () => {
      socket.emit('leave', code)
      socket.off('timer_state', applyServerState)
      socket.off('room_role', applyRole)
      socket.off('room_settings', applySettings)
      socket.off('room_not_found', handleRoomNotFound)
    }
  }, [code, socket])

  const progress = timeLeft / totalSeconds
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress)

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  const size = RADIUS * 2

  function startEditing(field: 'minutes' | 'seconds') {
    if (!isHost || isRunning || isPaused) return
    setEditMinutes(String(minutes).padStart(2, '0'))
    setEditSeconds(String(seconds).padStart(2, '0'))
    setEditingField(field)
  }

  function commitEdit() {
    const mins = Math.min(parseInt(editMinutes || '0', 10), 99)
    const secs = Math.min(parseInt(editSeconds || '0', 10), 59)
    if (!isNaN(mins) && !isNaN(secs)) {
      const total = mins * 60 + secs
      if (total > 0) {
        socket.emit('timer_set_duration', code, total)
      }
    }
    setEditingField(null)
  }

  // Flag the transition so handleWrapperBlur doesn't commit mid-switch
  function switchField(to: 'minutes' | 'seconds') {
    switchingFieldRef.current = true
    setEditingField(to)
    setTimeout(() => { switchingFieldRef.current = false }, 0)
  }

  function handleWrapperBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (switchingFieldRef.current) return
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      commitEdit()
    }
  }

  function handleMinutesKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      commitEdit()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      switchField('seconds')
    } else if (e.key === 'Escape') {
      setEditingField(null)
    }
  }

  function handleSecondsKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      commitEdit()
    } else if (e.key === 'Escape') {
      setEditingField(null)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      switchField('minutes')
    }
  }

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyCode() {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const isFinished = timeLeft === 0
  const canEdit = isHost && !isRunning && !isPaused
  const canControl = isHost || openControls
  const isEditing = editingField !== null

  function toggleTimer() {
    socket.emit(isRunning ? 'timer_pause' : 'timer_start', code)
  }

  function handleReset() {
    socket.emit('timer_reset', code)
  }

  return (
    <div className={styles.wrapper}>
      {isHost && (
        <button className={styles.cogButton} onClick={() => setSettingsOpen(true)} title="Settings">
          <FaCog />
        </button>
      )}
      {settingsOpen && (
        <div className={styles.modalOverlay} onClick={() => setSettingsOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>Settings</span>
              <button className={styles.modalClose} onClick={() => setSettingsOpen(false)}>
                <FaTimes />
              </button>
            </div>
            <label className={styles.settingRow}>
              <span>Allow anyone to control timer</span>
              <div className={styles.toggleWrapper}>
                <input
                  type="checkbox"
                  checked={openControls}
                  onChange={e => socket.emit('set_open_controls', code, e.target.checked)}
                />
                <span className={styles.toggleSlider} />
              </div>
            </label>
          </div>
        </div>
      )}
      <div className={styles.timerContainer} style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            className={styles.ring}
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            r={r}
            cx={RADIUS}
            cy={RADIUS}
          />
        </svg>
        <div
          className={styles.timeDisplay}
          onBlur={isEditing ? handleWrapperBlur : undefined}
        >
          <span className={styles.timePart}>
            {editingField === 'minutes' ? (
              <input
                className={styles.timeInput}
                value={editMinutes}
                onChange={e => setEditMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))}
                onKeyDown={handleMinutesKeyDown}
                autoFocus
              />
            ) : (
              <span
                className={canEdit ? styles.editablePart : ''}
                onClick={() => startEditing('minutes')}
              >
                {String(minutes).padStart(2, '0')}
              </span>
            )}
          </span>
          <span>:</span>
          <span className={styles.timePart}>
            {editingField === 'seconds' ? (
              <input
                className={styles.timeInput}
                value={editSeconds}
                onChange={e => setEditSeconds(e.target.value.replace(/\D/g, '').slice(0, 2))}
                onKeyDown={handleSecondsKeyDown}
                autoFocus
              />
            ) : (
              <span
                className={canEdit ? styles.editablePart : ''}
                onClick={() => startEditing('seconds')}
              >
                {String(seconds).padStart(2, '0')}
              </span>
            )}
          </span>
        </div>
      </div>
      {canControl && (isPaused ? (
        <div className={styles.pausedButtons}>
          <button className={styles.startButton} onClick={toggleTimer}>
            <FaPlay />
          </button>
          {isHost && (
            <button className={styles.startButton} onClick={handleReset}>
              <FaRedo />
            </button>
          )}
        </div>
      ) : (
        <button className={styles.startButton} onClick={isFinished ? handleReset : toggleTimer}>
          {isFinished ? <FaRedo /> : isRunning ? <FaPause /> : <FaPlay />}
        </button>
      ))}
      {code && (
        <div className={styles.roomCode}>
          Room code: <span>{code}</span>
          <button className={styles.copyButton} onClick={copyCode} title="Copy room code">
            {copied ? <FaCheck /> : <FiCopy />}
          </button>
        </div>
      )}
    </div>
  )
}
