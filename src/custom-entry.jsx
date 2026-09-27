import { createRoot } from 'react-dom/client'
import CustomCharts from './custom-charts/CustomCharts.jsx'
const root = createRoot(document.getElementById('root'))
root.render(<CustomCharts />)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
