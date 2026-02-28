import React from 'react'
import type { RefObject } from 'react'

export type EditField = 'hours' | 'minutes' | 'seconds'

export interface TimerHandlerDeps {
  code: string | undefined
  isHost: boolean
  isRunning: boolean
  isPaused: boolean
  editingField: EditField | null
  editHours: string
  editMinutes: string
  editSeconds: string
  hours: number
  minutes: number
  seconds: number
  setEditingField: (field: EditField | null) => void
  setEditHours: (v: string) => void
  setEditMinutes: (v: string) => void
  setEditSeconds: (v: string) => void
  setCopied: (v: boolean) => void
  switchingFieldRef: RefObject<boolean>
  cursorAtStartRef: RefObject<boolean>
  setDuration: (seconds: number) => void
}

export function createTimerHandlers(deps: TimerHandlerDeps) {
  const {
    code, isHost, isRunning, isPaused,
    editingField, editHours, editMinutes, editSeconds,
    hours, minutes, seconds,
    setEditingField, setEditHours, setEditMinutes, setEditSeconds, setCopied,
    switchingFieldRef, cursorAtStartRef,
    setDuration,
  } = deps

  function startEditing(field: EditField) {
    if (!isHost || isRunning || isPaused) return
    if (editingField === null) {
      setEditHours(String(hours).padStart(2, '0'))
      setEditMinutes(String(minutes).padStart(2, '0'))
      setEditSeconds(String(seconds).padStart(2, '0'))
    }
    setEditingField(field)
  }

  function handleTimepartMouseDown(field: EditField) {
    if (editingField !== null && editingField !== field) {
      switchingFieldRef.current = true
      setTimeout(() => { switchingFieldRef.current = false }, 0)
    }
  }

  function commitEdit() {
    const hrs = Math.min(parseInt(editHours || '0', 10), 99)
    const mins = Math.min(parseInt(editMinutes || '0', 10), 59)
    const secs = Math.min(parseInt(editSeconds || '0', 10), 59)
    if (!isNaN(hrs) && !isNaN(mins) && !isNaN(secs)) {
      const total = hrs * 3600 + mins * 60 + secs
      if (total > 0) {
        setDuration(total)
      }
    }
    setEditingField(null)
  }

  function switchField(to: EditField, cursorAtStart = false) {
    switchingFieldRef.current = true
    cursorAtStartRef.current = cursorAtStart
    setEditingField(to)
    setTimeout(() => { switchingFieldRef.current = false }, 0)
  }

  function handleWrapperBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (switchingFieldRef.current) return
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      commitEdit()
    }
  }

  function handleHoursKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      commitEdit()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      switchField('minutes', true)
    } else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
      e.preventDefault()
      switchField('minutes', true)
    } else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
      e.preventDefault()
      switchField('seconds')
    } else if (e.key === 'Escape') {
      setEditingField(null)
    }
  }

  function handleMinutesKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      commitEdit()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      switchField('seconds', true)
    } else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
      e.preventDefault()
      switchField('seconds', true)
    } else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
      e.preventDefault()
      switchField('hours')
    } else if (e.key === 'Escape') {
      setEditingField(null)
    }
  }

  function handleSecondsKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      commitEdit()
    } else if (e.key === 'Escape') {
      setEditingField(null)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      switchField('hours', true)
    } else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
      e.preventDefault()
      switchField('hours', true)
    } else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
      e.preventDefault()
      switchField('minutes')
    }
  }

  function copyCode() {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return {
    startEditing,
    handleTimepartMouseDown,
    commitEdit,
    switchField,
    handleWrapperBlur,
    handleHoursKeyDown,
    handleMinutesKeyDown,
    handleSecondsKeyDown,
    copyCode,
  }
}
