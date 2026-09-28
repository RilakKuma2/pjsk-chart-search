import { nativeCurve, sampleGradient } from './playbackEffectMath.js'

// Unity shape enum: Sphere=0, Hemisphere=2, Cone=4, Box=5, Circle=10.
// Source values are exported, including burst spread, radius thickness and TRS.
const xyz=v=>[v.x,v.y,v.z]
const add=(a,b)=>a.map((v,i)=>v+b[i])
const mul=(a,b)=>a.map((v,i)=>v*b[i])
const scale=(v,s)=>v.map(x=>x*s)
const normalized=v=>scale(v,1/(Math.hypot(...v)||1))
export const transformVector=(layer,v)=>v.map((_,i)=>layer.basisX[i]*v[0]+layer.basisY[i]*v[1]+layer.basisZ[i]*v[2])
function euler(v,degrees){
 const [x,y,z]=xyz(degrees).map(x=>x*Math.PI/180)
 let [a,b,c]=v
 ;[a,b]=[a*Math.cos(z)-b*Math.sin(z),a*Math.sin(z)+b*Math.cos(z)]
 ;[b,c]=[b*Math.cos(x)-c*Math.sin(x),b*Math.sin(x)+c*Math.cos(x)]
 return [a*Math.cos(y)+c*Math.sin(y),b,-a*Math.sin(y)+c*Math.cos(y)]
}
export function seededRandom(seed){
 let state=seed>>>0
 return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}
}
export function sampleShape(shape,index,count,random){
 if(!shape?.enabled)return {position:[0,0,0],direction:[0,0,1]}
 const azimuth=(shape.arc.mode===3?index/Math.max(1,count):random())*shape.arc.value*Math.PI/180
 const thickness=shape.radiusThickness,radius=shape.radius.value
 let position,direction
 if(shape.type===5){position=[random()-.5,random()-.5,random()-.5];direction=[0,0,1]}
 else if(shape.type===0||shape.type===2){
  const z=shape.type===2?random():random()*2-1,r=Math.sqrt(1-z*z)
  direction=[r*Math.cos(azimuth),r*Math.sin(azimuth),z]
  position=scale(direction,radius*Math.cbrt((1-thickness)**3+(1-(1-thickness)**3)*random()))
 }else if(shape.type===4||shape.type===10){
  const r=Math.sqrt((1-thickness)**2+(1-(1-thickness)**2)*random())
  position=[Math.cos(azimuth)*radius*r,Math.sin(azimuth)*radius*r,0]
  const angle=shape.angle*Math.PI/180
  direction=shape.type===10?[Math.cos(azimuth),Math.sin(azimuth),0]:normalized([Math.cos(azimuth)*r*Math.sin(angle),Math.sin(azimuth)*r*Math.sin(angle),Math.cos(angle)])
 }else throw new Error(`Unsupported native particle shape ${shape.type}`)
 if(shape.randomDirectionAmount){
  const z=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-z*z),other=[r*Math.cos(a),r*Math.sin(a),z]
  direction=normalized(direction.map((v,i)=>v*(1-shape.randomDirectionAmount)+other[i]*shape.randomDirectionAmount))
 }
 return {position:add(xyz(shape.m_Position),euler(mul(position,xyz(shape.m_Scale)),shape.m_Rotation)),direction:euler(direction,shape.m_Rotation)}
}
const motion=(layer,module,t,r)=>{
 if(!module)return [0,0,0]
 const v=module.axes.map((c,i)=>nativeCurve(c,t,r[i]))
 return module.world?v:transformVector(layer,v)
}
export function effectLifetime(layer){
 return layer.delay+Math.max(layer.rateOverTime?.value>0?layer.duration:0,...layer.bursts.map(b=>b.cycleCount?b.time+(b.cycleCount-1)*b.repeatInterval:layer.duration))+Math.max(nativeCurve(layer.lifetime,0,0),nativeCurve(layer.lifetime,0,1))
}
// Native dampen is a per-step limiter; use a fixed 60 Hz simulation so browser
// refresh rate/playback speed never changes trajectories. Unity's proprietary
// integrator is unavailable: this stepping is not a claim of bitwise parity.
const STEP=1/60
export function simulateParticle(layer,particle){
 const steps=Math.ceil(particle.life/STEP),dt=particle.life/steps,r=particle.random
 let position=particle.position.slice(),velocity=particle.velocity.slice(),rotation=particle.rotation
 const result=[]
 const sample=t=>{
  const rgb=sampleGradient(layer.gradient?.rgb,t),alpha=sampleGradient(layer.gradient?.alpha,t)[0]
  const color=particle.color.map((v,i)=>v*(i===3?alpha:(rgb[i]??1)))
  const size=[particle.width*nativeCurve(layer.sizeX,t,r[0]),particle.height*nativeCurve(layer.sizeY,t,r[0])]
  return [...position,rotation,...size,...color,...add(velocity,motion(layer,layer.velocity,t,r))]
 }
 result.push(sample(0))
 for(let i=1;i<=steps;i++){
  const t=(i-.5)/steps,force=motion(layer,layer.force,t,r)
  // Current APK globalgamemanagers/PhysicsManager.m_Gravity.y.
  force[1]-=9.8100004196167*nativeCurve(layer.gravity,t,r[2])
  velocity=add(velocity,scale(force,dt))
  let total=add(velocity,motion(layer,layer.velocity,t,r))
  if(layer.limitVelocity){
   const length=Math.hypot(...total),limit=nativeCurve(layer.limitVelocity.limit,t,r[0])
   if(length>limit){const factor=1-Math.pow(1-layer.limitVelocity.dampen,dt/STEP);const damped=scale(total,(length-(length-limit)*factor)/length);velocity=add(velocity,damped.map((v,j)=>v-total[j]));total=damped}
  }
  position=add(position,scale(total,dt))
  rotation+=(layer.angularVelocity?nativeCurve(layer.angularVelocity,t,r[1]):0)*dt
  result.push(sample(i/steps))
 }
 return result
}
export function makeParticles(layer,seed){
 const random=seededRandom(seed),particles=[]
 const events=[]
 for(const burst of layer.bursts){
  const cycles=burst.cycleCount||Math.max(1,Math.ceil((layer.duration-burst.time)/Math.max(.001,burst.repeatInterval)))
  for(let cycle=0;cycle<cycles;cycle++){
   const born=layer.delay+burst.time+cycle*burst.repeatInterval
   if(random()>burst.probability)continue
   events.push({born,count:Math.max(0,Math.round(nativeCurve(burst.count,0,random())))})
  }
 }
 // The recovered presets use constant rates. Accumulate a full particle before
 // emitting (first birth at 1/rate), independently of animation frame rate.
 const rate=layer.rateOverTime?nativeCurve(layer.rateOverTime,0,random()):0
 if(rate>0){
  if(layer.rateOverTime.mode!==0)throw new Error('Unsupported nonconstant native emission rate')
  for(let i=1;i<=Math.floor(layer.duration*rate+1e-7);i++)events.push({born:layer.delay+i/rate,count:1})
 }
 events.sort((a,b)=>a.born-b.born)
 for(const {born,count} of events){
   let active=particles.filter(p=>p.born+p.life>born).length
   for(let i=0;i<count&&active<layer.maxParticles;i++,active++){
    const shape=sampleShape(layer.shape,i,count,random),r=[random(),random(),random()]
    const life=nativeCurve(layer.lifetime,0,random())
    if(!(life>0))continue
    const sizeRandom=random(),colorRandom=random(),rgb=layer.randomColor?sampleGradient(layer.randomColor.rgb,colorRandom):[layer.color.r,layer.color.g,layer.color.b]
    const p={born,life,random:r,position:add(xyz(layer.position),transformVector(layer,mul(shape.position,layer.shapeScale))),
     velocity:transformVector(layer,scale(shape.direction,nativeCurve(layer.speed,0,random()))),
     width:nativeCurve(layer.startSizeX,0,sizeRandom)*layer.scale[0],height:nativeCurve(layer.startSizeY,0,sizeRandom)*layer.scale[1],
     rotation:nativeCurve(layer.rotation,0,random()),color:[...rgb,layer.randomColor?sampleGradient(layer.randomColor.alpha,colorRandom)[0]:layer.color.a],frameRandom:random()}
    p.samples=simulateParticle(layer,p);particles.push(p)
   }
 }
 return particles
}
export function particleUV(layer,t,random){
 if(!layer.uv)return [0,0,1,1]
 const u=layer.uv,count=u.columns*u.rows
 const frame=((Math.floor((nativeCurve(u.start,0,random)+nativeCurve(u.frame,t,random)*u.cycles)*count)%count)+count)%count
 return [(frame%u.columns)/u.columns,Math.floor(frame/u.columns)/u.rows,1/u.columns,1/u.rows]
}

// Sample only cycles that can still have live particles. Work and storage do
// not grow with hold duration, and seeking has no stale emitter state.
export function* activeHoldParticles(layer,variants,age,variant=0){
 const life=Math.max(...variants.flat().map(p=>p.life),0),period=layer.duration
 const first=layer.looping?Math.max(0,Math.floor((age-layer.delay-life)/period)):0
 const last=layer.looping?Math.max(0,Math.floor((age-layer.delay)/period)):0
 for(let cycle=first;cycle<=last;cycle++){
  const offset=cycle*period,particles=variants[(variant+cycle)%variants.length]
  for(const particle of particles){
   const born=offset+particle.born,elapsed=age-born
   if(elapsed>=0&&elapsed<particle.life)yield {particle,age:elapsed,born}
  }
 }
}
