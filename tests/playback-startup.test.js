import assert from 'node:assert/strict'
import {test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {rolldown} from 'rolldown'

// Exercise the actual playback effect without a browser, network, or GPU.
// The canvas starts with no layout, as it can when a mobile overlay opens.
test('playback waits for layout and paints without a viewport resize or zoom',async()=>{
 const effects=[],states=[],draws=[],frames=new Map()
 let nextFrame=0,focusOptions
 const ctx={setTransform(){},save(){},restore(){},beginPath(){},rect(){},clip(){}}
 const canvas={clientWidth:0,clientHeight:0,width:300,height:150,getContext:()=>ctx,parentElement:{querySelector:()=>null}}
 const root={focus:options=>{focusOptions=options}}
 const mock={
  useEffect:fn=>effects.push(fn),
  useRef:value=>({current:value}),
  useState:value=>{const index=states.length;states.push(value);return [value,next=>{states[index]=next}]},
  jsx:(type,props)=>{if(props.ref)props.ref.current=type==='canvas'?canvas:root;return {type,props}},
  backdrop:(context,w,h)=>draws.push([w,h]),
 }
 const saved=Object.fromEntries(['document','Image','requestAnimationFrame','cancelAnimationFrame','devicePixelRatio','__playbackTest'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
 globalThis.__playbackTest=mock
 globalThis.document={body:{style:{overflow:'visible'}},addEventListener(){},removeEventListener(){}}
 globalThis.Image=class{set src(value){queueMicrotask(()=>this.onload?.(value))}}
 globalThis.devicePixelRatio=2
 globalThis.requestAnimationFrame=fn=>{frames.set(++nextFrame,fn);return nextFrame}
 globalThis.cancelAnimationFrame=id=>frames.delete(id)
 let cleanups=[]
 const sources={
  react:'export const {useEffect,useRef,useState}=globalThis.__playbackTest',
  'react/jsx-runtime':'export const {jsx}=globalThis.__playbackTest;export const jsxs=jsx',
  viewport:`export default ()=>({viewportStyle:{left:0,top:0},antiZoomStyle:{width:'390px',height:'844px'}})`,
  backdrop:'export const loadPlaybackBackdrop=async()=>globalThis.__playbackTest.backdrop',
  visuals:'export const loadHitEffects=async()=>()=>{};export const createRibbonRenderer=()=>null;export const drawRibbon=()=>{};export const flickMotion=()=>({});export const HIT_EFFECT_DURATION=1',
  css:'',
 }
 try{
  const bundle=await rolldown({
   input:fileURLToPath(new URL('../src/chart-viewer/ChartPlayback.jsx',import.meta.url)),jsx:'react-jsx',
   define:{'import.meta.env.BASE_URL':'"/"'},logLevel:'silent',
   plugins:[{name:'playback-test',resolveId(id){
    const name=id==='react'||id==='react/jsx-runtime'?id:id.endsWith('useVisualViewportModal.ts')?'viewport':id.endsWith('playbackBackdrop.js')?'backdrop':id.endsWith('playbackVisuals.js')?'visuals':id.endsWith('.css')?'css':null
    return name===null?null:`test:${name}`
   },load(id){return id.startsWith('test:')?sources[id.slice(5)]:null}}],
  })
  const {output}=await bundle.generate({format:'esm'});await bundle.close()
  const {default:Playback}=await import('data:text/javascript;base64,'+Buffer.from(output[0].code).toString('base64'))
  const dialog=Playback({chart:{notes:[],paths:[],duration:120},startTime:25,language:'ko',onClose(){}})
  const style=dialog.props.style
  assert.equal(style.top,0);assert.equal(style.left,0)
  assert.equal(style.right,'auto');assert.equal(style.bottom,'auto')
  assert.equal(style.inset,undefined,'inset must not reset initial top/left to the offscreen static position')
  cleanups=effects.map(fn=>fn())
  await new Promise(resolve=>setImmediate(resolve))
  const tick=now=>{assert.equal(frames.size,1);const [[id,fn]]=frames;frames.delete(id);fn(now)}
  tick(100);tick(1000)
  assert.deepEqual(draws,[],'no draw calls with zero-size surfaces')
  assert.equal(canvas.width,300,'no zero-size backing store allocation')
  assert.equal(states[0],25,'selected playback time is preserved while layout is pending')
  assert.equal(states[2],false,'controls remain unready until the first paint')
  assert.deepEqual(focusOptions,{preventScroll:true},'opening must not pan the zoomed chart')
  canvas.clientWidth=390;canvas.clientHeight=219
  tick(2000)
  assert.deepEqual(draws,[[390,219]])
  assert.equal(states[0],25,'first visible frame still starts at the selected point')
  assert.equal(states[2],true)
  assert.equal(canvas.width,780);assert.equal(canvas.height,438)
  tick(2100);assert.equal(states[0],25.1)
  // A temporary zero-size layout during rotation must also recover unaided.
  canvas.clientHeight=0;tick(2200)
  canvas.clientWidth=844;canvas.clientHeight=390;tick(3000)
  assert.deepEqual(draws.at(-1),[844,390]);assert.equal(states[0],25.1)
  cleanups.reverse().forEach(fn=>fn?.());cleanups=[]
  assert.equal(frames.size,0,'closing cancels the pending frame')
  assert.equal(document.body.style.overflow,'visible')
 }finally{
  cleanups.reverse().forEach(fn=>fn?.())
  for(const [key,descriptor] of Object.entries(saved)){
   if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]
  }
 }
})
