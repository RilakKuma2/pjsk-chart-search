import test from 'node:test'
import assert from 'node:assert/strict'
import { CHART_TIME_SCALE, COLUMN_EDGE_PADDING, pathsForColumn } from '../src/chart-viewer/overviewGeometry.js'

test('814 APPEND #72 keeps the hidden-head green rail alongside the gold guide in both columns', () => {
  // Values from the original SUS and published JSON. The normal hold starts
  // 1/1920 bar after the guide; there is deliberately no visible green head.
  const column = { start: 74.414948, end: 78.239649 }
  const guide = { start: 78.239649, end: 78.717239, gold: true, guide: true }
  const hold = { start: 78.240147, end: 78.718235, gold: false, guide: false }
  assert.ok((hold.start - column.end) * CHART_TIME_SCALE < COLUMN_EDGE_PADDING)
  assert.deepEqual(pathsForColumn([guide, hold], column), [guide, hold])
  assert.deepEqual(pathsForColumn([guide, hold], { start: column.end, end: 82.06435 }), [guide, hold])
})

test('both column margins include visible rails while more distant rails remain excluded', () => {
  const column = { start: 10, end: 14 }, padding = COLUMN_EDGE_PADDING / CHART_TIME_SCALE
  const incoming = { start: 9, end: 10 - padding / 2 }
  const outgoing = { start: 14 + padding / 2, end: 15 }
  const before = { start: 8, end: 10 - padding - .0001 }
  const after = { start: 14 + padding + .0001, end: 16 }
  const crossing = { start: 9, end: 15 }
  assert.deepEqual(pathsForColumn([before, incoming, crossing, outgoing, after], column), [incoming, crossing, outgoing])
})
