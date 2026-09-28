// Source: 180mmd commit 9a7f0ea857ea9468457ef0b3def4af246a3b7ef4,
// apk_extract/decompiled/isil/IsilDump/Assembly-CSharp/Sekai/Live/LiveConfig.txt.
// Packed Vector2 constants: spawn (0,5.46), judgment centers +/-6.545,
// center spacing 1.19. Viewport framing is in playbackProjection.js.
export const SPAWN_Y = 5.46
export const JUDGMENT_Y = -2.96
export const LANE_WIDTH = 1.19
export const HALF_WIDTH = LANE_WIDTH * 6

export function displaySeconds(speed) {
  // 0x04E9EF38..0x04E9EF94: normalize, invert, native pow(base,1.31),
  // invert, then lerp(4,.35). Pow interpretation follows both call sites.
  const normalized = Math.max(0, Math.min(1, (speed - 1) / 11))
  return .35 + 3.65 * Math.pow(1 - normalized, 1.31)
}
export function viewProgress(remaining) {
  // 0x04E9F190..0x04E9F1E8: pow(1.06,(min(progress,2)-1)*45),
  // suppress <= .04 and nonfinite results; same factor drives position/scale.
  const p = Math.pow(1.06, (Math.min(1 - remaining, 2) - 1) * 45)
  return Number.isNaN(p) || p <= .04 ? 0 : p === Infinity ? 2 : p
}

// LiveUtility.CalcNoteShowRatePosition: interpolate from the first visible
// note position (not the vanishing point) to the judgment line.
export function coverProgress(percent) {
  const start = 0.072650254
  return start + (1 - start) * Math.max(0, Math.min(1, percent / 100))
}

// LiveUtility.CalcSpriteRendererSize (ISIL 0x04C04A74..0x04C04A94).
// BaseNoteView.Spawn passes LaneEnd - LaneStart (inclusive lane indices).
// live/note/custom01: notes_0..6 are 354x186, PPU 108, border 100/0/100/0;
// NormalNote/LongNote/FlickNote SpriteRenderer drawMode=Sliced, scale=(1,1,1).
export const NOTE_SPRITE = { width: 354, height: 186, ppu: 108, border: 100 }
export function noteBodySize(laneCount, projectedUnit) {
  return {
    width: (Math.fround(1.217778) * (laneCount - 1) + Math.fround(2.06)) * projectedUnit,
    height: Math.fround(1.722222) * projectedUnit,
    border: NOTE_SPRITE.border / NOTE_SPRITE.ppu * projectedUnit,
  }
}

// ConnectionNoteView positions markers with LaneStartF/LaneEndF. Display JSON
// retains cubic rails but older data still has integer marker lanes. Resolve
// interior markers on an unambiguous rail; don't guess at crossing holds.
export function alignConnectionNotes(notes, paths) {
  const value=(p,u,k)=>p[0][k]*(1-u)**3+3*p[1][k]*(1-u)**2*u+3*p[2][k]*(1-u)*u*u+p[3][k]*u**3
  return notes.map(note=>{
    if(note.kind!=='tick'||note.nativeId!=null)return note
    const matches=[]
    for(const path of paths){
      if(path.guide||!!path.gold!==!!note.gold||note.t<=path.start+1e-6||note.t>=path.end-1e-6)continue
      let lo=0,hi=1
      for(let i=0;i<24;i++){const u=(lo+hi)/2;if(value(path.left,u,1)<note.t)lo=u;else hi=u}
      const u=(lo+hi)/2,left=value(path.left,u,0),right=value(path.right,u,0)
      const center=note.lane+note.width/2
      if(center>=left&&center<=right)matches.push({left,right})
    }
    if(matches.length!==1)return note
    return {...note,lane:matches[0].left,width:matches[0].right-matches[0].left}
  })
}

// Display JSON stores a hold as adjoining cubic sections. Keep a single effect
// clock across joins; only join unique endpoints so crossing holds stay separate.
const cubic=(p,u,k)=>p[0][k]*(1-u)**3+3*p[1][k]*(1-u)**2*u+3*p[2][k]*(1-u)*u*u+p[3][k]*u**3
export function holdSpanAt(track,time){
 let low=0,high=track.segments.length
 while(low+1<high){const mid=(low+high)>>1;if(track.segments[mid].start<=time)low=mid;else high=mid}
 const p=track.segments[low],t=Math.max(p.start,Math.min(p.end,time))
 let a=0,b=1
 for(let i=0;i<24;i++){const u=(a+b)/2;if(cubic(p.left,u,1)<t)a=u;else b=u}
 const u=(a+b)/2,lane=cubic(p.left,u,0)
 return {lane,width:cubic(p.right,u,0)-lane}
}
export function buildHoldTracks(paths){
 const segments=paths.filter(p=>!p.guide&&p.end>p.start).sort((a,b)=>a.start-b.start)
 const key=(time,left,right,id)=>`${id??'legacy'}:`+[time,left,right].map(v=>Math.round(v*1e6)).join(':')
 const starts=new Map(),ends=new Map()
 for(const p of segments){
  const a=key(p.start,p.left[0][0],p.right[0][0],p.holdId),b=key(p.end,p.left[3][0],p.right[3][0],p.holdId)
  starts.set(a,[...(starts.get(a)||[]),p]);ends.set(b,[...(ends.get(b)||[]),p])
 }
 const used=new Set(),tracks=[]
 for(const first of segments){
  if(used.has(first))continue
  const track={start:first.start,end:first.end,gold:first.gold,segments:[]};let p=first
  while(p&&!used.has(p)){
   used.add(p);track.segments.push(p);track.end=p.end
   const join=key(p.end,p.left[3][0],p.right[3][0],p.holdId),next=starts.get(join)
   p=next?.length===1&&ends.get(join)?.length===1?next[0]:null
  }
  tracks.push(track)
 }
 return tracks
}
