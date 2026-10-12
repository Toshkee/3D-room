import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Opened by the Mac app (electron/main.mjs): leave room for the window's
// traffic lights and make the top bar a drag handle.
const shell = new URLSearchParams(location.search).get('shell')
if (shell) document.documentElement.dataset.shell = shell

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
