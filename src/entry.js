import { chartPath } from './chart-route.js'

// Static hosts may return this entry for every URL. Never import the search app
// on chart routes, even when the host has no dedicated rewrite rule.
const path = chartPath(location.pathname)
if (path) {
  if (path !== location.pathname) {
    location.replace(path + location.search + location.hash)
  } else {
    import('./chart-entry.js').then(({ openChart }) => openChart()).catch(error => {
      document.body.textContent = `채보 페이지를 불러오지 못했어요. 새로고침해 주세요. (${error.message})`
    })
  }
} else {
  import('./main.jsx')
}
