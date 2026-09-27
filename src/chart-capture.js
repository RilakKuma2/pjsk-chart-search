// Loaded by the standalone viewer only after the capture button is pressed.
export async function showCapture(blob, filename, language) {
  // The chart HTML intentionally skips Vite's React entry and refresh preamble.
  if (import.meta.env.DEV && !window.__vite_plugin_react_preamble_installed__) {
    const runtimeUrl = '/@react-refresh'
    const { default: runtime } = await import(/* @vite-ignore */ runtimeUrl)
    runtime.injectIntoGlobalHook(window)
    window.$RefreshReg$ = () => {}
    window.$RefreshSig$ = () => type => type
    window.__vite_plugin_react_preamble_installed__ = true
  }
  const { showCaptureModal } = await import('./chart-capture-modal.tsx')
  showCaptureModal(blob, filename, language)
}
