import { useState, useLayoutEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { FaPlay, FaPause, FaRedo, FaCheck, FaCog, FaTimes } from 'react-icons/fa'
import { FiCopy, FiEdit } from 'react-icons/fi'
import styles from './Timer.module.scss'
import { createTimerHandlers } from './Timer.handlers'
import type { EditField } from './Timer.handlers'
import { useTimerRoom } from './useTimerRoom'

const RADIUS = 140
const STROKE = 8
const r = RADIUS - STROKE / 2
const CIRCUMFERENCE = 2 * Math.PI * r

export default function Timer() {
  const { code } = useParams<{ code: string }>()

  const {
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
  } = useTimerRoom(code)

  const [editingField, setEditingField] = useState<EditField | null>(null)
  const [editHours, setEditHours] = useState('')
  const [editMinutes, setEditMinutes] = useState('')
  const [editSeconds, setEditSeconds] = useState('')
  const switchingFieldRef = useRef(false)
  const cursorAtStartRef = useRef(false)
  const hoursInputRef = useRef<HTMLInputElement>(null)
  const minutesInputRef = useRef<HTMLInputElement>(null)
  const secondsInputRef = useRef<HTMLInputElement>(null)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const hours = Math.floor(timeLeft / 3600)
  const minutes = Math.floor((timeLeft % 3600) / 60)
  const seconds = timeLeft % 60

  useLayoutEffect(() => {
    if (editingField === null) return
    const ref = { hours: hoursInputRef, minutes: minutesInputRef, seconds: secondsInputRef }[editingField]
    const input = ref.current
    if (!input) return
    if (cursorAtStartRef.current) {
      input.setSelectionRange(0, 0)
    }
  }, [editingField])

  const {
    startEditing,
    handleTimepartMouseDown,
    handleWrapperBlur,
    handleHoursKeyDown,
    handleMinutesKeyDown,
    handleSecondsKeyDown,
    copyCode,
  } = createTimerHandlers({
    code, isHost, isRunning, isPaused,
    editingField, editHours, editMinutes, editSeconds,
    hours, minutes, seconds,
    setEditingField, setEditHours, setEditMinutes, setEditSeconds, setCopied,
    switchingFieldRef, cursorAtStartRef,
    setDuration,
  })

  const progress = timeLeft / totalSeconds
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress)
  const size = RADIUS * 2

  const isFinished = timeLeft === 0
  const canEdit = isHost && !isRunning && !isPaused
  const canControl = isHost || openControls
  const isEditing = editingField !== null

  return (
    <div className={styles.wrapper}>
      {roomAlert && (
        <div className={styles.joinAlert}>{roomAlert}</div>
      )}
      {userCount !== null && (
        <span className={styles.userCount}>Joined {userCount}</span>
      )}
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
                  onChange={e => setOpenControlsEnabled(e.target.checked)}
                />
                <span className={styles.toggleSlider} />
              </div>
            </label>
          </div>
        </div>
      )}
      <div className={styles.timerContainer} style={{ width: size, height: size }}>
        <svg width={size} height={size} shapeRendering="geometricPrecision">
          <circle
            className={styles.ring}
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            r={r}
            cx={RADIUS}
            cy={RADIUS}
          />
        </svg>
        <div className={styles.timeDisplayWrapper}>
          {canEdit && (
            <FiEdit className={styles.editHint} />
          )}
          <div
            className={styles.timeDisplay}
            onBlur={isEditing ? handleWrapperBlur : undefined}
          >
            <span className={styles.timePart}>
              {editingField === 'hours' ? (
                <input
                  ref={hoursInputRef}
                  className={styles.timeInput}
                  value={editHours}
                  onChange={e => setEditHours(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onKeyDown={handleHoursKeyDown}
                  autoFocus
                />
              ) : (
                <span
                  className={canEdit ? styles.editablePart : ''}
                  onMouseDown={() => handleTimepartMouseDown('hours')}
                  onClick={() => startEditing('hours')}
                >
                  {isEditing ? editHours.padStart(2, '0') : String(hours).padStart(2, '0')}
                </span>
              )}
            </span>
            <span>:</span>
            <span className={styles.timePart}>
              {editingField === 'minutes' ? (
                <input
                  ref={minutesInputRef}
                  className={styles.timeInput}
                  value={editMinutes}
                  onChange={e => setEditMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onKeyDown={handleMinutesKeyDown}
                  autoFocus
                />
              ) : (
                <span
                  className={canEdit ? styles.editablePart : ''}
                  onMouseDown={() => handleTimepartMouseDown('minutes')}
                  onClick={() => startEditing('minutes')}
                >
                  {isEditing ? editMinutes.padStart(2, '0') : String(minutes).padStart(2, '0')}
                </span>
              )}
            </span>
            <span>:</span>
            <span className={styles.timePart}>
              {editingField === 'seconds' ? (
                <input
                  ref={secondsInputRef}
                  className={styles.timeInput}
                  value={editSeconds}
                  onChange={e => setEditSeconds(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onKeyDown={handleSecondsKeyDown}
                  autoFocus
                />
              ) : (
                <span
                  className={canEdit ? styles.editablePart : ''}
                  onMouseDown={() => handleTimepartMouseDown('seconds')}
                  onClick={() => startEditing('seconds')}
                >
                  {isEditing ? editSeconds.padStart(2, '0') : String(seconds).padStart(2, '0')}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
      {canControl && (isPaused ? (
        <div className={styles.pausedButtons}>
          <button className={styles.startButton} onClick={toggleTimer}>
            <FaPlay className={styles.playIcon} />
          </button>
          {isHost && (
            <button className={styles.startButton} onClick={handleReset}>
              <FaRedo />
            </button>
          )}
        </div>
      ) : (
        <button className={styles.startButton} onClick={isFinished ? handleReset : toggleTimer}>
          {isFinished ? <FaRedo /> : isRunning ? <FaPause /> : <FaPlay className={styles.playIcon} />}
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
