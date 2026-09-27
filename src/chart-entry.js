import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import ChartViewer from './chart-viewer/ChartViewer.jsx'

export function openChart() {
  const root = createRoot(document.getElementById('root'))
  root.render(createElement(ChartViewer))
  if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
}
