import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SocketProvider } from './context/SocketContext'
import Home from './pages/Home/Home'
import Timer from './pages/Timer/Timer'

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/timer/:code" element={<Timer />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  )
}
