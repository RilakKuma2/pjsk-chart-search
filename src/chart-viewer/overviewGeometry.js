export const CHART_TIME_SCALE = 360
export const COLUMN_EDGE_PADDING = 32

// The overview clips rails 32 chart pixels beyond each column's time range.
// Include that same area when selecting paths, even when a hidden hold head
// starts just after the boundary (814 APPEND #72 starts one SUS tick later).
export function pathsForColumn(paths, column) {
  const padding = COLUMN_EDGE_PADDING / CHART_TIME_SCALE
  return paths.filter(path => path.end >= column.start - padding && path.start <= column.end + padding)
}
