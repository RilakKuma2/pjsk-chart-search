import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {nativeWorldUnit,projectEffectPoint,effectLaneX,spriteClipQuad,clipToSpriteUV} from '../src/chart-viewer/playbackProjection.js'
import {coverProgress,SPAWN_Y,JUDGMENT_Y,buildHoldTracks,holdSpanAt} from '../src/chart-viewer/playbackGeometry.js'
const layout=JSON.parse(readFileSync(new URL('../src/chart-viewer/playbackLayout.json',import.meta.url)))
const effects=JSON.parse(readFileSync(new URL('../src/chart-viewer/playbackEffects.json',import.meta.url)))
const near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`)
test('native camera framing preserves 16:9 height and fits width on 4:3',()=>{
 near(nativeWorldUnit(1920,1080),108);near(nativeWorldUnit(1440,1080),81);near(nativeWorldUnit(2400,1080),108)
 assert.equal(layout.camera.width,1920/108);assert.equal(layout.camera.height,10)
})
test('effects use their own 0.84 lane pitch and real camera, not note-space pitch',()=>{
 near(effectLaneX(0),-4.62);near(effectLaneX(11),4.62)
 for(const [w,h] of [[1920,1080],[1440,1080],[2400,1080]]){
  const unit=nativeWorldUnit(w,h)
  const l=projectEffectPoint(w,h,[effectLaneX(0),0,0]),r=projectEffectPoint(w,h,[effectLaneX(11),0,0])
  near(l[0]+r[0],w);near(l[1],r[1])
  // Recovered cameras place ground hits ~6.5 px above note centers at 1080p.
  assert.ok(Math.abs(l[1]-(h/2+2.96*unit))<unit*.07)
  assert.ok(Math.abs(l[0]-(w/2-6.545*unit))<unit*.07)
 }
})
test('adjacent native aura footprints overlap, giving a continuous note-width glow',()=>{
 const layer=effects.normal.find(l=>l.source.endsWith('/aura/base'))
 assert.ok(layer.width>.84)
 const a=projectEffectPoint(1920,1080,[effectLaneX(4)+layer.width/2,0,0])
 const b=projectEffectPoint(1920,1080,[effectLaneX(5)-layer.width/2,0,0])
 assert.ok(a[0]>b[0])
 assert.ok(!Object.values(effects).flat().some(l=>l.source.startsWith('fx_lane_tap/')),'unpicked touch effect must not be synthesized for judged notes')
})
test('all six native jackets have masks with correct perspective inverse mapping',()=>{
 const jackets=layout.background.filter(l=>l.image==='$jacket');assert.equal(jackets.length,6)
 for(const l of jackets)for(const [w,h] of [[1920,1080],[1440,1080]]){
  assert.ok(l.mask.cutoff>0)
  const quad=spriteClipQuad(l.mask,w,h,true),m=clipToSpriteUV(quad)
  quad.forEach(([x,y,z],i)=>{
   const p=[x/z,y/z,1],q=[0,1,2].map(r=>m[r]*p[0]+m[r+3]*p[1]+m[r+6]*p[2])
   near(q[0]/q[2],[0,1,1,0][i]);near(q[1]/q[2],[0,0,1,1][i])
  })
 }
})
test('native lane and pause assets exist, and judgment sprite keeps its native pivot',()=>{
 for(const l of [...layout.lanes,layout.pause])assert.ok(readFileSync(new URL('../public/playback/layout/'+l.image,import.meta.url)).length>0)
 const judge=layout.lanes.find(l=>l.name==='JudgeLane')
 near(judge.matrix[7],-2.92);assert.deepEqual(judge.pivot,[.5,.5]);near(layout.pause.size[0],96/108)
})

test('native cover starts at the first visible depth and reaches the judgment line',()=>{
 near(SPAWN_Y+(JUDGMENT_Y-SPAWN_Y)*coverProgress(0),4.84828486)
 near(coverProgress(50),.536325127)
 near(SPAWN_Y+(JUDGMENT_Y-SPAWN_Y)*coverProgress(100),JUDGMENT_Y)
 near(coverProgress(-20),coverProgress(0));near(coverProgress(120),1)
 for(const item of [layout.cover.area,layout.cover.line]){
  assert.ok(readFileSync(new URL('../public/playback/layout/'+item.image,import.meta.url)).length>0)
  near(item.color[3],.6)
 }
 near(layout.cover.minLineSize[0],1.1);near(layout.cover.maxLineSize[0],14.12)
})

const segment=(start,end,left,right,gold=false)=>({start,end,gold,left:[[left,start],[left,start],[right,end],[right,end]],right:[[left+2,start],[left+2,start],[right+2,end],[right+2,end]]})
test('one continuous hold clock crosses cubic joins while simultaneous holds remain separate',()=>{
 const paths=[segment(1,2,1,3),segment(2,3,3,5),segment(1,3,8,8),{...segment(1,3,0,0),guide:true}]
 const tracks=buildHoldTracks(paths)
 assert.equal(tracks.length,2)
 const moving=tracks.find(t=>t.segments.length===2)
 assert.equal(moving.start,1);assert.equal(moving.end,3)
 near(holdSpanAt(moving,1.5).lane,2);near(holdSpanAt(moving,2).lane,3)
 near(holdSpanAt(moving,2.5).lane,4);near(holdSpanAt(moving,2.5).width,2)
 near(holdSpanAt(moving,1.99999).lane,holdSpanAt(moving,2.00001).lane,.0001)
 // Crossing paths must not be arbitrarily stitched to one another.
 assert.equal(buildHoldTracks([segment(0,1,0,4),segment(0,1,8,4),segment(1,2,4,8),segment(1,2,4,0)]).length,4)
})
