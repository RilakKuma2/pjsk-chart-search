import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chartPath } from '../src/chart-route.js'

export function chartRoutes() {
  let outDir, isBuild, themePath
  const middleware = (req, res, next) => {
    const url = new URL(req.url, 'http://localhost')
    const path = chartPath(url.pathname)
    if (path && path !== url.pathname) {
      res.writeHead(302, { Location: path + url.search })
      return res.end()
    }
    // Vite's normal HTML handling supplies the React refresh preamble in dev.
    // The entry dispatcher imports only the component for this URL.
    if (path) req.url = '/index.html' + url.search
    next()
  }
  return {
    name: 'chart-routes',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      isBuild = config.command === 'build'
      themePath = resolve(config.root, 'src/chart-viewer/themes.json')
    },
    transformIndexHtml() {
      // Paint the route's theme before React, stylesheets or chart data arrive.
      // Derive colors from the renderer's presets to keep them in sync.
      const themes = JSON.parse(readFileSync(themePath, 'utf8'))
      const backgrounds = Object.fromEntries(Object.entries(themes).map(([name, theme]) => [name, theme['.background'].fill]))
      return [{
        tag: 'script', injectTo: 'head-prepend',
        children: `(() => {
          ${chartPath.toString()}
          const path = chartPath(location.pathname);
          if (!path) return;
          const colors = ${JSON.stringify(backgrounds)};
          const color = colors[path.split('/').pop().toUpperCase()] || colors.MASTER;
          document.documentElement.style.setProperty('--chart-background', color);
          document.documentElement.style.backgroundColor = 'var(--chart-background)';
        })();`,
      }]
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Compatibility entry for the older standalone local prototype.
        if (req.url?.split('?')[0] === '/chart-capture.js') req.url = '/src/chart-capture.js'
        next()
      })
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
    closeBundle() {
      if (!isBuild) return
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
      // Keep existing numeric-route Nginx rewrites working after this migration.
      mkdirSync(resolve(outDir, 'chart-viewer'), { recursive: true })
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, 'chart-viewer/index.html'))
    },
  }
}
