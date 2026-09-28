// Unity AnimationCurve: cubic Bezier time handles for weighted keys, Hermite
// handles (one third of the interval) otherwise. No hand-tuned easing curves.
function evaluateCurve(curve, time) {
 if (!curve) return 1
 const keys=curve.keys
 if (!keys.length || curve.mode===0) return curve.value
 if(time<=keys[0].time)return keys[0].value*curve.value
 if(time>=keys.at(-1).time)return keys.at(-1).value*curve.value
 const i=keys.findIndex(k=>k.time>=time),a=keys[i-1],b=keys[i],dt=b.time-a.time
 if(!Number.isFinite(Number(a.outSlope))||!Number.isFinite(Number(b.inSlope)))return a.value*curve.value
 const wa=(a.weightedMode&2)?a.outWeight:1/3,wb=(b.weightedMode&1)?b.inWeight:1/3
 const bez=(a,b,c,d,u)=>a*(1-u)**3+3*b*(1-u)**2*u+3*c*(1-u)*u*u+d*u**3
 let low=0,high=1
 for(let j=0;j<16;j++){const u=(low+high)/2;if(bez(a.time,a.time+wa*dt,b.time-wb*dt,b.time,u)<time)low=u;else high=u}
 return bez(a.value,a.value+a.outSlope*wa*dt,b.value-b.inSlope*wb*dt,b.value,(low+high)/2)*curve.value
}
export const sampleGradient=(keys,t)=>{
 if(!keys?.length)return [1]
 if(t<=keys[0][0])return keys[0].slice(1)
 for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const a=keys[i-1],b=keys[i],u=(t-a[0])/(b[0]-a[0]);return a.slice(1).map((v,j)=>v+(b[j+1]-v)*u)}
 return keys.at(-1).slice(1)
}

// Unity MinMaxCurve modes: constant, curve, two curves, two constants.
export function nativeCurve(curve, time, random=1) {
 if(!curve)return 1
 if(curve.mode===3)return curve.min+(curve.value-curve.min)*random
 const upper=evaluateCurve(curve,time)
 if(curve.mode!==2)return upper
 const lower=evaluateCurve({...curve,mode:1,keys:curve.minKeys},time)
 return lower+(upper-lower)*random
}
const motionAt=(layer,module,t,random)=>{
 if(!module)return [0,0,0]
 const v=module.axes.map(c=>nativeCurve(c,t,random))
 if(module.world)return v
 return v.map((_,i)=>layer.basisX[i]*v[0]+layer.basisY[i]*v[1]+layer.basisZ[i]*v[2])
}
// Integrate in seconds, not normalized lifetime. Tables are prepared once;
// playback, seeking and repeat sample the same trajectory without frame drift.
export function particleMotionTable(layer, random, steps=256) {
 const dt=layer.life/steps,position=[0,0,0],forceVelocity=[0,0,0]
 let angle=0
 const rows=[[0,0,0,0]]
 for(let i=1;i<=steps;i++){
  const t=(i-.5)/steps,velocity=motionAt(layer,layer.velocity,t,random),force=motionAt(layer,layer.force,t,random)
  for(let j=0;j<3;j++){
   position[j]+=(velocity[j]+forceVelocity[j])*dt+.5*force[j]*dt*dt
   forceVelocity[j]+=force[j]*dt
  }
  angle+=(layer.angularVelocity?nativeCurve(layer.angularVelocity,t,random):0)*dt
  rows.push([...position,angle])
 }
 return rows
}
export function sampleTable(rows,time) {
 const index=Math.max(0,Math.min(1,time))*(rows.length-1),lo=Math.floor(index),mix=index-lo
 return rows[lo].map((v,i)=>v+(rows[Math.min(rows.length-1,lo+1)][i]-v)*mix)
}
