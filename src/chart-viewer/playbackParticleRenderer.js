import { nativeFocalLength } from './playbackProjection.js'
// Dedicated transparent particle surface. The fragment output and blend factors
// match Sekai/Note/Particles/Additive+AlphaBlend (Custom1X selects alpha=0).
// Projection uses the extracted EffectCamera and its aspect-corrected FOV.
export function createParticleRenderer(){
 const surface=document.createElement('canvas')
 const gl=surface.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false})
 if(!gl)return null
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);return s}
 const vs=shader(gl.VERTEX_SHADER,`
 attribute vec3 position;attribute vec2 uv;attribute vec4 color;attribute float additive;
 uniform vec2 viewport;uniform float focal;
 varying vec2 texCoord;varying vec4 tint;varying float isAdditive;
 void main(){
  float sn=2.0*0.23429381847381592*0.9721658229827881;
  float cs=1.0-2.0*0.23429381847381592*0.23429381847381592;
  float z0=sn*5.320000171661377+cs*5.860000133514404;
  float y0=-cs*5.320000171661377+sn*5.860000133514404;
  float z=z0-sn*position.y+cs*position.z;
  float y=y0+cs*position.y+sn*position.z;
  gl_Position=vec4(position.x*focal*2.0/viewport.x,
   y*focal*2.0/viewport.y,
   (1000.0+0.3)/(1000.0-0.3)*z-2.0*1000.0*0.3/(1000.0-0.3),z);
  texCoord=uv;tint=color;isAdditive=additive;
 }`)
 const fs=shader(gl.FRAGMENT_SHADER,`
 precision mediump float;uniform sampler2D image;varying vec2 texCoord;varying vec4 tint;varying float isAdditive;
 void main(){vec4 c=texture2D(image,texCoord)*tint;gl_FragColor=vec4(c.rgb*c.a,isAdditive>.5?0.0:c.a);}`)
 const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program)
 if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);return null}
 const buffer=gl.createBuffer(),textures=new Map(),commands=[]
 const attributes=[['position',3,0],['uv',2,3],['color',4,5],['additive',1,9]].map(([name,size,offset])=>[gl.getAttribLocation(program,name),size,offset])
 const viewport=gl.getUniformLocation(program,'viewport'),focal=gl.getUniformLocation(program,'focal')
 let lost=false,w=0,h=0
 const onLost=e=>{e.preventDefault();lost=true}
 surface.addEventListener('webglcontextlost',onLost)
 return {
  begin(ctx){commands.length=0;w=ctx.canvas.width/ctx.getTransform().a;h=ctx.canvas.height/ctx.getTransform().d;if(surface.width!==ctx.canvas.width||surface.height!==ctx.canvas.height){surface.width=ctx.canvas.width;surface.height=ctx.canvas.height}return !lost},
  add(image,points,uv,color,additive,order){commands.push({image,points,uv,color,additive,order})},
  draw(ctx){
   if(lost)return
   gl.viewport(0,0,surface.width,surface.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT)
   gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer)
   for(const [location,size,offset] of attributes){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,40,offset*4)}
   gl.uniform2f(viewport,w,h);gl.uniform1f(focal,nativeFocalLength(w,h,50))
   gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA)
   commands.sort((a,b)=>a.order-b.order)
   let image=null,vertices=[]
   const flush=()=>{
    if(!vertices.length)return
    let texture=textures.get(image)
    if(!texture){texture=gl.createTexture();textures.set(image,texture);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image)}else gl.bindTexture(gl.TEXTURE_2D,texture)
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,vertices.length/10);vertices=[]
   }
   for(const c of commands){
    if(c.image!==image){flush();image=c.image}
    const [u,v,du,dv]=c.uv,uvs=[[u,v],[u+du,v],[u+du,v+dv],[u,v+dv]]
    for(const i of [0,1,3,1,2,3])vertices.push(...c.points[i],...uvs[i],...c.color,c.additive?1:0)
   }
   flush();ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(surface,0,0,w,h);ctx.restore()
  },
  dispose(){surface.removeEventListener('webglcontextlost',onLost);textures.forEach(t=>gl.deleteTexture(t));gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);gl.getExtension('WEBGL_lose_context')?.loseContext()}
 }
}
