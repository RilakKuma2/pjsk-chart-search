export function chartPath(pathname) {
  if (/^\/custom(?:\/saved(?:\/.*)?)?\/?$/i.test(pathname)) return null
  const custom = pathname.match(/^\/custom\/([A-Za-z0-9_-]{1,128})\/?$/i)
  if (custom) return `/custom/${custom[1]}`
  const match = pathname.match(/^\/(\d+)(?:\/(easy|normal|hard|expert|master|append))?\/?$/i)
  return match ? `/${Number(match[1])}/${(match[2] || 'master').toLowerCase()}` : null
}

export function customPagePath(pathname) {
  const match = pathname.match(/^\/custom(?:\/(saved)(?:\/(official))?(?:\/([A-Za-z0-9_-]{1,128}))?)?\/?$/i)
  return match ? '/custom' + (match[1] ? '/saved' : '') + (match[2] ? '/official' : '') + (match[3] ? `/${match[3]}` : '') : null
}
