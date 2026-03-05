import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../context/SocketContext'
import styles from './Home.module.scss'

export default function Home() {
  const [code, setCode] = useState('')
  const navigate = useNavigate()
  const { socket } = useSocket()

  function handleCreate() {
    socket.emit('create_room')
    socket.once('room_created', ({ code, hostToken }: { code: string; hostToken: string }) => {
      localStorage.setItem('host_session', JSON.stringify({ code, token: hostToken }))
      navigate(`/timer/${code}`)
    })
  }

  function handleJoin() {
    const trimmed = code.trim()
    if (trimmed) {
      navigate(`/timer/${trimmed}`)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleJoin()
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Collab Timer</h1>
        <p className={styles.subtitle}>A timer you can share</p>
      </div>
      <button className={styles.createButton} onClick={handleCreate}>
        Create Timer
      </button>
      <div className={styles.divider}>
        <span>or</span>
      </div>
      <div className={styles.joinSection}>
        <input
          className={styles.codeInput}
          type="text"
          placeholder="Enter code"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
        />
        <button
          className={styles.joinButton}
          onClick={handleJoin}
          disabled={!code.trim()}
        >
          Join
        </button>
      </div>
    </div>
  )
}
