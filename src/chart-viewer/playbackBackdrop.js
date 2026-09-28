import { drawTexturedQuad } from './playbackVisuals.js'
import layout from './playbackLayout.json'
import { spriteClipQuad,clipToSpriteUV,nativeWorldUnit } from './playbackProjection.js'

// Background2DView renders the six masked jackets once. Resize invalidates the
// cached surface; playback frames only copy it, not six transformed images.
export async function loadPlaybackBackdrop(jacketURL){
 let dirty=true
 const images=new Map(),items=[...layout.background,...layout.lanes,layout.pause,layout.cover.area,layout.cover.line]
 const names=new Set(items.flatMap(l=>[l.image,l.mask?.image]).filter(Boolean))
 await Promise.all([...names].map(name=>new Promise(resolve=>{
  const image=new Image();image.crossOrigin='anonymous'
  const timeout=setTimeout(resolve,5000)
  image.onload=()=>{clearTimeout(timeout);images.set(name,image);dirty=true;resolve()};image.onerror=()=>{clearTimeout(timeout);resolve()}
  image.src=name==='$jacket'?jacketURL:`${import.meta.env.BASE_URL}playback/layout/${name}`
 })))
 const surface=document.createElement('canvas'),gl=surface.getContext('webgl',{alpha:false,antialias:true,depth:false})
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);return s}
 let program,vs,fs,buffer,position,uv,uniforms,textures=new Map(),lost=false
 if(gl){
  vs=shader(gl.VERTEX_SHADER,'attribute vec3 position;attribute vec2 uv;varying vec2 coord;void main(){gl_Position=vec4(position.xy,0.0,position.z);coord=uv;}')
  fs=shader(gl.FRAGMENT_SHADER,`precision mediump float;uniform sampler2D image;uniform sampler2D maskImage;uniform vec4 tint;uniform bool masked;uniform float cutoff;uniform vec2 viewport;uniform mat3 clipToMask;varying vec2 coord;void main(){if(masked){vec3 p=clipToMask*vec3(gl_FragCoord.xy/viewport*2.0-1.0,1.0);vec2 u=p.xy/p.z;if(u.x<0.0||u.y<0.0||u.x>1.0||u.y>1.0||texture2D(maskImage,u).a<cutoff)discard;}vec4 c=texture2D(image,coord)*tint;gl_FragColor=vec4(c.rgb*c.a,c.a);}`)
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program)
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))lost=true
  buffer=gl.createBuffer();position=gl.getAttribLocation(program,'position');uv=gl.getAttribLocation(program,'uv')
  uniforms=Object.fromEntries(['image','maskImage','tint','masked','cutoff','viewport','clipToMask'].map(n=>[n,gl.getUniformLocation(program,n)]))
 }
 const onLost=e=>{e.preventDefault();lost=true};surface.addEventListener('webglcontextlost',onLost)
 const texture=(name,slot)=>{
  const image=images.get(name);if(!image)return false
  gl.activeTexture(gl.TEXTURE0+slot)
  let tex=textures.get(name)
  if(!tex){tex=gl.createTexture();textures.set(name,tex);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image)}else gl.bindTexture(gl.TEXTURE_2D,tex)
  return true
 }
 const draw=(ctx,w,h,dpr)=>{
  if(!gl||lost){
   if(cache.width!==Math.round(w*dpr)||cache.height!==Math.round(h*dpr)){cache.width=Math.round(w*dpr);cache.height=Math.round(h*dpr);dirty=true}
   if(dirty){
    const c=cache.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#080f38';c.fillRect(0,0,w,h)
    const scratch=document.createElement('canvas');scratch.width=cache.width;scratch.height=cache.height
    const sc=scratch.getContext('2d')
    const paint=(context,layer,perspective)=>{
     const image=images.get(layer.image);if(!image)return
     const points=spriteClipQuad(layer,w,h,perspective).map(([x,y,z])=>[(x/z+1)*w/2,(1-y/z)*h/2])
     drawTexturedQuad(context,image,points)
    }
    for(const [layers,perspective] of [[layout.background,true],[layout.lanes,false]])for(const layer of [...layers].sort((a,b)=>a.order-b.order)){
     c.globalAlpha=layer.color[3]
     if(layer.mask){sc.setTransform(1,0,0,1,0,0);sc.clearRect(0,0,scratch.width,scratch.height);sc.setTransform(dpr,0,0,dpr,0,0);sc.globalCompositeOperation='source-over';paint(sc,layer,perspective);sc.globalCompositeOperation='destination-in';paint(sc,layer.mask,true);c.drawImage(scratch,0,0,w,h)}else paint(c,layer,perspective)
    }
    c.globalAlpha=1;dirty=false
   }
   ctx.drawImage(cache,0,0,w,h);return
  }
  if(surface.width!==Math.round(w*dpr)||surface.height!==Math.round(h*dpr)){surface.width=Math.round(w*dpr);surface.height=Math.round(h*dpr);dirty=true}
  if(dirty){
   gl.viewport(0,0,surface.width,surface.height);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT)
   gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(position);gl.enableVertexAttribArray(uv)
   gl.vertexAttribPointer(position,3,gl.FLOAT,false,20,0);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,20,12)
   gl.uniform1i(uniforms.image,0);gl.uniform1i(uniforms.maskImage,1);gl.uniform2f(uniforms.viewport,surface.width,surface.height)
   gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA)
   for(const [layers,perspective] of [[layout.background,true],[layout.lanes,false]])for(const layer of [...layers].sort((a,b)=>a.order-b.order)){
    if(!texture(layer.image,0))continue
    const masked=!!layer.mask&&texture(layer.mask.image,1)
    gl.uniform1i(uniforms.masked,masked?1:0)
    if(masked){gl.uniform1f(uniforms.cutoff,layer.mask.cutoff);gl.uniformMatrix3fv(uniforms.clipToMask,false,clipToSpriteUV(spriteClipQuad(layer.mask,w,h,true)))}
    gl.uniform4fv(uniforms.tint,layer.color)
    const corners=spriteClipQuad(layer,w,h,perspective),uvs=[[0,0],[1,0],[1,1],[0,1]],vertices=[]
    for(const i of [0,1,3,1,2,3])vertices.push(...corners[i],...uvs[i])
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,6)
   }
   dirty=false
   // Preserve a 2D copy: WebGL's default drawing buffer is discarded after
   // compositing, so reusing it directly on later animation frames is unsafe.
   cache.width=surface.width;cache.height=surface.height;cache.getContext('2d').drawImage(surface,0,0)
  }
  ctx.drawImage(cache,0,0,w,h)
 }
 const cache=document.createElement('canvas')
 // NoteShowRateView: original HideArea sprite/tint and sliced boundary line.
 // The area shader keeps only the portion above the cutoff; notes are clipped
 // separately, so a translucent cover never leaks hidden notes through it.
 draw.drawCover=(ctx,w,h,percent,cutoffY)=>{
  if(percent<=0)return
  const {area,line,minLineSize,maxLineSize}=layout.cover
  const unit=nativeWorldUnit(w,h),amount=Math.max(0,Math.min(1,percent/100))
  ctx.save();ctx.beginPath();ctx.rect(0,0,w,Math.max(0,cutoffY));ctx.clip()
  const image=images.get(area.image)
  if(image){
   ctx.globalAlpha=area.color[3]
   const points=spriteClipQuad(area,w,h).map(([x,y,z])=>[(x/z+1)*w/2,(1-y/z)*h/2])
   drawTexturedQuad(ctx,image,points)
  }
  ctx.restore()
  const boundary=images.get(line.image)
  if(boundary){
   const [width,height]=minLineSize.map((v,i)=>(v+(maxLineSize[i]-v)*amount)*unit)
   ctx.save();ctx.globalAlpha=line.color[3]
   ctx.drawImage(boundary,w/2-width/2,cutoffY-height,width,height);ctx.restore()
  }
 }
 draw.pauseStyle=(w,h)=>{
  const unit=nativeWorldUnit(w,h),p=layout.pause
  return {width:p.size[0]*unit,height:p.size[1]*unit,right:(layout.camera.width/2-p.matrix[3]-p.size[0]/2)*unit,top:(layout.camera.height/2-p.matrix[7]-p.size[1]/2)*unit}
 }
 draw.dispose=()=>{surface.removeEventListener('webglcontextlost',onLost);if(gl){textures.forEach(t=>gl.deleteTexture(t));gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);gl.getExtension('WEBGL_lose_context')?.loseContext()}}
 return draw
}
