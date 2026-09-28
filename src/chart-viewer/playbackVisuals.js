import { holdSpanAt } from './playbackGeometry.js'
import { effectLaneX, projectEffectPoint } from './playbackProjection.js'
import effects from './playbackEffects.json'
import simplePreset from './playbackEffectsSimple.json'

const simpleEffects=Object.fromEntries(Object.entries(effects).map(([kind,layers])=>[kind,layers.map(layer=>simplePreset.overrides[layer.source]?{...layer,...simplePreset.overrides[layer.source]}:layer)]))
const effectLayers=[...new Set([...Object.values(effects).flat(),...Object.values(simpleEffects).flat()])]
import { makeParticles, particleUV, effectLifetime, activeHoldParticles } from './playbackParticles.js'
import { createParticleRenderer } from './playbackParticleRenderer.js'

export const HIT_EFFECT_DURATION=Math.max(...effectLayers.map(effectLifetime))
let effectsPromise
async function prepareHitEffects(){
 const loaded=new Map(),templates=new Map()
 await Promise.all([...new Set(effectLayers.map(l=>l.image))].map(name=>new Promise(resolve=>{
  const image=new Image();image.onload=()=>{loaded.set(name,image);resolve()};image.onerror=resolve
  image.src=`${import.meta.env.BASE_URL}playback/effects/${name}`
 })))
 for(let i=0;i<effectLayers.length;i++){
  const layer=effectLayers[i]
  // The same emitter keeps its random pattern when switching only brightness.
  const seed=Array.from(layer.source).reduce((hash,c)=>Math.imul(hash,31)+c.charCodeAt(0)|0,0)
  templates.set(layer,Array.from({length:4},(_,variant)=>makeParticles(layer,seed+variant).map(p=>{
   p.sampleCount=p.samples.length;p.samples=new Float32Array(p.samples.flat());return p
  })))
  if(i%16===15)await new Promise(resolve=>setTimeout(resolve,0))
 }
 return {loaded,templates}
}
export async function loadHitEffects(){
 const {loaded,templates}=await (effectsPromise??=prepareHitEffects()),gpu=createParticleRenderer()
 let useGPU=false,activeEffects=simpleEffects
 const draw=(ctx,n,age,x,y,unit,mode='aura',mirrored=false,emitter=0,holdTrack=null)=>{
  const flash=mode==='flash'
  const kind=holdTrack?((n.gold?'critical_':'')+(mode==='hold_aura'?'hold_sustain_aura':'long_hold_gen')):mode==='lane'?`lane_${n.gold?(n.direction?'critical_flick':'critical'):(n.direction?'flick':'default')}`:(n.gold?'critical_':'')+(flash?'flick_flash':n.kind==='trace'?'trace':n.kind==='tick'?'long_hold_via':n.direction?'flick':n.kind==='hold'?'long':'normal')+(mode==='gen'?'_gen':'')
  const w=ctx.canvas.width/ctx.getTransform().a,h=ctx.canvas.height/ctx.getTransform().d
  const lane=n.lane+(n.width-1)/2
  const noteWide=mode==='lane'||mode==='aura'&&n.kind!=='trace'&&n.kind!=='tick'
  const origin=effectLaneX(lane)*(mirrored?-1:1)
  const variant=Math.abs(Math.floor(n.t*1000+(holdTrack?holdTrack.segments[0].left[0][0]:n.lane)*37+emitter))%4
  const tilt=flash&&(n.direction===3||n.direction===4)?((n.direction===4)!==mirrored?1:-1)*Math.PI/12:0
  const ct=Math.cos(tilt),st=Math.sin(tilt)
  for(const layer of activeEffects[kind]||[]){
   const image=loaded.get(layer.image);if(!image)continue
   const variants=templates.get(layer)
   const particles=holdTrack?activeHoldParticles(layer,variants,age,variant):variants[variant].map(particle=>({particle,age:age-particle.born,born:particle.born}))
   for(const {particle,age:ageInParticle,born} of particles){
    if(ageInParticle<0||ageInParticle>=particle.life)continue
    const t=ageInParticle/particle.life,index=t*(particle.sampleCount-1),lo=Math.floor(index),mix=index-lo
    const values=Array.from({length:13},(_,i)=>{const a=particle.samples[lo*13+i],b=particle.samples[Math.min(particle.sampleCount-1,lo+1)*13+i];return a+(b-a)*mix})
    const [px,py,pz,rotation]=values,color=values.slice(6,10)
    let width=values[4],height=values[5]
    if(width<=0||height<=0||color[3]<=0)continue
    let bx=layer.renderMode===2?[1,0,0]:layer.alignment===2?layer.basisX:[1,0,0]
    let by=layer.renderMode===2?[0,0,1]:layer.alignment===2?layer.basisY:[0,1,0]
    if(layer.renderMode===1){
     const velocity=values.slice(10,13),speed=Math.hypot(...velocity)
     if(speed>1e-6){by=velocity.map(v=>v/speed);const planar=Math.hypot(by[0],by[1]);bx=planar>1e-6?[by[1]/planar,-by[0]/planar,0]:[1,0,0]}
     height=height*layer.lengthScale+speed*layer.velocityScale
    }
    const c=Math.cos(rotation),s=Math.sin(rotation),pivot=layer.pivot
    // World-space particles retain their birth position while local-space
    // glows follow the moving hold. Gen is not stretched by note width.
    const span=holdTrack?holdSpanAt(holdTrack,holdTrack.start+(layer.simulationSpace===1?born:age)):null
    const particleOrigin=span?effectLaneX(span.lane+(span.width-1)/2)*(mirrored?-1:1):origin
    const points=[[-.5,.5],[.5,.5],[.5,-.5],[-.5,-.5]].map(([u,v])=>{
     const dx=(u+pivot.x)*width,dy=(v+pivot.y)*height,rx=dx*c-dy*s,ry=dx*s+dy*c
     const dx3=px+(mode==='hold_aura'&&layer.scalingMode!==0?particle.position[0]*(span.width-1):0)+bx[0]*rx+by[0]*ry,dy3=py+bx[1]*rx+by[1]*ry,dz3=pz+bx[2]*rx+by[2]*ry
     // FlickSlash sets the whole root's X scale then Z rotation, including
     // particle positions and trajectories, not merely each sprite's width.
     const tx=dx3*(flash||noteWide?n.width:mode==='hold_aura'&&layer.scalingMode===0?span.width:1)
     return [particleOrigin+tx*ct-dy3*st,tx*st+dy3*ct,dz3]
    })
    const uv=particleUV(layer,t,particle.frameRandom)
    if(useGPU)gpu.add(image,points,uv,color,layer.additive,layer.order)
    else{
     // WebGL-less fallback: geometry/age/UV remain functional. Native color
     // multiplication and perspective-correct interpolation require WebGL.
     ctx.save();ctx.globalCompositeOperation=layer.additive?'lighter':'source-over';ctx.globalAlpha=Math.max(0,Math.min(1,color[3]))
     drawTexturedQuad(ctx,image,points.map(p=>projectEffectPoint(w,h,p)),uv);ctx.restore()
    }
   }
  }
 }
 draw.hold=(ctx,track,time,mirrored)=>{
  // Native ParticleSystemController.Stop uses StopEmittingAndClear.
  if(time<track.start||time>=track.end)return
  const span=holdSpanAt(track,time)
  for(const mode of ['hold_aura','hold_gen'])draw(ctx,{...span,t:track.start,gold:track.gold,kind:'hold'},time-track.start,0,0,0,mode,mirrored,0,track)
 }
 draw.begin=(ctx,x,y,unit,simplified=true)=>{activeEffects=simplified?simpleEffects:effects;useGPU=gpu?.begin(ctx,x,y,unit)||false}
 draw.finish=ctx=>{if(useGPU)gpu.draw(ctx)}
 draw.dispose=()=>gpu?.dispose()
 return draw
}

