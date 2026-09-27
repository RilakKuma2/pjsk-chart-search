export function chartPath(pathname) {
  const match = pathname.match(/^\/(\d+)(?:\/(easy|normal|hard|expert|master|append))?\/?$/i)
  return match ? `/${Number(match[1])}/${(match[2] || 'master').toLowerCase()}` : null
}
