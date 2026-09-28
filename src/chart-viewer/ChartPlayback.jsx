import { loadPlaybackBackdrop } from './playbackBackdrop.js'
import { nativeWorldUnit } from './playbackProjection.js'
import { useEffect, useRef, useState } from 'react'
import './playback.css'
import useVisualViewportModal from '../hooks/useVisualViewportModal.ts'
import { loadHitEffects, drawRibbon, flickMotion, createRibbonRenderer, HIT_EFFECT_DURATION } from './playbackVisuals.js'
import { SPAWN_Y, JUDGMENT_Y, HALF_WIDTH, coverProgress, displaySeconds, viewProgress, noteBodySize, NOTE_SPRITE, alignConnectionNotes, buildHoldTracks } from './playbackGeometry.js'

const words={
 ko:{title:'채보 재생',close:'나가기',effects:'탭 이펙트',simpleEffects:'탭 이펙트 간소화',brightness:'롱노트·트레이스 밝기',reset:'초기화',loopStart:'반복시작',loopEnd:'반복끝',play:'재생',pause:'일시정지',speed:'노트 속도',cover:'가리개 · 시작 위치',rate:'재생 배속',repeat:'구간 반복',start:'시작',end:'끝',here:'현재 위치',silent:'채보 미리보기 · 음원 없음'},
 en:{title:'Chart playback',close:'Exit',effects:'Tap effects',simpleEffects:'Simplified tap effects',brightness:'Hold / trace brightness',reset:'Reset',loopStart:'Loop start',loopEnd:'Loop end',play:'Play',pause:'Pause',speed:'Note speed',cover:'Lane cover',rate:'Playback speed',repeat:'Loop range',start:'Start',end:'End',here:'Current',silent:'Chart preview · No audio'},
 ja:{title:'譜面再生',close:'退出',effects:'タップエフェクト',simpleEffects:'タップエフェクト軽量化',brightness:'ロング・トレースの明るさ',reset:'リセット',loopStart:'開始設定',loopEnd:'終了設定',play:'再生',pause:'一時停止',speed:'ノーツの速さ',cover:'レーンカバー・開始位置',rate:'再生速度',repeat:'区間リピート',start:'開始',end:'終了',here:'現在位置',silent:'譜面プレビュー・音源なし'}
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x))
const stamp=x=>`${Math.floor(x/60)}:${String(Math.floor(x%60)).padStart(2,'0')}`
export default function ChartPlayback({chart,startTime,language,mirrored,onClose}){
 const t=words[language]||words.en, root=useRef(null), canvas=useRef(null), clock=useRef(startTime), state=useRef(null)
 const end=chart.notes.reduce((v,n)=>Math.max(v,n.t+1),chart.duration||1)
 const [time,setTime]=useState(startTime),[playing,setPlaying]=useState(true),[ready,setReady]=useState(false)
 const [clean,setClean]=useState(false)
 const fullLabel=({ko:'채보 전체화면',en:'Chart fullscreen',ja:'譜面全画面'}[language]||'Fullscreen')
 const toggleFull=async()=>{
  if(clean){setClean(false);if(document.fullscreenElement===root.current)await document.exitFullscreen?.().catch(()=>{});return}
  setClean(true)
  try{await root.current.requestFullscreen?.()}catch{/* CSS fullscreen remains available on iOS. */}
 }
 useEffect(()=>{
  const changed=()=>{if(!document.fullscreenElement)setClean(false)}
  document.addEventListener('fullscreenchange',changed)
  return()=>document.removeEventListener('fullscreenchange',changed)
 },[])
 // Reuse the same zoom-independent viewport frame as other floating modals.
 const {viewportStyle,antiZoomStyle}=useVisualViewportModal({zIndex:1000,backgroundColor:'#101426'})
 const viewportWidth=parseFloat(antiZoomStyle.width),viewportHeight=parseFloat(antiZoomStyle.height)
 // Do not use the inset shorthand here: it resets top/left after the spread
 // applies them, leaving the dialog at its offscreen static position on mount.
 const overlayStyle={...antiZoomStyle,position:'fixed',right:'auto',bottom:'auto',left:viewportStyle.left,top:viewportStyle.top,zIndex:1000,display:'block',
  '--playback-width':antiZoomStyle.width,'--playback-height':antiZoomStyle.height}
 const [speed,setSpeed]=useState(10.5),[cover,setCover]=useState(0),[rate,setRate]=useState(1)
 const [a,setA]=useState(null),[b,setB]=useState(null)
 const [simpleEffects,setSimpleEffects]=useState(true)
 const [tapEffects,setTapEffects]=useState(true),[brightness,setBrightness]=useState(100)
 const loop=a!==null&&b!==null&&b>a
 const markStart=()=>{setA(clock.current);if(b!==null&&b<=clock.current)setB(null)}
 const markEnd=()=>{if(clock.current>(a??0)){if(a===null)setA(0);setB(clock.current)}}
 state.current={playing,speed,cover,rate,loop,a,b,brightness,tapEffects,simpleEffects}
 const seek=value=>{clock.current=clamp(Number(value)||0,0,end);setTime(clock.current)}
 useEffect(()=>{
  const before=document.activeElement,overflow=document.body.style.overflow
  document.body.style.overflow='hidden'
  const key=e=>{if(e.key==='Escape'){e.stopPropagation();if(clean){setClean(false);if(document.fullscreenElement===root.current)document.exitFullscreen?.().catch(()=>{})}else onClose()}}
  document.addEventListener('keydown',key,true)
  root.current.focus({preventScroll:true})
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key,true);before?.focus?.({preventScroll:true})}
 },[onClose,clean])
 useEffect(()=>{
  let disposed=false,frame=0,last=0,lastUi=0,lastWidth=0,lastHeight=0,painted=false
  setReady(false)
  const images=new Map(), names=new Set(['longNoteLine','traceLine_eff'])
  let hitEffect=()=>{},backdrop=()=>{}
  const jacketURL=chart.jacket||`https://asset.rilaksekai.com/cover/${String(chart.musicId).padStart(3,'0')}.webp`
  for(const n of chart.notes){
   names.add(n.kind==='tick'?`notes_long_among${n.gold?'_crtcl':''}`:n.kind==='trace'?`notes_friction_among${n.gold?'_crtcl':n.direction?'_flick':'_long'}`:`notes_${n.texture}`)
   if(n.kind==='trace')names.add(`notes_${n.texture}`)
   if(n.direction)names.add(`notes_flick_arrow${n.gold?'_crtcl':''}_0${Math.min(n.width,6)}${n.direction===3||n.direction===4?'_diagonal':''}`)
  }
  const loads=[...names].map(name=>new Promise(resolve=>{const img=new Image();images.set(name,img);img.onload=resolve;img.onerror=resolve;img.src=`${import.meta.env.BASE_URL}playback/skin2/${name}.png`}))
  loads.push(loadPlaybackBackdrop(jacketURL).then(draw=>{if(disposed)draw.dispose();else backdrop=draw}))
  loads.push(loadHitEffects().then(draw=>{if(disposed)draw.dispose();else hitEffect=draw}))
  // Integrate chart scroll-speed events independently of playback speed.
  const speeds=[{t:0,speed:1},...(chart.events||[]).filter(e=>e.kind==='speed')].sort((a,b)=>a.t-b.t)
  let distance=0
  speeds.forEach((e,i)=>{if(i)distance+=(e.t-speeds[i-1].t)*speeds[i-1].speed;e.distance=distance})
  const scrollAt=t=>{let lo=0,hi=speeds.length;while(lo+1<hi){const mid=(lo+hi)>>1;if(speeds[mid].t<=t)lo=mid;else hi=mid}const e=speeds[lo];return e.distance+(t-e.t)*e.speed}
  const notes=alignConnectionNotes(chart.notes,chart.paths||[]).filter(n=>!n.guide).map(n=>({...n,d:scrollAt(n.t)}))
  const bez=(p,u)=>{const v=1-u;return [0,1].map(k=>v*v*v*p[0][k]+3*v*v*u*p[1][k]+3*v*u*u*p[2][k]+u*u*u*p[3][k])}
  const holds=buildHoldTracks(chart.paths||[])
  const paths=(chart.paths||[]).map(p=>({...p,points:Array.from({length:101},(_,i)=>[bez(p.left,i/100),bez(p.right,i/100)])}))
  const ctx=canvas.current.getContext('2d',{alpha:false})
  const ribbons=createRibbonRenderer()
  const render=now=>{
   if(disposed)return
   const node=canvas.current,w=node.clientWidth,h=node.clientHeight,dpr=Math.min(devicePixelRatio||1,2)
   // Opening a mobile viewport overlay can precede its first layout. Do not
   // allocate zero-sized GPU surfaces or advance past the selected start time.
   // Keep requesting frames so layout recovery needs no pinch/resize event.
   if(w<=0||h<=0){last=0;frame=requestAnimationFrame(render);return}
   const s=state.current
   if(s.playing&&last){clock.current+=Math.min(now-last,250)/1000*s.rate;if(s.loop&&clock.current>=s.b)clock.current=s.a+(clock.current-s.a)%(s.b-s.a);else if(clock.current>=end){clock.current=end;setPlaying(false)}}
   last=now
   if(now-lastUi>70){setTime(clock.current);lastUi=now}
   if(node.width!==Math.round(w*dpr)||node.height!==Math.round(h*dpr)){node.width=Math.round(w*dpr);node.height=Math.round(h*dpr)}
   ctx.setTransform(dpr,0,0,dpr,0,0)
   backdrop(ctx,w,h,dpr)
   if(w!==lastWidth||h!==lastHeight){
    lastWidth=w;lastHeight=h
    const pause=node.parentElement.querySelector('.playback-stage-pause')
    if(pause&&backdrop.pauseStyle){
     const style=backdrop.pauseStyle(w,h)
     for(const key of ['width','height','right','top'])pause.style[key]=`${style[key]}px`
     const exit=node.parentElement.querySelector('.playback-exit')
     if(exit){for(const key of ['width','height','top'])exit.style[key]=`${style[key]}px`;exit.style.left=`${style.right}px`}
    }
   }
   const worldUnit=nativeWorldUnit(w,h)
   const half=HALF_WIDTH*worldUnit,bottom=h/2-JUDGMENT_Y*worldUnit,top=h/2-SPAWN_Y*worldUnit
   const point=(lane,q)=>{const depth=viewProgress(q);return [w/2+((mirrored?12-lane:lane)-6)/6*half*depth,top+(bottom-top)*depth]}
   const travel=displaySeconds(s.speed),current=scrollAt(clock.current)
   const q=(t,ratio=1)=>(scrollAt(t)-current)*ratio/travel
   const coverY=s.cover>0?top+(bottom-top)*coverProgress(s.cover):top
   backdrop.drawCover?.(ctx,w,h,s.cover,coverY)
   // Native note/slide shaders discard fragments above _NoteShowRate.
   ctx.save();ctx.beginPath();ctx.rect(0,coverY,w,Math.max(0,bottom-coverY+2));ctx.clip()
   const gpuRibbons=ribbons?.begin(w,h,dpr,s.brightness/100)
   for(const p of paths){
    if(p.end<clock.current)continue
    ctx.globalAlpha=s.brightness/100
    const ribbon=images.get(p.guide?'traceLine_eff':'longNoteLine')
    for(let i=1;i<p.points.length;i++){
     const prev=p.points[i-1],next=p.points[i],q0=q(prev[0][1],p.speedRatio),q1=q(next[0][1],p.speedRatio)
     if((q0<0&&q1<0)||(q0>1&&q1>1))continue
     const mix=(p,r,u)=>[p[0]+(r[0]-p[0])*u,p[1]+(r[1]-p[1])*u]
     let low=0,high=1
     if(q0!==q1){const u0=(0-q0)/(q1-q0),u1=(1-q0)/(q1-q0);low=Math.max(0,Math.min(u0,u1));high=Math.min(1,Math.max(u0,u1))}
     const corners=[mix(prev[0],next[0],low),mix(prev[1],next[1],low),mix(prev[1],next[1],high),mix(prev[0],next[0],high)].map(([lane,t])=>point(lane,q(t,p.speedRatio)))
     if(gpuRibbons)ribbons.add(ribbon,p.gold,corners,(i-1+low)/100,(i-1+high)/100)
     else drawRibbon(ctx,ribbon,p.gold,corners,(i-1+low)/100,(i-1+high)/100)
    }
   }
   if(gpuRibbons)ribbons.draw(ctx)
   ctx.globalAlpha=1
   const remaining=n=>(n.d-current)*(n.speedRatio??1)/travel
   const visible=notes.filter(n=>n.t>=clock.current&&remaining(n)>=-.1&&remaining(n)<=1).sort((a,b)=>remaining(b)-remaining(a))
   for(const n of visible){
    const depth=Math.max(0,remaining(n)),l=point(n.lane,depth),r=point(n.lane+n.width,depth)
    const projectedUnit=worldUnit*viewProgress(depth)
    const body=noteBodySize(n.width,projectedUnit)
    const center=(l[0]+r[0])/2
    const x=center-body.width/2,nw=body.width,nh=body.height
    const name=n.kind==='tick'?`notes_long_among${n.gold?'_crtcl':''}`:`notes_${n.texture}`
    const img=images.get(name)
    if(img?.naturalWidth){
     if(n.kind==='tick'){
      // Markers use their own sprite units, not the stretched body rectangle.
      const ppu=n.kind==='tick'?108:100
      const mw=img.naturalWidth/ppu*projectedUnit,mh=img.naturalHeight/ppu*projectedUnit
      ctx.drawImage(img,center-mw/2,l[1]-mh/2,mw,mh)
     }else{
      const border=NOTE_SPRITE.border,cap=Math.min(nw/2,body.border)
      ctx.drawImage(img,0,0,border,img.naturalHeight,x,l[1]-nh/2,cap,nh)
      ctx.drawImage(img,border,0,img.naturalWidth-border*2,img.naturalHeight,x+cap,l[1]-nh/2,nw-cap*2,nh)
      ctx.drawImage(img,img.naturalWidth-border,0,border,img.naturalHeight,x+nw-cap,l[1]-nh/2,cap,nh)
     }
    }
    if(n.kind==='trace'){
     const marker=images.get(`notes_friction_among${n.gold?'_crtcl':n.direction?'_flick':'_long'}`)
     if(marker?.naturalWidth){const mw=marker.naturalWidth/100*projectedUnit,mh=marker.naturalHeight/100*projectedUnit;ctx.drawImage(marker,center-mw/2,l[1]-mh/2,mw,mh)}
    }
    if(n.direction){
     const diagonal=n.direction===3||n.direction===4,right=(n.direction===4)!==mirrored
     const arrow=images.get(`notes_flick_arrow${n.gold?'_crtcl':''}_0${Math.min(n.width,6)}${diagonal?'_diagonal':''}`)
     if(arrow?.naturalWidth){
      const motion=flickMotion(clock.current,diagonal,right)
      ctx.save();ctx.globalAlpha=motion.alpha
      ctx.translate(center+motion.x*projectedUnit,l[1]-motion.y*projectedUnit)
      if(diagonal&&right)ctx.scale(-1,1)
      // Sprite pivot=(.5,0), PPU=108; independent of note body stretch.
      const aw=arrow.naturalWidth/108*projectedUnit,ah=arrow.naturalHeight/108*projectedUnit
      ctx.drawImage(arrow,-aw/2,-ah,aw,ah);ctx.restore()
     }
    }
   }
   ctx.restore()

   if(s.tapEffects)hitEffect.begin?.(ctx,w/2,bottom,worldUnit,s.simpleEffects)
   if(s.tapEffects)for(const n of notes){
    const age=clock.current-n.t;if(age<0||age>HIT_EFFECT_DURATION)continue
    const hitX=point(n.lane+n.width/2,0)[0]
    if(n.kind==='trace'||n.kind==='tick')hitEffect(ctx,n,age,hitX,bottom,worldUnit,'aura',mirrored)
    else{
     hitEffect(ctx,n,age,hitX,bottom,worldUnit,'lane',mirrored)
     hitEffect(ctx,n,age,hitX,bottom,worldUnit,'aura',mirrored)
    }
    if(n.kind!=='trace'&&n.kind!=='tick')hitEffect(ctx,n,age,point(n.lane+n.width/2,0)[0],bottom,worldUnit,'gen',mirrored)
    if(n.direction)hitEffect(ctx,n,age,point(n.lane+n.width/2,0)[0],bottom,worldUnit,'flash',mirrored)
   }
   if(s.tapEffects)for(const hold of holds)hitEffect.hold?.(ctx,hold,clock.current,mirrored)
   if(s.tapEffects)hitEffect.finish?.(ctx)
   if(!painted){painted=true;setReady(true)}
   frame=requestAnimationFrame(render)
  }
  const visibility=()=>{last=0};document.addEventListener('visibilitychange',visibility)
  Promise.all(loads).then(()=>{if(!disposed)frame=requestAnimationFrame(render)})
  return()=>{disposed=true;cancelAnimationFrame(frame);ribbons?.dispose();hitEffect.dispose?.();backdrop.dispose?.();document.removeEventListener('visibilitychange',visibility)}
 },[chart,end,mirrored])
 const number=(label,value,update,min,max,step)=> <label>{label}<input type="number" min={min} max={max} step={step} value={value} onChange={e=>{if(e.target.value!=='')update(clamp(Number(e.target.value),min,max))}} /></label>
 return <div ref={root} style={overlayStyle} data-portrait={viewportWidth<=760&&viewportHeight>viewportWidth} className={`playback-overlay ${clean?'playback-clean':''}`} role="dialog" aria-modal="true" aria-label={t.title} tabIndex={-1}>
  <div className="playback-body"><div className="playback-stage"><button className="playback-exit playback-round" aria-label={t.close} title={t.close} onClick={()=>{if(document.fullscreenElement===root.current)document.exitFullscreen?.().catch(()=>{});onClose()}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 4 12l8 8v-5h3a5 5 0 0 1 5 5v-8a5 5 0 0 0-5-5h-3z"/></svg></button>
  <canvas ref={canvas}/><button className="playback-fullscreen" onClick={toggleFull} aria-label={fullLabel} title={fullLabel}>{clean?'⤡':'⤢'}</button><button className="playback-stage-pause playback-round" disabled={!ready} onClick={()=>{if(clock.current>=end)seek(loop?a:0);setPlaying(v=>!v)}} aria-label={playing?t.pause:t.play}><img src={`${import.meta.env.BASE_URL}playback/layout/btn_stop.png`} alt=""/>{!playing&&<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="white"/><path d="m8 5 11 7-11 7z"/></svg>}</button></div><aside>
   <button disabled={!ready} className="playback-toggle" onClick={()=>{if(clock.current>=end)seek(loop?a:0);setPlaying(v=>!v)}}>{playing?'Ⅱ':'▶'} {playing?t.pause:t.play}</button>
   <div className="playback-loop-toolbar">
    <output>{stamp(time)} / {stamp(end)}</output>
    <button aria-pressed={a!==null} onClick={markStart}>{t.loopStart}</button>
    <button aria-pressed={b!==null} disabled={time<=(a??0)} onClick={markEnd}>{t.loopEnd}</button>
    <button disabled={a===null&&b===null} onClick={()=>{setA(null);setB(null)}}>{t.reset}</button>
   </div>
   <div className="playback-progress">
    <div className="playback-flags" aria-hidden="true">{[[a,'A',t.loopStart],[b,'B',t.loopEnd]].map(([value,label,title])=>value!==null&&<span key={label} className={`playback-flag flag-${label}`} style={{left:`${value/end*100}%`}} title={`${title} ${stamp(value)}`}>{label}</span>)}</div>
    <input aria-label={t.here} type="range" min="0" max={end} step=".01" value={time} onChange={e=>seek(e.target.value)}/>
   </div>
   {number(t.speed,speed,setSpeed,1,12,.01)}
   <div className="playback-steps">{[-1,-.1,-.01,.01,.1,1].map(n=><button key={n} onClick={()=>setSpeed(v=>Math.round(clamp(v+n,1,12)*100)/100)}>{n>0?'+':''}{n}</button>)}</div>
   {number(t.cover,cover,setCover,0,100,1)}
   <input aria-label={t.cover} type="range" min="0" max="100" value={cover} onChange={e=>setCover(+e.target.value)}/>
   {number(t.rate,rate,setRate,.25,3,.05)}
   <div className="playback-steps">{[.5,1,1.5,2,3].map(n=><button key={n} aria-pressed={rate===n} onClick={()=>setRate(n)}>{n}×</button>)}</div>
   <label className="playback-effects-toggle"><span>{t.effects}</span><input type="checkbox" checked={tapEffects} onChange={e=>setTapEffects(e.target.checked)}/></label>
   <label className="playback-effects-toggle"><span>{t.simpleEffects}</span><input type="checkbox" checked={simpleEffects} disabled={!tapEffects} onChange={e=>setSimpleEffects(e.target.checked)}/></label>
   {number(`${t.brightness} (%)`,brightness,setBrightness,0,100,1)}
   <input aria-label={t.brightness} type="range" min="0" max="100" value={brightness} onChange={e=>setBrightness(+e.target.value)}/>
  </aside></div>
 </div>
}
