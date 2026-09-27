import { useCallback, useEffect, useRef, useState } from 'react'
import ChartSurface from './ChartSurface.jsx'
import { createChartViewer } from './engine.js'
import themes from './themes.json'
import './viewer.css'

export default function ChartViewer() {
  const host = useRef(null)
  const mounted = useRef(false)
  const captureUrl = useRef(null)
  const captureFocus = useRef(null)
  const [capture, setCapture] = useState(null)

  const closeCapture = useCallback(() => {
    setCapture(null)
    if (captureUrl.current) URL.revokeObjectURL(captureUrl.current)
    captureUrl.current = null
    captureFocus.current?.focus({ preventScroll: true })
  }, [])

  const showCapture = useCallback(async (blob, filename, language) => {
    // Load the shared editor only when a capture is requested.
    const { default: Modal } = await import('../components/CaptureModal.tsx')
    if (!mounted.current) return
    if (captureUrl.current) URL.revokeObjectURL(captureUrl.current)
    const url = URL.createObjectURL(blob)
    captureUrl.current = url
    captureFocus.current = document.activeElement
    setCapture({ Modal, url, filename, language })
  }, [])

  useEffect(() => {
    mounted.current = true
    const dispose = createChartViewer(host.current, { themes, onCapture: showCapture })
    return () => {
      mounted.current = false
      dispose()
      if (captureUrl.current) URL.revokeObjectURL(captureUrl.current)
      captureUrl.current = null
    }
  }, [showCapture])

  return <>
    <ChartSurface hostRef={host} />
    {capture && <div className="chart-capture-root" style={{ colorScheme: 'light' }}>
      <capture.Modal isOpen isCaptureLoading={false} language={capture.language}
        capturePreviewUrl={capture.url} captureFileName={capture.filename} onClose={closeCapture} />
    </div>}
  </>
}
