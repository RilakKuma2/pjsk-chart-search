import React from 'react'
import { createRoot } from 'react-dom/client'
import CaptureModal from './components/CaptureModal'

export function showCaptureModal(blob: Blob, filename: string, language: 'ko' | 'en' | 'ja' = 'ko') {
  const host = document.createElement('div')
  host.className = 'chart-capture-root'
  host.style.colorScheme = 'light'
  document.body.append(host)
  const root = createRoot(host)
  const url = URL.createObjectURL(blob)
  const previousFocus = document.activeElement as HTMLElement | null
  const close = () => {
    root.unmount()
    host.remove()
    URL.revokeObjectURL(url)
    previousFocus?.focus({ preventScroll: true })
  }
  root.render(<CaptureModal language={language} isOpen isCaptureLoading={false} capturePreviewUrl={url}
    captureFileName={filename} onClose={close} />)
}
