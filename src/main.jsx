import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Search-page resources are loaded only after the route dispatcher chooses it.
for (const attributes of [
  { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;900&display=swap' },
  { rel: 'manifest', href: '/manifest.json' },
  { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
]) {
  const link = document.createElement('link')
  Object.assign(link, attributes)
  document.head.append(link)
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(error => console.warn('SW registration failed', error))
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
