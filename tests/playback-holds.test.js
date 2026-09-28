import assert from 'node:assert/strict'
import {test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {rolldown} from 'rolldown'
import {buildHoldTracks} from '../src/chart-viewer/playbackGeometry.js'

// Bundle JSON imports as the real viewer does, but exercise the renderer with
// a recording Canvas context in Node. No browser or network requests are used.
test('hold renderer handles native presets, mid-hold seeking, mirroring and stop/clear',async()=>{
 const bundle=await rolldown({input:fileURLToPath(new URL('../src/chart-viewer/playbackVisuals.js',import.meta.url)),define:{'import.meta.env.BASE_URL':'"/"'},logLevel:'silent'})
 const {output}=await bundle.generate({format:'esm'});await bundle.close()
 const documentBefore=globalThis.document,ImageBefore=globalThis.Image
 globalThis.document={createElement:()=>({getContext:()=>null})}
 globalThis.Image=class{width=512;height=512;set src(value){this.url=value;queueMicrotask(()=>this.onload?.())}}
 let draw
 try{
  const {loadHitEffects}=await import('data:text/javascript;base64,'+Buffer.from(output[0].code).toString('base64'))
  draw=await loadHitEffects()
  let commands=[]
  const ctx={canvas:{width:1920,height:1080},getTransform:()=>({a:1,d:1}),save(){},restore(){},beginPath(){},closePath(){},clip(){},moveTo(){},lineTo(){},drawImage(){},transform(...values){assert.ok(values.every(Number.isFinite));commands.push([...values,this.globalAlpha])}}
  const p={start:1,end:10,left:[[1,1],[1,1],[8,10],[8,10]],right:[[4,1],[4,1],[11,10],[11,10]]}
  const track=buildHoldTracks([p])[0]
  const frame=(time,mirrored=false,simple=true)=>{
   commands=[];draw.begin(ctx,960,860,108,simple);draw.hold(ctx,track,time,mirrored);draw.finish(ctx);return commands
  }
  assert.equal(frame(.99).length,0)
  const first=frame(3.25);assert.ok(first.length>0)
  frame(9);assert.deepEqual(frame(3.25),first,'seek/repeat restores the same effect state')
  assert.notDeepEqual(frame(3.25,true),first,'mirror moves the hold effect')
  assert.notDeepEqual(frame(3.25,false,false),first,'simplification applies native changes')
  assert.equal(frame(10).length,0,'hold end clears particles, including their lingering lifetime')
  track.gold=true;assert.ok(frame(5).length>0)
 }finally{
  draw?.dispose();globalThis.document=documentBefore;globalThis.Image=ImageBefore
 }
})