export function drawTexturedQuad(ctx,image,p,uv=[0,0,1,1]){
 const triangle=(points,a,b,c,d,e,f)=>{
  ctx.save();ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.clip()
  ctx.transform(a,b,c,d,e,f);ctx.drawImage(image,uv[0]*image.width,uv[1]*image.height,uv[2]*image.width,uv[3]*image.height,0,0,1,1);ctx.restore()
 }
 triangle([p[0],p[1],p[3]],p[1][0]-p[0][0],p[1][1]-p[0][1],p[3][0]-p[0][0],p[3][1]-p[0][1],...p[0])
 triangle([p[1],p[2],p[3]],p[2][0]-p[3][0],p[2][1]-p[3][1],p[2][0]-p[1][0],p[2][1]-p[1][1],p[1][0]+p[3][0]-p[2][0],p[1][1]+p[3][1]-p[2][1])
}
// The atlas contains four separate state/color rows, not a gradient along
// every connection. NoteLineView's horizontal UV offsets are 0/.125/.875/1;
// the outer eighths are edge padding and must not shrink the visible lane span.
export const ribbonUV=(gold)=>({left:.125,right:.875,row:gold?.625:.125})

// Project the original line texture into each mesh trapezoid, including
// its alpha and cross-lane gradient. Two triangles avoid constant-width bands.
export function drawRibbon(ctx,image,gold,corners,v0,v1){
 if(!image?.naturalWidth||v1<=v0)return
 const [p0,p1,p2,p3]=corners,uv=ribbonUV(gold)
 const sy=Math.floor(image.height*uv.row),sh=1
 const triangle=(points,a,b,c,d,e,f)=>{
  ctx.save();ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.clip()
  ctx.transform(a,b,c,d,e,f);ctx.drawImage(image,image.width*uv.left,sy,image.width*(uv.right-uv.left),sh,0,0,1,1);ctx.restore()
 }
 triangle([p0,p1,p3],p1[0]-p0[0],p1[1]-p0[1],p3[0]-p0[0],p3[1]-p0[1],...p0)
 triangle([p1,p2,p3],p2[0]-p3[0],p2[1]-p3[1],p2[0]-p1[0],p2[1]-p1[1],p1[0]+p3[0]-p2[0],p1[1]+p3[1]-p2[1])
}
// FlickNoteView.Move: ScrollCount=2; move up 2*fract(chartTime*2),
// fade during the second half. Diagonal root rotates movement by 30 degrees.
export function flickMotion(time,diagonal,right) {
 const rise=2*((time*2%1+1)%1)
 return {x:diagonal?rise*.5*(right?1:-1):0,y:rise*(diagonal?Math.sqrt(3)/2:1),alpha:1-Math.max(0,rise-1)}
}

