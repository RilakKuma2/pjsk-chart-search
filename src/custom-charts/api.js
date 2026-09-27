export const CUSTOM_API = (import.meta.env.VITE_CUSTOM_CHART_API || 'https://custom2.rilaksekai.com').replace(/\/$/, '')
export const customChartUrl = code => `/custom/${encodeURIComponent(code)}`
export async function customRequest(path, signal) {
  const response = await fetch(`${CUSTOM_API}${path}`, { signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`)
  return data
}
