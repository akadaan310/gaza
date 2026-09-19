import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (import.meta.env.DEV) {
  import('./store/worldStore').then(({ useWorldStore }) => {
    // @ts-expect-error debug-only global, dead-code-eliminated from prod builds
    window.__gazaStore = useWorldStore
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
