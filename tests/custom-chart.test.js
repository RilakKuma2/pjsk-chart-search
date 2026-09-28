import assert from 'node:assert/strict'
import {test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {rolldown} from 'rolldown'
import {buildHoldTracks,alignConnectionNotes} from '../src/chart-viewer/playbackGeometry.js'

test('custom code suggestions are local, exact-length ASCII checks preserving case',async()=>{
 const bundle=await rolldown({input:fileURLToPath(new URL('../src/custom-charts/api.js',import.meta.url)),define:{'import.meta.env.VITE_CUSTOM_CHART_API':'undefined'},logLevel:'silent'})
 const {output}=await bundle.generate({format:'esm'});await bundle.close()
 const before=globalThis.fetch
 globalThis.fetch=()=>{throw Error('Suggestion must not fetch a custom chart')}
 try{
  const {isCustomChartCode,customChartUrl}=await import('data:text/javascript;base64,'+Buffer.from(output[0].code).toString('base64'))
  const code='xk8nt849r4drm_5vnibfymqya6gx'
  assert.equal(isCustomChartCode(code),true)
  assert.equal(isCustomChartCode(code.toUpperCase()),true)
  for(const value of [code.slice(1),code+'a','가'.repeat(28),'!'.repeat(28),code.replace('_','/'),code+'\n'])assert.equal(isCustomChartCode(value),false,value)
  assert.equal(customChartUrl(code.toUpperCase()),'/custom/'+code.toUpperCase())
 }finally{globalThis.fetch=before}
})
test('native hold IDs keep touching independent holds separate',()=>{
 const segment=(start,end,id)=>({start,end,holdId:id,left:[[0,start],[0,start],[0,end],[0,end]],right:[[3,start],[3,start],[3,end],[3,end]]})
 const tracks=buildHoldTracks([segment(0,1,1),segment(1,2,1),segment(0,1,2),segment(1,2,2)])
 assert.equal(tracks.length,2)
 assert.ok(tracks.every(t=>t.segments.length===2&&t.end===2))
 const native={nativeId:5,kind:'tick',t:.5,lane:1.25,width:3}
 assert.deepEqual(alignConnectionNotes([native],[segment(0,1,1)]),[native],'do not quantize native fractional marker positions')
})
