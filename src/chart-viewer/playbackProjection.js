// CameraSizeUpdater (1920 x 1080, PPU 108, Both), SekaiCameraAspect (16:9).
export const nativeWorldUnit=(w,h)=>Math.min(w/(1920/108),h/10)
export const nativeFocalLength=(w,h,fov)=>Math.min(h,w/(16/9))/(2*Math.tan(fov*Math.PI/360))
export const effectCamera={x:0,y:5.320000171661377,z:-5.860000133514404,qx:.23429381847381592,qw:.9721658229827881,fov:50}
export function effectViewPoint([x,y,z]){
 const sn=2*effectCamera.qx*effectCamera.qw,cs=1-2*effectCamera.qx**2
 return [x,cs*(y-effectCamera.y)+sn*(z-effectCamera.z),-sn*(y-effectCamera.y)+cs*(z-effectCamera.z)]
}
export function projectEffectPoint(w,h,p){
 const [x,y,z]=effectViewPoint(p),f=nativeFocalLength(w,h,effectCamera.fov)
 return [w/2+x*f/z,h/2-y*f/z]
}
// TapEffectView passes inclusive, zero-based lane indices to this function.
export const effectLaneX=lane=>Math.fround(.84)*lane+Math.fround(-4.62)
export function spriteClipQuad(layer,w,h,perspective=false){
 const m=layer.matrix,f=nativeFocalLength(w,h,42),unit=nativeWorldUnit(w,h)
 return [[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{
  const x=(u-layer.pivot[0])*layer.size[0],y=(1-v-layer.pivot[1])*layer.size[1]
  const X=m[0]*x+m[1]*y+m[3],Y=m[4]*x+m[5]*y+m[7],Z=m[8]*x+m[9]*y+m[11]
  return perspective?[X*f*2/w,Y*f*2/h,Z+10]:[X*unit*2/w,Y*unit*2/h,1]
 })
}
// Inverse homography from NDC to native sprite UV, for SpriteMask clipping.
export function clipToSpriteUV(p){
 const a=p[1].map((v,i)=>v-p[0][i]),b=p[3].map((v,i)=>v-p[0][i]),c=p[0]
 const m=[a[0],b[0],c[0],a[1],b[1],c[1],a[2],b[2],c[2]]
 const [A,B,C,D,E,F,G,H,I]=m,det=A*(E*I-F*H)-B*(D*I-F*G)+C*(D*H-E*G)
 const r=[E*I-F*H,C*H-B*I,B*F-C*E,F*G-D*I,A*I-C*G,C*D-A*F,D*H-E*G,B*G-A*H,A*E-B*D].map(v=>v/det)
 return [r[0],r[3],r[6],r[1],r[4],r[7],r[2],r[5],r[8]]
}
