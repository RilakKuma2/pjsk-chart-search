import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { nativeCurve, particleMotionTable, sampleTable, sampleGradient } from '../src/chart-viewer/playbackEffectMath.js'
import { effectLifetime, makeParticles, sampleShape, seededRandom, particleUV, activeHoldParticles } from '../src/chart-viewer/playbackParticles.js'

const constant=value=>({mode:0,value,keys:[]})
const key=(time,value)=>({time,value,inSlope:1,outSlope:1,weightedMode:0})
const linear={mode:1,value:1,keys:[key(0,0),key(1,1)]}
const base={life:.5,basisX:[1,0,0],basisY:[0,1,0],basisZ:[0,0,1]}
const vector=(x,y,z,world=false)=>({world,axes:[x,y,z]})
const close=(a,b,tolerance=1e-4)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`)
const effects=JSON.parse(readFileSync(new URL('../src/chart-viewer/playbackEffects.json',import.meta.url)))

test('velocity and force integrate in seconds, independently of playback frames',()=>{
 const layer={...base,velocity:vector(constant(2),constant(0),constant(0)),force:vector(constant(0),constant(8),constant(0)),angularVelocity:constant(4)}
 const table=particleMotionTable(layer,1)
 const end=sampleTable(table,1)
 close(end[0],1);close(end[1],1);close(end[3],2)
 const middle=sampleTable(table,.5)
 close(middle[0],.5);close(middle[1],.25);close(middle[3],1)
 assert.deepEqual(sampleTable(table,.5),middle)
})

test('a lifetime-relative linear force needs two integrations',()=>{
 const layer={...base,force:vector(constant(0),linear,constant(0))}
 close(particleMotionTable(layer,1).at(-1)[1],base.life**2/6)
})

test('local velocity follows emitter orientation; world velocity does not',()=>{
 const layer={...base,basisX:[0,1,0],basisY:[-1,0,0],velocity:vector(constant(0),constant(2),constant(0))}
 close(particleMotionTable(layer,1).at(-1)[0],-1)
 layer.velocity.world=true
 close(particleMotionTable(layer,1).at(-1)[0],0)
 close(particleMotionTable(layer,1).at(-1)[1],1)
})

test('two-constant and two-curve ranges preserve native bounds',()=>{
 close(nativeCurve({mode:3,min:-2,value:6},.5,.25),0)
 const two={...linear,mode:2,value:4,minKeys:[key(0,0),key(1,0)]}
 close(nativeCurve(two,1,.25),1)
})

test('disabled critical connection aura is excluded from extracted layers',()=>{
 assert.ok(!Object.values(effects).flat().some(l=>l.source==='fx_note_critical_long_hold_via_aura/root/aura'))
})

test('native aura and flick flare move; critical ripple rotates',()=>{
 const aura=effects.normal.find(l=>l.source.endsWith('/root/aura'))
 assert.equal(aura.force.axes[1].value,50)
 assert.ok(particleMotionTable(aura,1).at(-1)[1]>0)
 const flare=effects.flick_flash.find(l=>l.source.endsWith('/flare_01'))
 assert.ok(particleMotionTable(flare,1).at(-1)[1]>0)
 assert.deepEqual(sampleGradient(flare.gradient.rgb,0),[1,1,1])
 assert.deepEqual(sampleGradient(flare.gradient.rgb,1),[1,.25,.25])
 const ripple=effects.critical_normal_gen.find(l=>l.source.endsWith('/Ripple_03'))
 assert.ok(particleMotionTable(ripple,1).at(-1)[3]>0)
})

test('all exported trajectories have finite coordinates across their lifetime',()=>{
 for(const layer of Object.values(effects).flat())for(const random of [0,1]){
  assert.ok(particleMotionTable(layer,random).flat().every(Number.isFinite),layer.source)
 }
})

test('lane illumination and center burst remain separate native effect groups',()=>{
 assert.ok(effects.lane_default.some(l=>l.source==='fx_lane_default/root/base/white'))
 assert.ok(effects.normal_gen.some(l=>l.source.endsWith('/Ripple_01')))
 // The prefab's disabled base squares must not be reintroduced with the lanes.
 assert.ok(!Object.values(effects).flat().some(l=>l.source==='fx_lane_default/root/base'))
})

test('infinite native tangents stay stepped instead of becoming NaN',()=>{
 const curve={mode:1,value:1,keys:[{...key(0,2),outSlope:'Infinity'},{...key(1,5),inSlope:'Infinity'}]}
 close(nativeCurve(curve,.5),2);close(nativeCurve(curve,1),5)
})

test('normal aura respects the native 25-particle burst and 15-particle capacity',()=>{
 const layer=effects.normal.find(l=>l.source.endsWith('/aura/Particle'))
 assert.equal(layer.bursts[0].count.value,25)
 assert.equal(layer.maxParticles,15)
 const particles=makeParticles(layer,42)
 assert.equal(particles.length,15)
 assert.deepEqual(makeParticles(layer,42),particles)
 assert.notDeepEqual(makeParticles(layer,43),particles)
 for(const p of particles){assert.ok(p.life>=.15-1e-6&&p.life<=.35+1e-6);assert.ok(p.samples.flat().every(Number.isFinite))}
})

test('burst repeats are retained and lifetime bounds ignore unused minScalar',()=>{
 const original=effects.normal_gen[0]
 const layer={...original,bursts:[{time:0,cycleCount:2,repeatInterval:.1,probability:1,count:constant(1)}],maxParticles:4,lifetime:constant(.2)}
 const particles=makeParticles(layer,1)
 assert.equal(particles.length,2)
 close(particles[1].born-particles[0].born,.1)
 close(effectLifetime({...layer,lifetime:{...constant(.2),min:5}}),layer.delay+.3)
})

test('shape sampling is bounded and burst spread follows source arc',()=>{
 const shape={...effects.normal_gen[0].shape,type:10,arc:{value:360,mode:3},radius:{value:1},radiusThickness:0,m_Rotation:{x:0,y:0,z:0},m_Position:{x:0,y:0,z:0},m_Scale:{x:1,y:1,z:1}}
 const random=seededRandom(1)
 const points=Array.from({length:4},(_,i)=>sampleShape(shape,i,4,random).position)
 close(points[0][0],1);close(points[1][1],1);close(points[2][0],-1);close(points[3][1],-1)
})

test('random texture cells and animated flick sheets use full original atlas',()=>{
 const layer=effects.normal_gen.find(l=>l.source.endsWith('/Particle_02'))
 assert.notDeepEqual(particleUV(layer,0,0),particleUV(layer,0,1))
 const animated=effects.flick_flash.find(l=>l.source.endsWith('/Water_Particle_01'))
 assert.notDeepEqual(particleUV(animated,0,0),particleUV(animated,.5,0))
})

test('all native particle layers generate finite trajectories and stay within capacity',()=>{
 for(const layer of Object.values(effects).flat()){
  const particles=makeParticles(layer,91)
  for(const p of particles){
   assert.ok(p.samples.flat().every(Number.isFinite),layer.source)
   assert.ok(p.born+p.life<=effectLifetime(layer)+1e-5,layer.source)
   assert.ok(particles.filter(q=>q.born<=p.born&&q.born+q.life>p.born).length<=layer.maxParticles,layer.source)
  }
 }
})

test('simplified preset uses native quarter-alpha layers and its own burst/trace data',()=>{
 const simple=JSON.parse(readFileSync(new URL('../src/chart-viewer/playbackEffectsSimple.json',import.meta.url)))
 assert.equal(simple.source,'effect_asset/live/tap_effect/1')
 const source='fx_note_normal_aura/root/aura'
 const original=effects.normal.find(l=>l.source===source)
 const simplified={...original,...simple.overrides[source]}
 close(makeParticles(simplified,42)[0].color[3],.25)
 close(makeParticles(original,42)[0].color[3],1)
 const particleSource=source+'/Particle'
 assert.equal(simple.overrides[particleSource].bursts[0].count.value,35)
 const particleLayer={...effects.normal.find(l=>l.source===particleSource),...simple.overrides[particleSource]}
 assert.equal(makeParticles(particleLayer,42).length,15,'native capacity still applies to the simplified burst')
 assert.ok(simple.overrides['fx_note_trace_aura/root/pt'].speed,'trace preset is not merely a global alpha multiplier')
 const bySource=new Map(Object.values(effects).flat().map(l=>[l.source,l]))
 for(const [name,override] of Object.entries(simple.overrides)){
  assert.ok(bySource.has(name),name)
  for(const particle of makeParticles({...bySource.get(name),...override},7))assert.ok(particle.samples.flat().every(Number.isFinite),name)
 }
})


test('hold emitters retain native rate, loop flags, and local/world simulation',()=>{
 for(const key of ['long_hold_gen','critical_long_hold_gen']){
  assert.equal(effects[key].length,13)
  const layer=effects[key].find(l=>l.source.endsWith('/Particle_water/Particle_01'))
  assert.equal(layer.rateOverTime.value,25);assert.equal(layer.simulationSpace,1)
  const particles=makeParticles(layer,42)
  assert.equal(particles.length,25);close(particles[0].born,.04);close(particles.at(-1).born,1)
  const shot=effects[key].find(l=>l.source.endsWith('/glow_03_shot'))
  assert.equal(shot.looping,false)
  assert.equal([...activeHoldParticles(shot,[makeParticles(shot,42)],2)].length,0,'initial flash must not repeat')
  assert.ok(effects[key].some(l=>l.looping&&l.simulationSpace===0))
 }
})
test('looping hold particles persist across cycles, seek deterministically, and stay within native capacity',()=>{
 const simple=JSON.parse(readFileSync(new URL('../src/chart-viewer/playbackEffectsSimple.json',import.meta.url)))
 for(const key of ['long_hold_gen','critical_long_hold_gen','hold_sustain_aura','critical_hold_sustain_aura'])for(const original of effects[key])for(const layer of [original,{...original,...simple.overrides[original.source]}]){
  const variants=[42,43,44,45].map(seed=>makeParticles(layer,seed))
  for(const age of [0,.039,.04,.5,.99,1,1.01,1.4,2,3.75,10000.4]){
   const active=[...activeHoldParticles(layer,variants,age)]
   assert.ok(active.length<=layer.maxParticles,`${layer.source} at ${age}`)
   for(const p of active){assert.ok(p.age>=0&&p.age<p.particle.life);assert.ok(p.born<=age)}
  }
  const summarize=age=>[...activeHoldParticles(layer,variants,age)].map(p=>[p.born,p.age,p.particle.position])
  const snapshot=summarize(1.4);summarize(60);assert.deepEqual(summarize(1.4),snapshot)
 }
 const water=effects.long_hold_gen.find(l=>l.source.endsWith('/Particle_water/Particle_01'))
 const active=[...activeHoldParticles(water,[makeParticles(water,42)],1.1)]
 assert.ok(active.some(p=>p.born<1)&&active.some(p=>p.born>1),'existing particles survive the loop boundary')
})
