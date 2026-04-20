import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import RoomApp from './RoomApp.tsx'
import { getKioskConfig } from './lib/config'

const { mode } = getKioskConfig()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {mode === 'room' ? <RoomApp /> : <App />}
  </StrictMode>,
)