// A shared GPU mesh avoids Canvas clip-edge seams between translucent ribbon
// triangles. The fallback retains the same UVs on devices without WebGL.
export function createRibbonRenderer() {
 const surface=document.createElement('canvas')
 const gl=surface.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true,depth:false,stencil:false})
 if(!gl)return null
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);return s}
 const vs=shader(gl.VERTEX_SHADER,'attribute vec2 pos;attribute vec2 uv;uniform vec2 viewport;varying vec2 texCoord;void main(){gl_Position=vec4(pos.x/viewport.x*2.0-1.0,1.0-pos.y/viewport.y*2.0,0.0,1.0);texCoord=uv;}')
 const fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D image;uniform float brightness;varying vec2 texCoord;void main(){vec4 c=texture2D(image,texCoord);c.a*=brightness;gl_FragColor=vec4(c.rgb*c.a,c.a);}')
 const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program)
 if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);return null}
 const buffer=gl.createBuffer(),textures=new Map(),batches=new Map()
 const pos=gl.getAttribLocation(program,'pos'),uv=gl.getAttribLocation(program,'uv')
 const viewport=gl.getUniformLocation(program,'viewport'),brightness=gl.getUniformLocation(program,'brightness')
 let lost=false,width=0,height=0,alpha=1
 const onLost=e=>{e.preventDefault();lost=true}
 surface.addEventListener('webglcontextlost',onLost)
 return {
  begin(w,h,dpr,value){width=w;height=h;alpha=value;batches.clear();if(surface.width!==Math.round(w*dpr)||surface.height!==Math.round(h*dpr)){surface.width=Math.round(w*dpr);surface.height=Math.round(h*dpr)}return !lost},
  add(image,gold,p){
   if(!image?.naturalWidth)return
   let rows=batches.get(image);if(!rows){rows=[];batches.set(image,rows)}
   const uv=ribbonUV(gold)
   const verts=[[...p[0],uv.left,uv.row],[...p[1],uv.right,uv.row],[...p[2],uv.right,uv.row],[...p[3],uv.left,uv.row]]
   for(const i of [0,1,3,1,2,3])rows.push(...verts[i])
  },
  draw(ctx){
   if(lost)return
   gl.viewport(0,0,surface.width,surface.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT)
   gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer)
   gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(uv)
   gl.vertexAttribPointer(pos,2,gl.FLOAT,false,16,0);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8)
   gl.uniform2f(viewport,width,height);gl.uniform1f(brightness,alpha)
   gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA)
   for(const [image,rows] of batches){
    let texture=textures.get(image)
    if(!texture){texture=gl.createTexture();textures.set(image,texture);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image)}else gl.bindTexture(gl.TEXTURE_2D,texture)
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(rows),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,rows.length/4)
   }
   ctx.save();ctx.globalAlpha=1;ctx.drawImage(surface,0,0,width,height);ctx.restore()
  },
  dispose(){surface.removeEventListener('webglcontextlost',onLost);for(const texture of textures.values())gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);gl.getExtension('WEBGL_lose_context')?.loseContext()}
 }
}
