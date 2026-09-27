import { CUSTOM_API } from '../custom-charts/api.js'

export function createChartViewer(root, { themes, onCapture }) {
  let disposed=false;
  const cleanups=[], timers=new Set(), frames=new Set(), requests=new Set();
  const lifetime=new AbortController();
  const $=id=>root.querySelector(`#${id}`);
  const previous={lang:document.documentElement.lang,title:document.title,background:document.documentElement.style.getPropertyValue('--chart-background')};
  document.documentElement.classList.add('chart-viewer-page');
  function listen(target,type,callback,options){
    if(!target)return;
    target.addEventListener(type,callback,options);
    cleanups.push(()=>target.removeEventListener(type,callback,options));
  }
  function requestAnimationFrame(callback){
    if(disposed)return 0;
    const id=window.requestAnimationFrame(time=>{frames.delete(id);if(!disposed)callback(time);});frames.add(id);return id;
  }
  function cancelAnimationFrame(id){window.cancelAnimationFrame(id);frames.delete(id);}
  function setTimeout(callback,delay){
    if(disposed)return 0;
    const id=window.setTimeout(()=>{timers.delete(id);if(!disposed)callback();},delay);timers.add(id);return id;
  }
  function clearTimeout(id){window.clearTimeout(id);timers.delete(id);}
  function createController(){const request=new AbortController();requests.add(request);return request;}

  const messages={
    ko:{menu:'메뉴',search:'곡 검색',searchPlaceholder:'곡명 · 작곡가 · 곡 번호',language:'언어',capture:'현재 화면 캡처',difficulty:'난이도',bpmJump:'BPM · 구간 이동',skillJump:'스킬 구간 이동',judgment:'판정 강화 표시',judgmentHelp:'선택한 조건의 종료선을 표시합니다. 적용 구간은 스킬 구간 색칠을 켜면 표시됩니다.',reset:'기본 조건으로',skillFill:'스킬 구간 색칠',mirror:'미러',loading:'채보 불러오는 중…',viewer:'채보 보기',interval:'8분음표 간격 {ms}ms',skill:'스킬 {n}',seconds:'{n}초',judgmentFrom:'{judge} 이상 → PERFECT',loadError:'채보를 불러오지 못했어요 ({error}).',missing:'{id}번 곡의 {difficulty} 채보가 없어요',empty:'채보 목록 없음',noResults:'검색 결과가 없어요',searchLoading:'검색 목록 불러오는 중…',searchError:'검색 목록을 불러오지 못했어요. 다시 시도해 주세요.',textureError:'일부 노트 이미지를 불러오지 못했어요.',captureLoading:'캡처용 이미지를 준비하는 중…',imageTimeout:'이미지 응답 시간 초과',imageError:'캡처 이미지 로딩 실패',chartChanged:'채보가 변경됐어요. 다시 캡처해 주세요.',imageFailed:'이미지 생성 실패',onlineOnly:'캡처는 웹사이트에서 사용할 수 있어요.',section:'{a}–{b} / {total} 구간',stats:'그리기 {ms}ms · {n}개 도형'},
    en:{menu:'Menu',search:'Search songs',searchPlaceholder:'Song · Composer · ID',language:'Language',capture:'Capture current view',difficulty:'Difficulty',bpmJump:'BPM · Jump to section',skillJump:'Jump to skill',judgment:'Accuracy skill markers',judgmentHelp:'Show end markers for the selected skills. Enable skill shading to show their active ranges.',reset:'Reset conditions',skillFill:'Shade skill ranges',mirror:'Mirror',loading:'Loading chart…',viewer:'Chart viewer',interval:'Eighth-note interval: {ms}ms',skill:'Skill {n}',seconds:'{n}s',judgmentFrom:'{judge} or better → PERFECT',loadError:'Could not load chart ({error}).',missing:'No {difficulty} chart for song {id}',empty:'No charts available',noResults:'No matching songs',searchLoading:'Loading songs…',searchError:'Could not load songs. Please try again.',textureError:'Some note images could not be loaded.',captureLoading:'Preparing capture…',imageTimeout:'Image request timed out',imageError:'Could not load capture image',chartChanged:'The chart changed. Please capture again.',imageFailed:'Could not create image',onlineOnly:'Capture is available on the website.',section:'Sections {a}–{b} / {total}',stats:'Render {ms}ms · {n} shapes'},
    ja:{menu:'メニュー',search:'楽曲検索',searchPlaceholder:'曲名・作曲者・楽曲ID',language:'言語',capture:'表示範囲をキャプチャ',difficulty:'難易度',bpmJump:'BPM・区間移動',skillJump:'スキル区間へ移動',judgment:'判定強化の表示',judgmentHelp:'選択した条件の終了線を表示します。スキル区間の色付けを有効にすると適用範囲も表示します。',reset:'初期条件に戻す',skillFill:'スキル区間を色付け',mirror:'ミラー',loading:'譜面を読み込み中…',viewer:'譜面ビューア',interval:'8分音符の間隔 {ms}ms',skill:'スキル{n}',seconds:'{n}秒',judgmentFrom:'{judge}以上 → PERFECT',loadError:'譜面を読み込めませんでした（{error}）。',missing:'楽曲{id}の{difficulty}譜面はありません',empty:'譜面がありません',noResults:'該当する楽曲がありません',searchLoading:'楽曲を読み込み中…',searchError:'楽曲を読み込めませんでした。もう一度お試しください。',textureError:'一部のノーツ画像を読み込めませんでした。',captureLoading:'キャプチャを準備中…',imageTimeout:'画像の読み込みがタイムアウトしました',imageError:'キャプチャ画像を読み込めませんでした',chartChanged:'譜面が変わりました。もう一度キャプチャしてください。',imageFailed:'画像を生成できませんでした',onlineOnly:'キャプチャはウェブサイトで利用できます。',section:'{a}–{b} / {total}区間',stats:'描画 {ms}ms・{n}図形'},
  };
  let language=(()=>{try{const saved=localStorage.getItem('chart-language');if(messages[saved])return saved;}catch{}const browser=(navigator.language||'en').slice(0,2);return messages[browser]?browser:'en';})();
  const t=(key,values={})=>(messages[language][key]||key).replace(/\{(\w+)\}/g,(_,name)=>values[name]??'');
  let songInfo=null,songCatalog=null,catalogPending=null,highlight=null,missingChart=null;
  const infoCache=new Map();
  function songTitle(info,forChart=false){
    const base=(language==='ko'?info?.title_ko:info?.title_jp)||info?.title_jp||info?.title_ko;
    if(forChart&&chart?.customChartId)return chart.customTitle?.trim()||({ko:'제목 없음',en:'Untitled',ja:'無題'}[language]);
    return base||chart?.title||'';
  }
  function songArtist(info,forChart=false){
    if(forChart&&chart?.customChartId)return chart.artist||'';
    return (language==='ko'?info?.composer:info?.composer_jp)||info?.composer_jp||info?.composer||chart?.artist||'';
  }
  function showNames(){
    if(disposed)return;
    if(!chart&&!songInfo)return;
    const title=songTitle(songInfo,true),artist=songArtist(songInfo,true);
    $('menu-song-title').textContent=title;$('menu-song-title').title=title;
    $('title').textContent=title+(artist?' - '+artist:'');$('jacket').alt=title;
    document.title=`${title} · ${t('viewer')}`;if(chart)schedule();
  }
  async function loadSongCatalog(){
    if(songCatalog)return songCatalog;
    if(!catalogPending)catalogPending=json('https://api.rilaksekai.com/api/songs').then(data=>{
      if(!Array.isArray(data))throw new Error('Invalid song catalog');
      songCatalog=data.map(song=>({
        id:Number(song.id),title_ko:song.title_ko,title_jp:song.title_jp,
        composer:song.composer,composer_jp:song.composer_jp,release_date:song.release_date,
        reading:[song.title_hi,song.title_hangul].filter(Boolean).join(' '),levels:song.levels||{},
      })).sort((a,b)=>releaseKey(b)-releaseKey(a)||b.id-a.id);
      for(const song of songCatalog)infoCache.set(song.id,song);
      return songCatalog;
    }).finally(()=>{catalogPending=null;});
    return catalogPending;
  }
  async function loadSongInfo(id){
    try{
      await loadSongCatalog();
      const data=infoCache.get(Number(id));
      if(data&&(chart?.musicId??Number(route?.[1]))===Number(id)){songInfo=data;showNames();}
    }catch{/* Chart loading is independent of the song API. Keep embedded names on failure. */}
  }
  function localize(){
    document.documentElement.lang=language;
    root.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
    root.querySelectorAll('[data-i18n-aria]').forEach(el=>{el.setAttribute('aria-label',t(el.dataset.i18nAria));el.title=t(el.dataset.i18nAria);});
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{el.placeholder=t(el.dataset.i18nPlaceholder);el.setAttribute('aria-label',el.placeholder);});
    root.querySelectorAll('[data-language]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.language===language)));
    showNames();if(chart){refreshChartTools();schedule();}judgmentControls();
    if(missingChart)$('message').textContent=t('missing',missingChart);
    if(!$('song-search-panel').hidden)renderSearch();
  }
  const canvas=$('canvas'),ctx=canvas.getContext('2d',{alpha:false}),scroll=document.scrollingElement;
  const ASSET='https://asset.rilaksekai.com',COL=272,LANE=16,TIME=360;
  const route=location.pathname.match(/^\/(\d+)(?:\/(easy|normal|hard|expert|master|append))?\/?$/i);
  const customRoute=location.pathname.match(/^\/custom\/([A-Za-z0-9_-]{1,128})\/?$/i);
  const customAPI=CUSTOM_API;
  let theme=themes[(route?.[2]||'master').toUpperCase()]??themes.MASTER;
  const color=(selector,property='fill')=>theme[selector][property];
  let chart,selected,rows=[],buckets=[],scale=1,baseUnit=0,unit=1,plotBottom=500,width=1,height=1,pixelRatio=1,frame=0,version=0,controller;
  let background=color('.background'),laneColor=color('.lane');
  document.documentElement.style.setProperty('--chart-background',background);
  const judgmentDefaults=['4-1','3-4','4-4'];
  let judgmentSelected=new Set(judgmentDefaults),capturing=false;
  // suite skills 5/6/7: judgment_up durations for rarity 2/3/4, levels 1–4.
  const judgments=[2,3,4].flatMap(rarity=>[1,2,3,4].map(level=>({id:`${rarity}-${level}`,rarity,level,duration:3+rarity*.5+level*.5,label:`★${rarity} Lv.${level}`})));
  const cache=new Map(),textures=new Map(),sprites=new Map();
  // Desktop shortcuts now scale the chart, not the browser. Do not carry a
  // stale DPR reference across pages or monitors; only compensate native pinch.
  try{sessionStorage.removeItem('chart-viewer-ui-dpr');}catch{}
  function resizeFloatingUI(){
    const viewport=window.visualViewport;
    const zoom=viewport?.scale||1;
    const overlay=$('floating-ui');
    overlay.style.left=`${viewport?.offsetLeft||0}px`;overlay.style.top=`${viewport?.offsetTop||0}px`;
    overlay.style.width=`${(viewport?.width||window.innerWidth)*zoom}px`;
    overlay.style.height=`${(viewport?.height||window.innerHeight)*zoom}px`;
    overlay.style.transform=`scale(${1/zoom})`;
  }
  // Use document scrolling, like a standalone image. A nested overflow
  // scroller loses momentum when it hands a gesture to the pinch viewport.
  // A cropped detail layer sharpens only the visible screen after movement.
  // The broad base bitmap stays underneath for native scrolling/pinch zoom.
  const detailCanvas=document.createElement('canvas');
  const detailContext=detailCanvas.getContext('2d',{alpha:false});
  detailCanvas.hidden=true;canvas.after(detailCanvas);
  let paintX=0,paintY=0,paintWidth=0,paintHeight=0,painted=false,dirty=true;
  let pinching=false,viewportTimer=0,viewportSettling=false;
  let detailTimer=0,detailRatio=0,detailFrame=0,detailBounds=null;
  const schedule=(invalidate=true)=>{if(disposed)return;if(invalidate!==false){dirty=true;queueDetail(true);}if(!frame)frame=requestAnimationFrame(draw);};
  const overscan=()=>Math.min(160,scroll.clientWidth*.3);

  function queueDetail(invalidate=false){
    if(invalidate){detailCanvas.hidden=true;detailBounds=null;}
    clearTimeout(detailTimer);
    detailTimer=setTimeout(sharpen,180);
  }
  function sharpen(){
    if(!chart||pinching||viewportSettling||dirty)return;
    const viewport=window.visualViewport;
    const vx=viewport?.pageLeft??scroll.scrollLeft,vy=viewport?.pageTop??scroll.scrollTop;
    const vw=Math.min(viewport?.width||scroll.clientWidth,scroll.scrollWidth-vx);
    const vh=Math.min(viewport?.height||scroll.clientHeight,scroll.scrollHeight-vy);
    const pad=Math.min(96/(viewport?.scale||1),vw*.25),guard=pad*.2;
    if(detailBounds&&vx>=detailBounds.x+(detailBounds.x>0?guard:0)&&vy>=detailBounds.y+(detailBounds.y>0?guard:0)&&
      vx+vw<=detailBounds.x+detailBounds.w-(detailBounds.x+detailBounds.w<scroll.scrollWidth?guard:0)&&
      vy+vh<=detailBounds.y+detailBounds.h-(detailBounds.y+detailBounds.h<scroll.scrollHeight?guard:0))return;
    // Keep a small high-resolution margin so panning reuses the sharp bitmap.
    const x=Math.max(0,vx-pad),y=Math.max(0,vy-pad);
    const w=Math.min(vw+pad*2,scroll.scrollWidth-x),h=Math.min(vh+pad*2,scroll.scrollHeight-y);
    if(w<=0||h<=0)return;
    const mobile=matchMedia('(pointer: coarse)').matches,maxSide=mobile?4096:8192;
    const ratio=Math.min((window.devicePixelRatio||1)*(viewport?.scale||1),
      maxSide/w,maxSide/h,Math.sqrt((mobile?6000000:10000000)/(w*h)));
    if(ratio<=pixelRatio*1.01)return;
    if(Math.abs(detailRatio-ratio)>.001){sprites.clear();detailRatio=ratio;}
    const bw=Math.max(1,Math.ceil(w*ratio)),bh=Math.max(1,Math.ceil(h*ratio));
    if(detailCanvas.width!==bw)detailCanvas.width=bw;
    if(detailCanvas.height!==bh)detailCanvas.height=bh;
    detailCanvas.style.width=`${w}px`;detailCanvas.style.height=`${h}px`;
    detailCanvas.style.left=`${x}px`;detailCanvas.style.top=`${y}px`;
    render({ctx:detailContext,unit,width:w,height:h,pixelRatio:ratio,offsetX:x,offsetY:y,assets:textures});
    // Never expose the cleared backing store before its replacement is ready.
    detailBounds={x,y,w,h};detailCanvas.hidden=false;
  }
  function pan(){
    queueDetail();schedule(false);
    if(!detailFrame)detailFrame=requestAnimationFrame(()=>{detailFrame=0;sharpen();});
  }

  function texture(name,store=textures){
    if(store!==textures)return store.get(name)??{ready:false};
    if(!textures.has(name)){
      const entry={image:new Image(),ready:false,failed:false};textures.set(name,entry);
      entry.image.crossOrigin='anonymous';
      entry.image.onload=()=>{if(disposed)return;entry.ready=true;schedule();};
      entry.image.onerror=()=>{if(disposed)return;entry.failed=true;$('texture-status').textContent=t('textureError');schedule();};
      entry.image.src=`${import.meta.env.BASE_URL}notes/${name}.png`;
    }
    return textures.get(name);
  }
  function arrowName(n){return `notes_flick_arrow${n.gold?'_crtcl':''}_0${Math.min(n.width,6)}${n.direction===3||n.direction===4?'_diagonal':''}`;}
  function warmTextures(){
    for(const n of chart.notes){
      if(n.guide)continue;
      texture(n.kind==='tick'?`notes_long_among${n.gold?'_crtcl':''}`:`notes_${n.texture}`);
      if(n.kind==='trace')texture(`notes_friction_among${n.gold?'_crtcl':n.direction?'_flick':'_long'}`);
      if(n.direction)texture(arrowName(n));
    }
  }
  async function loadCaptureSafeImage(url,signal){
    // Reload avoids reusing an earlier no-CORS image response. Decode an
    // independent image, rather than relying on the hidden semantic footer.
    const response=await fetch(url,{mode:'cors',cache:'reload',signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const objectUrl=URL.createObjectURL(await response.blob());
    try{
      const image=new Image();image.src=objectUrl;await image.decode();
      return {image,ready:true,corsSafe:true};
    }finally{URL.revokeObjectURL(objectUrl);}
  }
  async function loadCover(url,selectionId){
    const key=`cover:${url}`;
    const cached=textures.get(key);
    if(cached?.ready){textures.set('cover',cached);schedule();return;}
    const abort=createController(),timeout=setTimeout(()=>abort.abort(),15000);
    try{
      const cover=await loadCaptureSafeImage(url,abort.signal);
      if(disposed)return;
      textures.set(key,cover);
      if(selectionId===version){textures.set('cover',cover);schedule();}
    }catch(error){
      if(selectionId===version)$('texture-status').textContent=`${t('imageError')}: cover (${error.message})`;
    }finally{clearTimeout(timeout);requests.delete(abort);}
  }
  // Render the same three pieces used by SVG symbols. Cache at the current
  // display resolution so drawing notes doesn't re-stretch the PNG each frame.
  function noteSprite(n,density=unit*pixelRatio,store=textures){
    const source=texture(`notes_${n.texture}`,store);if(!source.ready)return null;
    const key=`${store===textures?'view':'capture'}:${n.texture}:${n.width}:${density.toFixed(4)}`;
    if(sprites.has(key))return sprites.get(key);
    const w=LANE*(n.width+1),h=16;
    const image=document.createElement('canvas');image.width=Math.max(1,Math.ceil(w*density));image.height=Math.max(1,Math.ceil(h*density));
    const g=image.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.scale(image.width/w,image.height/h);
    const cap=h/56*32,mid=Math.max(0,LANE*n.width-cap-2),pad=(w-2*cap-mid)/2;
    const sx=source.image.naturalWidth/118,sy=source.image.naturalHeight/62;
    g.drawImage(source.image,3*sx,3*sy,32*sx,56*sy,pad,0,cap,h);
    if(mid)g.drawImage(source.image,31*sx,3*sy,sx,56*sy,pad+cap,0,mid,h);
    g.drawImage(source.image,83*sx,3*sy,32*sx,56*sy,pad+cap+mid,0,cap,h);
    sprites.set(key,image);return image;
  }
  function bucketChart(){
    const active=judgments.filter(j=>judgmentSelected.has(j.id));
    const ranges=chart.events.filter(e=>e.kind==='skill').flatMap(e=>active.map(j=>({...j,start:e.t,end:e.t+j.duration,number:e.number})));
    buckets=chart.columns.map(c=>({...c,notes:[],paths:[],bars:[],events:[],ticks:[],judgments:[]}));
    // Assign once after load, with endpoint overlap to match SVG column edges.
    for(const b of buckets){
      b.notes=chart.notes.filter(n=>n.t>=b.start-.00001&&n.t<=b.end+.00001);
      b.paths=chart.paths.filter(p=>p.end>=b.start&&p.start<=b.end);
      for(const bar of chart.bars){
        if(bar.t>=b.start-.00001&&bar.t<=b.end+.00001)b.bars.push({t:bar.t,label:`#${bar.number-1}`,major:true});
        for(const t of bar.beats)if(t>b.start&&t<b.end)b.bars.push({t,major:false});
      }
      b.ticks=(chart.ticks??[]).filter(t=>t.t>=b.start-.00001&&t.t<=b.end+.00001);
      b.judgments=ranges.filter(j=>j.end>=b.start&&j.start<=b.end);
      b.events=chart.events.filter(e=>e.t>=b.start-.00001&&e.t<=b.end+.00001);
    }
  }
  function resize(anchor){
    queueDetail(true);
    resizeFloatingUI();
    const old=unit,x=scroll.scrollLeft/old,y=scroll.scrollTop/old;
    const maxDuration=Math.max(1,...buckets.map(b=>b.end-b.start));
    plotBottom=maxDuration*TIME+64;
    if(!baseUnit)baseUnit=Math.max(.03,(scroll.clientHeight-16)/(plotBottom+320));
    unit=baseUnit*scale;updateHighlight();
    if(Math.abs(old-unit)>.00001)sprites.clear();
    const totalWidth=buckets.length*COL+80;
    $('space').style.width=`${totalWidth*unit}px`;$('space').style.height=`${(plotBottom+320)*unit}px`;
    width=Math.max(1,scroll.clientWidth);height=Math.max(1,scroll.clientHeight);
    // Allocate only once the pinch has settled, not on every viewport event.
    // Bound mobile backing-store memory instead of growing the entire layout
    // viewport by the square of the pinch factor.
    const pad=overscan(),surfaceWidth=width+pad*2,surfaceHeight=height+pad*2;
    const requestedRatio=(window.devicePixelRatio||1);
    const mobile=matchMedia('(pointer: coarse)').matches;
    const maxPixels=mobile?6000000:16000000,maxSide=mobile?4096:8192;
    const maxRatio=Math.min(maxSide/surfaceWidth,maxSide/surfaceHeight,Math.sqrt(maxPixels/(surfaceWidth*surfaceHeight)));
    const nextRatio=Math.max(.1,Math.min(requestedRatio,maxRatio));
    if(Math.abs(pixelRatio-nextRatio)>.001){pixelRatio=nextRatio;sprites.clear();}
    // Even assigning the current offset can cancel native momentum. Only
    // reposition when the user actually changes the chart's own zoom.
    if(anchor){scroll.scrollLeft=anchor.x*unit-anchor.clientX;scroll.scrollTop=anchor.y*unit-anchor.clientY;}
    else if(Math.abs(old-unit)>.00001){scroll.scrollLeft=x*unit;scroll.scrollTop=y*unit;}
    dirty=true;
    // Resizing clears a canvas (black for alpha:false). Paint synchronously
    // in the same task so the cleared buffer is never submitted as a frame.
    if(frame){cancelAnimationFrame(frame);frame=0;}
    draw(true);
  }
  function draw(force=false){
    frame=0;
    if(force!==true&&(pinching||viewportSettling))return;
    const sx=scroll.scrollLeft,sy=scroll.scrollTop;
    if(painted&&!dirty&&sx>=paintX&&sy>=paintY&&sx+width<=paintX+paintWidth&&sy+height<=paintY+paintHeight)return;
    const pad=overscan();paintX=Math.max(0,sx-pad);paintY=Math.max(0,sy-pad);
    paintWidth=width+pad*2;paintHeight=height+pad*2;
    const nextWidth=Math.max(1,Math.round(paintWidth*pixelRatio)),nextHeight=Math.max(1,Math.round(paintHeight*pixelRatio));
    if(canvas.width!==nextWidth)canvas.width=nextWidth;
    if(canvas.height!==nextHeight)canvas.height=nextHeight;
    canvas.style.width=`${paintWidth}px`;canvas.style.height=`${paintHeight}px`;
    canvas.style.left=`${paintX}px`;canvas.style.top=`${paintY}px`;
    render({ctx,unit,width:paintWidth,height:paintHeight,pixelRatio,offsetX:paintX,offsetY:paintY,assets:textures});
    painted=true;dirty=false;
    queueDetail();
  }
  let zoomFrame=0,pendingScale=null,zoomAnchor=null,resetZoomTimer=0;
  function queueChartZoom(factor,clientX=scroll.clientWidth/2,clientY=scroll.clientHeight/2){
    if(!chart||document.querySelector('.chart-capture-root'))return;
    clearTimeout(resetZoomTimer);
    pendingScale=Math.max(.5,Math.min(32,(pendingScale??scale)*factor));
    zoomAnchor={x:(scroll.scrollLeft+clientX)/unit,y:(scroll.scrollTop+clientY)/unit,clientX,clientY};
    if(!zoomFrame)zoomFrame=requestAnimationFrame(()=>{
      zoomFrame=0;scale=pendingScale;pendingScale=null;resize(zoomAnchor);
    });
  }
  listen(document,'wheel',event=>{
    if(!event.ctrlKey&&!event.metaKey)return;
    event.preventDefault();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?scroll.clientHeight:1);
    queueChartZoom(Math.exp(-Math.max(-120,Math.min(120,delta))*.0025),event.clientX,event.clientY);
  },{passive:false});
  listen(document,'keydown',event=>{
    if((!event.ctrlKey&&!event.metaKey)||event.altKey)return;
    if(['+','=','-','_'].includes(event.key)){
      event.preventDefault();queueChartZoom(event.key==='-'||event.key==='_'?1/1.2:1.2);
    }else if(event.key==='0'){
      // Keep the browser's native Ctrl/Cmd+0 so previously saved browser zoom
      // can also be reset. Fit the chart after that default action finishes.
      if(zoomFrame)cancelAnimationFrame(zoomFrame);zoomFrame=0;pendingScale=null;
      clearTimeout(resetZoomTimer);
      resetZoomTimer=setTimeout(()=>{
        if(!chart)return;scale=1;baseUnit=0;resize({x:0,y:0,clientX:0,clientY:0});
      },100);
    }
  });
  function render(view){
    const {ctx,unit,width,height,pixelRatio,offsetX,offsetY,assets,metadata=false}=view;
    const began=performance.now();
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
    if(!chart)return;
    ctx.scale(unit,unit);ctx.translate(-offsetX/unit,-offsetY/unit);
    const start=Math.max(0,Math.floor((offsetX/unit-40)/COL));
    const end=Math.min(buckets.length-1,Math.floor(((offsetX+width)/unit-40)/COL));
    const mirror=$('mirror').checked;
    const nx=(lane,left)=>left+(mirror?12-lane:lane)*LANE;
    const y=(t,b)=>plotBottom-(t-b.start)*TIME;
    let count=0;
    for(let col=start;col<=end;col++){
      const b=buckets[col],left=col*COL+80,top=y(b.end,b),bottom=plotBottom;
      ctx.fillStyle=laneColor;ctx.fillRect(left,top-32,192,bottom-top+64);
      ctx.save();ctx.beginPath();ctx.rect(left-40,top-32,COL,bottom-top+64);ctx.clip();
      ctx.strokeStyle=color('.lane-line','stroke');ctx.lineWidth=1;
      for(let lane=0;lane<=12;lane++){ctx.beginPath();ctx.moveTo(left+lane*LANE,top-32);ctx.lineTo(left+lane*LANE,bottom+32);ctx.stroke();}
      for(const bar of b.bars){ctx.strokeStyle=color(bar.major?'.bar-line':'.beat-line','stroke');ctx.lineWidth=bar.major?4:1;ctx.beginPath();ctx.moveTo(left,y(bar.t,b));ctx.lineTo(left+192,y(bar.t,b));ctx.stroke();}
      for(const p of b.paths){
        const point=edge=>edge.map(([lane,t])=>[nx(lane,left),y(t,b)]),l=point(p.left),r=point(p.right);
        ctx.fillStyle=color(p.gold?'.slide-critical':'.slide');
        if(p.guide){const g=ctx.createLinearGradient(0,y(p.start,b),0,y(p.end,b));g.addColorStop(0,color(p.gold?'#decoration-critical-gradient':'#decoration-gradient','--color-start'));g.addColorStop(1,color(p.gold?'#decoration-critical-gradient':'#decoration-gradient','--color-stop'));ctx.fillStyle=g;}
        ctx.beginPath();ctx.moveTo(...l[0]);ctx.bezierCurveTo(...l[1],...l[2],...l[3]);ctx.lineTo(...r[3]);ctx.bezierCurveTo(...r[2],...r[1],...r[0]);ctx.closePath();ctx.fill();count++;
      }
      // Each selected condition gets its own comparison strip, so overlapping
      // ranges and equal-duration conditions stay distinguishable.
      const active=judgments.filter(j=>judgmentSelected.has(j.id));
      for(const j of b.judgments){
        const index=active.findIndex(a=>a.id===j.id),strip=192/Math.max(1,active.length);
        const y0=y(Math.min(j.end,b.end),b),y1=y(Math.max(j.start,b.start),b);
        if($('skill-fill').checked){
          ctx.fillStyle=color('.skill-judg-text')+'28';ctx.fillRect(left+index*strip,y0,strip,y1-y0);
          ctx.strokeStyle=color('.skill-judg-flag','stroke');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left+index*strip+1,y0);ctx.lineTo(left+index*strip+1,y1);ctx.stroke();
        }
        ctx.strokeStyle=color('.skill-judg-flag','stroke');ctx.lineWidth=2;
        if(j.end>=b.start&&j.end<=b.end){ctx.setLineDash([5,3]);ctx.beginPath();ctx.moveTo(left,y(j.end,b));ctx.lineTo(left+192,y(j.end,b));ctx.stroke();ctx.setLineDash([]);}
      }
      // Notes, relay markers, then flick arrows, as in the SVG renderer.
      const visible=b.notes.filter(n=>!n.guide&&y(n.t,b)*unit-offsetY>=-60&&y(n.t,b)*unit-offsetY<=height+60);
      for(const n of visible){
        const x=Math.min(nx(n.lane,left),nx(n.lane+n.width,left)),cy=y(n.t,b);
        if(n.kind==='tick')continue;
        const sprite=noteSprite(n,unit*pixelRatio,assets);
        if(sprite)ctx.drawImage(sprite,x-8,cy-8,LANE*(n.width+1),16);
        count++;
      }
      for(const n of visible){
        const cy=y(n.t,b),cx=nx(n.lane+n.width/2,left);
        const name=n.kind==='tick'?`notes_long_among${n.gold?'_crtcl':''}`:n.kind==='trace'?`notes_friction_among${n.gold?'_crtcl':n.direction?'_flick':'_long'}`:null;
        if(name){const image=texture(name,assets),size=n.kind==='tick'?16:12;if(image.ready)ctx.drawImage(image.image,cx-size/2,cy-size/2,size,size);}
      }
      for(const n of [...visible].reverse())if(n.direction){
        const image=texture(arrowName(n),assets);if(!image.ready)continue;
        let direction=n.direction;if(mirror)direction=direction===3?4:direction===4?3:direction;
        const w=Math.min(n.width,6),h=24*((w+3)/3)**.75,aw=36*((w+.5)/3)**.75;
        const cx=nx(n.lane+n.width/2,left)+(direction===3?-4:direction===4?4:0),cy=y(n.t,b);
        // SVG <image> defaults to xMidYMid meet, not stretched pixels.
        const fit=Math.min(aw/image.image.naturalWidth,h/image.image.naturalHeight);
        const iw=image.image.naturalWidth*fit,ih=image.image.naturalHeight*fit;
        ctx.save();ctx.translate(cx,cy+4-h);if(direction===4)ctx.scale(-1,1);
        ctx.drawImage(image.image,-iw/2,(h-ih)/2,iw,ih);ctx.restore();
      }
      // Match SVG speed markers: full lane-width line, multiplier at the right.
      ctx.strokeStyle=color('.speed-line','stroke');ctx.fillStyle=color('.speed-text');
      ctx.lineWidth=1;ctx.font='12px Avenir, system-ui';ctx.textAlign='right';
      for(const e of b.events)if(e.kind==='speed'){
        const cy=y(e.t,b);ctx.beginPath();ctx.moveTo(left,cy);ctx.lineTo(left+192,cy);ctx.stroke();
        ctx.fillText(e.label,left+190,cy-2);
      }
      ctx.strokeStyle=color('.tick-line','stroke');ctx.fillStyle=color('.tick-text');ctx.lineWidth=1;ctx.font='12px system-ui';ctx.textAlign='right';
      for(const tick of b.ticks){const cy=y(tick.t,b);ctx.beginPath();ctx.moveTo(left-(tick.label?24:8),cy);ctx.lineTo(left,cy);ctx.stroke();if(tick.label)ctx.fillText(tick.label,left-4,cy-2);}
      const labels=new Map();
      for(const bar of b.bars)if(bar.major)labels.set(bar.t.toFixed(5),{t:bar.t,parts:[bar.label],color:color('.bar-count-text'),flag:color('.bar-count-flag','stroke')});
      for(const e of b.events){
        if(e.kind==='speed')continue;
        const key=e.t.toFixed(5),label=labels.get(key)??{t:e.t,parts:[],color:color('.event-text'),flag:color('.event-flag','stroke')};
        label.parts.push(e.label);label.color=color(e.kind==='skillEnd'?'.skill-end-text':'.event-text');label.flag=color(e.kind==='skillEnd'?'.skill-end-flag':'.event-flag','stroke');labels.set(key,label);
      }
      for(const j of b.judgments)if(j.end>=b.start&&j.end<=b.end){
        const key=j.end.toFixed(5),label=labels.get(key)??{t:j.end,parts:[],color:color('.skill-judg-text'),flag:color('.skill-judg-flag','stroke')};
        label.parts.push(`${j.label} END`);label.color=color('.skill-judg-text');label.flag=color('.skill-judg-flag','stroke');labels.set(key,label);
      }
      for(const label of labels.values()){
        const cy=y(label.t,b);ctx.strokeStyle=label.flag;ctx.lineWidth=4;
        ctx.beginPath();ctx.moveTo(left-40,cy);ctx.lineTo(left,cy);ctx.stroke();
        ctx.save();ctx.translate(left,cy);ctx.rotate(-Math.PI/2);ctx.fillStyle=label.color;ctx.font='900 12px system-ui';ctx.textAlign='left';ctx.fillText(label.parts.join(', '),8,-24);ctx.restore();
      }
      ctx.restore();
    }
    {
      // Titles and notes share the same transform and bitmap during zoom.
      const top=plotBottom+64;
      ctx.fillStyle=color('.meta');ctx.fillRect(0,top,buckets.length*COL+80,256);
      ctx.strokeStyle=color('.meta-line','stroke');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,top);ctx.lineTo(buckets.length*COL+80,top);ctx.stroke();
      const cover=assets.get('cover');if(cover?.ready)ctx.drawImage(cover.image,80,top+32,192,192);
      ctx.fillStyle=color('.subtitle');ctx.textAlign='left';ctx.font='700 48px system-ui';ctx.fillText(`${chart.difficulty} ${chart.level}`,352,top+88);
      ctx.fillStyle=color('.title');ctx.font='900 96px system-ui';ctx.fillText(`${songTitle(songInfo,true)}${songArtist(songInfo,true)?' - '+songArtist(songInfo,true):''}`,352,top+208);
    }
    if(metadata)return;
    $('position').textContent=t('section',{a:start+1,b:end+1,total:buckets.length});
    $('stats').textContent=t('stats',{ms:(performance.now()-began).toFixed(1),n:count});
  }
  async function json(url,signal=lifetime.signal){const response=await fetch(url,{signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();}
  function menu(open){$('menu').hidden=!open;$('menu-toggle').setAttribute('aria-expanded',String(open));if(!open){togglePanel('song-search',false);togglePanel('language',false);}}
  async function select(row){
    if(row.remote&&location.pathname!==`/${row.musicId}/${row.difficulty.toLowerCase()}`){
      location.assign(`/${row.musicId}/${row.difficulty.toLowerCase()}`);return;
    }
    const id=++version;controller?.abort();controller=createController();selected=row.id;chart=null;buckets=[];songInfo=null;highlight=null;$('jump-marker').hidden=true;
    menu(false);schedule();$('message').textContent=t('loading');
    refreshSelection(row);
    try{
      const data=row.data??cache.get(row.id)??await json(row.file,controller.signal);if(id!==version)return;
      cache.set(row.id,data);chart=data;bucketChart();warmTextures();refreshChartTools();
      theme=themes[row.difficulty]??themes.MASTER;
      background=color('.background');laneColor=color('.lane');
      document.documentElement.style.setProperty('--chart-background',background);
      $('title').textContent=`${row.title}${chart.artist?' - '+chart.artist:''}`;$('difficulty').textContent=`${row.difficulty}${chart.level?' '+chart.level:''}`;
      textures.delete('cover');$('texture-status').textContent='';
      void loadCover(chart.jacket||`${ASSET}/cover/${String(chart.musicId).padStart(3,'0')}.webp`,id);
      showNames();if(!chart.customChartId)void loadSongInfo(chart.musicId);$('message').textContent='';
      scale=1;baseUnit=0;resize();scroll.scrollLeft=0;scroll.scrollTop=0;schedule();
    }catch(error){if(id===version&&error.name!=='AbortError')$('message').textContent=t('loadError',{error:error.message});}
  }
  function refreshSelection(row){
    const order=['EASY','NORMAL','HARD','EXPERT','MASTER','APPEND'];
    $('difficulties').replaceChildren(...rows.filter(r=>r.musicId===row.musicId).sort((a,b)=>order.indexOf(a.difficulty)-order.indexOf(b.difficulty)).map(r=>{
      const button=document.createElement('button');button.textContent=r.level;button.dataset.difficulty=r.difficulty;button.className=`circle ${r.difficulty.toLowerCase()}${r.id===row.id?' filtered':''}`;button.title=`${r.difficulty} ${r.level}`;button.setAttribute('aria-label',button.title);
      button.setAttribute('aria-pressed',String(r.id===row.id));button.onclick=()=>select(r);return button;
    }));
  }
  function refreshChartTools(){
    const bpmEvents=chart.events.filter(e=>e.kind==='bpm');
    $('beat-intervals').classList.toggle('scrollable',bpmEvents.length>5);
    $('beat-intervals').tabIndex=bpmEvents.length>5?0:-1;
    $('beat-intervals').replaceChildren(...bpmEvents.map(e=>{
      const line=document.createElement('button');line.type='button';
      const bpm=document.createElement('strong'),time=document.createElement('span');
      bpm.textContent=`BPM ${e.bpm}`;time.textContent=`${e.t.toFixed(2)}s · ${t('interval',{ms:Math.round(30000/e.bpm)})}`;
      line.append(bpm,time);line.setAttribute('aria-label',`BPM ${e.bpm}, ${e.t.toFixed(2)}s`);
      line.onclick=()=>jump(e.t,`BPM ${e.bpm}`);return line;
    }));
    $('skill-jumps').replaceChildren(...chart.events.filter(e=>e.kind==='skill').map(e=>{
      const button=document.createElement('button');button.textContent=String(e.number);button.setAttribute('aria-label',t('skill',{n:e.number}));button.onclick=()=>jump(e.t,t('skill',{n:e.number}));return button;
    }));
  }
  function jump(time,label){
    const col=buckets.findIndex((b,i)=>time>=b.start&&(time<b.end||i===buckets.length-1));if(col<0)return;
    // Put the activation in the lower part of the view, leaving room for its duration above.
    scroll.scrollLeft=Math.max(0,(col*COL+40)*unit);
    scroll.scrollTop=Math.max(0,(plotBottom-(time-buckets[col].start)*TIME)*unit-height*.78);
    highlight={time,col,label};updateHighlight();
    const marker=$('jump-marker');marker.classList.remove('pulse');void marker.offsetWidth;marker.classList.add('pulse');
    menu(false);schedule();
  }
  function updateHighlight(){
    const marker=$('jump-marker');if(!highlight){marker.hidden=true;return;}
    const b=buckets[highlight.col];if(!b)return;
    marker.hidden=false;marker.style.left=`${(highlight.col*COL+80)*unit}px`;
    marker.style.top=`${(plotBottom-(highlight.time-b.start)*TIME)*unit}px`;marker.style.width=`${192*unit}px`;
    marker.firstElementChild.textContent=highlight.label;
  }
  function judgmentControls(){
    $('judgment-options').replaceChildren(...[4,3,2].map(rarity=>{
      const field=document.createElement('fieldset'),legend=document.createElement('legend');
      legend.textContent=`★${rarity} · ${t('judgmentFrom',{judge:rarity===4?'BAD':rarity===3?'GOOD':'GREAT'})}`;field.append(legend);
      for(const option of judgments.filter(j=>j.rarity===rarity)){
        const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=judgmentSelected.has(option.id);
        input.onchange=()=>{if(input.checked)judgmentSelected.add(option.id);else judgmentSelected.delete(option.id);if(chart){bucketChart();schedule();}};
        label.append(input,document.createTextNode(`Lv.${option.level} · ${t('seconds',{n:option.duration.toFixed(1)})}`));field.append(label);
      }
      return field;
    }));
  }
  $('judgment-reset').onclick=()=>{judgmentSelected=new Set(judgmentDefaults);judgmentControls();if(chart){bucketChart();schedule();}};
  judgmentControls();
  async function capture(){
    if(!chart||capturing)return;
    if(location.protocol==='file:'){$('capture-status').textContent=t('onlineOnly');return;}
    const selectedVersion=version,currentChart=chart;capturing=true;$('capture-view').disabled=true;
    $('capture-status').textContent=t('captureLoading');
    const viewport=window.visualViewport;
    const captureArea={x:viewport?.pageLeft??scroll.scrollLeft,y:viewport?.pageTop??scroll.scrollTop,width:viewport?.width||width,height:viewport?.height||height,unit};
    const mirrored=$('mirror').checked;
    const assets=new Map();
    try{
      const visibleNotes=buckets.filter((b,i)=>(i*COL+COL+80)*captureArea.unit>=captureArea.x&&(i*COL+40)*captureArea.unit<=captureArea.x+captureArea.width)
        .flatMap(b=>b.notes.filter(n=>{const y=(plotBottom-(n.t-b.start)*TIME)*captureArea.unit-captureArea.y;return y>=-80&&y<=captureArea.height+80;}));
      const names=new Set();for(const n of visibleNotes){
        if(n.guide)continue;
        names.add(n.kind==='tick'?`notes_long_among${n.gold?'_crtcl':''}`:`notes_${n.texture}`);
        if(n.kind==='trace')names.add(`notes_friction_among${n.gold?'_crtcl':n.direction?'_flick':'_long'}`);
        if(n.direction)names.add(arrowName(n));
      }
      const pending=[...names].map(name=>[name,`${import.meta.env.BASE_URL}notes/${name}.png`]);
      if((plotBottom+64)*captureArea.unit<captureArea.y+captureArea.height)
        pending.push(['cover',currentChart.jacket||`${ASSET}/cover/${String(chart.musicId).padStart(3,'0')}.webp`]);
      async function loadOne([name,url]){
        const cached=textures.get(name);
        if(cached?.ready&&(cached.corsSafe||cached.image.crossOrigin==='anonymous')){assets.set(name,cached);return;}
        const abort=createController(),timeout=setTimeout(()=>abort.abort(),15000);
        try{
          assets.set(name,await loadCaptureSafeImage(url,abort.signal));
        }catch(error){throw new Error(`${t(error.name==='AbortError'?'imageTimeout':'imageError')}: ${name} (${error.message})`);}
        finally{clearTimeout(timeout);requests.delete(abort);}
      }
      let cursor=0;
      await Promise.all(Array.from({length:4},async()=>{while(cursor<pending.length){const item=pending[cursor++];await loadOne(item);}}));
      if(selectedVersion!==version||mirrored!==$('mirror').checked)throw new Error(t('chartChanged'));
      const output=document.createElement('canvas');
      const ratio=Math.min((window.devicePixelRatio||1)*(viewport?.scale||1),4096/captureArea.width,4096/captureArea.height,Math.sqrt(6000000/(captureArea.width*captureArea.height)));
      output.width=Math.ceil(captureArea.width*ratio);output.height=Math.ceil(captureArea.height*ratio);
      render({ctx:output.getContext('2d',{alpha:false}),unit:captureArea.unit,width:captureArea.width,height:captureArea.height,pixelRatio:ratio,offsetX:captureArea.x,offsetY:captureArea.y,assets,metadata:true});
      const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));output.width=output.height=1;
      if(!blob)throw new Error(t('imageFailed'));
      if(disposed)return;
      await onCapture(blob,`${currentChart.customChartId||currentChart.musicId}-${currentChart.difficulty.toLowerCase()}${mirrored?'-mirror':''}-view.png`,language);
      if(disposed)return;
      menu(false);$('capture-status').textContent='';
    }catch(error){if(!disposed)$('capture-status').textContent=error.message;}
    finally{if(disposed)return;capturing=false;$('capture-view').disabled=false;sprites.clear();schedule();}
  }
  $('capture-view').onclick=()=>capture();

  function togglePanel(name,open){
    $(`${name}-panel`).hidden=!open;$(`${name}-toggle`).setAttribute('aria-expanded',String(open));
  }
  const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'');
  const SEARCH_ROW_HEIGHT=64;
  let searchMatches=[],searchFrame=0,searchWindow='';
  const releaseKey=song=>{const date=String(song.release_date||'').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);return date?Number(date[1])*10000+Number(date[2])*100+Number(date[3]):0;};
  async function openSearch(){
    const open=$('song-search-panel').hidden;togglePanel('song-search',open);togglePanel('language',false);
    if(!open)return;$('song-search').value='';$('song-search').focus({preventScroll:true});
    if(songCatalog){renderSearch(true);return;}
    $('search-results').textContent=t('searchLoading');
    try{
      await loadSongCatalog();
      if(disposed)return;
      renderSearch(true);
    }catch{if(disposed)return;catalogPending=null;$('search-results').textContent=t('searchError');}
  }
  function renderSearch(focusCurrent=false){
    if(!songCatalog)return;
    const query=normalize($('song-search').value);
    searchMatches=songCatalog.filter(song=>!query||[song.id,song.title_ko,song.title_jp,song.composer,song.composer_jp,song.reading].some(value=>normalize(value).includes(query)));
    const current=focusCurrent&&!query?searchMatches.findIndex(song=>song.id===(chart?.musicId??Number(route?.[1]))):0;
    const top=Math.max(0,current)*SEARCH_ROW_HEIGHT;
    renderSearchWindow(top,true);$('search-results').scrollTop=top;
  }
  function renderSearchWindow(top=$('search-results').scrollTop,force=false){
    const list=$('search-results');
    if(!searchMatches.length){list.textContent=t('noResults');return;}
    const start=Math.max(0,Math.floor(top/SEARCH_ROW_HEIGHT)-3);
    const end=Math.min(searchMatches.length,Math.ceil((top+list.clientHeight)/SEARCH_ROW_HEIGHT)+3);
    const windowKey=`${start}:${end}:${list.clientHeight}`;
    if(!force&&windowKey===searchWindow)return;searchWindow=windowKey;
    const spacer=height=>{const div=document.createElement('div');div.style.height=`${height}px`;div.setAttribute('aria-hidden','true');return div;};
    const difficulty=(chart?.difficulty||route?.[2]||'master').toLowerCase();
    const buttons=searchMatches.slice(start,end).map(song=>{
      const button=document.createElement('button');button.type='button';
      if(song.id===(chart?.musicId??Number(route?.[1])))button.setAttribute('aria-current','true');
      const cover=document.createElement('img');
      cover.alt='';cover.width=40;cover.height=40;cover.loading='lazy';cover.decoding='async';
      cover.src=`${ASSET}/cover/${String(song.id).padStart(3,'0')}.webp`;
      cover.onerror=()=>{cover.style.visibility='hidden';};
      const info=document.createElement('div');info.className='search-song-info';
      const title=document.createElement('strong'),artist=document.createElement('span');
      title.textContent=songTitle(song);artist.textContent=songArtist(song);info.append(title,artist);button.append(cover,info);
      button.title=`${title.textContent} · ${artist.textContent}`;
      button.onclick=()=>{const diff=song.levels[difficulty]!=null?difficulty:'master';location.assign(`/${song.id}/${diff}`);};return button;
    });
    // Tail space allows even the oldest song to align to the top when opened.
    list.replaceChildren(spacer(start*SEARCH_ROW_HEIGHT),...buttons,spacer((searchMatches.length-end)*SEARCH_ROW_HEIGHT+Math.max(0,list.clientHeight-SEARCH_ROW_HEIGHT)));
  }
  listen($('search-results'),'scroll',()=>{
    if(!searchFrame)searchFrame=requestAnimationFrame(()=>{searchFrame=0;if(!$('song-search-panel').hidden)renderSearchWindow();});
  },{passive:true});
  $('song-search-toggle').onclick=openSearch;$('song-search').oninput=()=>renderSearch();
  $('song-search').onkeydown=event=>{if(event.key==='Enter'){const song=searchMatches[Math.floor($('search-results').scrollTop/SEARCH_ROW_HEIGHT)];if(song){const diff=(chart?.difficulty||route?.[2]||'master').toLowerCase();location.assign(`/${song.id}/${song.levels[diff]!=null?diff:'master'}`);}}};
  $('language-toggle').onclick=()=>{togglePanel('language',$('language-panel').hidden);togglePanel('song-search',false);};
  root.querySelectorAll('[data-language]').forEach(button=>button.onclick=()=>{
    language=button.dataset.language;try{localStorage.setItem('chart-language',language);}catch{}
    localize();togglePanel('language',false);
  });

  listen(document,'pointerdown',event=>{
    if(highlight&&!event.target.closest('#skill-jumps, #beat-intervals, #jump-marker')){highlight=null;updateHighlight();}
  },{passive:true});
  $('menu-toggle').onclick=()=>menu($('menu').hidden);
  listen(document,'pointerdown',event=>{if(!$('menu').hidden&&!$('menu').contains(event.target)&&!$('menu-toggle').contains(event.target))menu(false);});
  listen(document,'keydown',event=>{if(event.key==='Escape'){menu(false);$('menu-toggle').focus();}});
  $('mirror').onchange=()=>schedule();$('skill-fill').onchange=()=>schedule();
  listen(document,'scroll',pan,{passive:true});
  let resizeFrame=0;
  let layoutWidth=scroll.clientWidth;
  let viewportScale=window.visualViewport?.scale||1;
  function viewportResize(){
    const nextScale=window.visualViewport?.scale||1;
    const scaleChanged=Math.abs(nextScale-viewportScale)>.001;
    viewportScale=nextScale;
    if(pinching||viewportSettling||scaleChanged){settleViewport();return;}
    // Mobile browser chrome changes viewport height during vertical scroll.
    // Keep the sharp layer and extend it instead of treating this as a pinch.
    resizeFloatingUI();
    pan();
  }
  function scheduleResize(){
    const nextWidth=scroll.clientWidth;
    if(nextWidth===layoutWidth&&!pinching&&!viewportSettling){
      width=Math.max(1,nextWidth);height=Math.max(1,scroll.clientHeight);
      resizeFloatingUI();pan();return;
    }
    layoutWidth=nextWidth;
    if(pinching||viewportSettling){settleViewport();return;}
    if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;resize();});
  }
  function settleViewport(){
    queueDetail(true);
    resizeFloatingUI();viewportSettling=true;clearTimeout(viewportTimer);
    viewportTimer=setTimeout(()=>{
      if(pinching){settleViewport();return;}
      viewportSettling=false;resize();
    },180);
  }
  // Browser-native pinch handles the gesture; keep the existing bitmap while
  // fingers move and sharpen it once, after the final viewport event.
  listen($('stage'),'touchstart',event=>{if(event.touches.length>1){pinching=true;settleViewport();}},{passive:true});
  const endTouch=event=>{if(pinching&&event.touches.length<2){pinching=false;settleViewport();}};
  listen(window,'touchend',endTouch,{passive:true});
  listen(window,'touchcancel',endTouch,{passive:true});
  listen(window,'resize',scheduleResize,{passive:true});
  listen(window.visualViewport,'resize',viewportResize,{passive:true});
  listen(window.visualViewport,'scroll',()=>{resizeFloatingUI();pan();},{passive:true});
  resizeFloatingUI();
  // DPR may change without a CSS-size resize (e.g. moving between monitors).
  let resolutionQuery;
  function watchResolution(){
    resolutionQuery?.removeEventListener('change',resolutionChanged);
    resolutionQuery=matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`);
    resolutionQuery.addEventListener('change',resolutionChanged);
  }
  function resolutionChanged(){watchResolution();scheduleResize();}
  watchResolution();
  localize();$('message').textContent=t('loading');
  (async()=>{try{
    const embedded=$('chart-bundle');
    if(customRoute){
      const code=customRoute[1];
      const data=await json(`${customAPI}/api/chart-json/${encodeURIComponent(code)}`);
      if(disposed)return;
      if(data.version!==3||!Array.isArray(data.notes)||!Array.isArray(data.columns))throw new Error('Invalid custom chart JSON');
      rows=[{id:`custom:${code}`,musicId:data.musicId,title:data.title,difficulty:data.difficulty,level:data.level,data}];
    }else if(route){
      const musicId=Number(route[1]),difficulty=(route[2]||'master').toLowerCase();
      const canonical=`/${musicId}/${difficulty}`;
      if(location.pathname!==canonical){location.replace(canonical+location.search+location.hash);return;}
      const folder=String(musicId).padStart(3,'0');
      rows=(await json(`${ASSET}/charts/${folder}/index.json`)).map(row=>({...row,remote:true,file:`${ASSET}/charts/${folder}/${row.difficulty.toLowerCase()}.json?v=3`}));
      const current=rows.find(row=>row.difficulty.toLowerCase()===difficulty);
      if(!current){
        missingChart={id:musicId,difficulty:difficulty.toUpperCase()};
        void loadSongInfo(musicId);
        if(rows.length)refreshSelection({...rows[0],id:''});
        throw new Error(t('missing',missingChart));
      }
      rows=[current,...rows.filter(row=>row!==current)];
    }else rows=embedded?JSON.parse(embedded.textContent):await json('/data/index.json');
    if(!rows.length)throw new Error(t('empty'));await select(rows[0]);
  }catch(error){if(!disposed)$('message').textContent=error.message;}})();
  return () => {
    disposed=true;version++;
    lifetime.abort();for(const request of requests)request.abort();requests.clear();
    for(const cleanup of cleanups)cleanup();
    resolutionQuery?.removeEventListener('change',resolutionChanged);
    for(const id of timers)window.clearTimeout(id);timers.clear();
    for(const id of frames)window.cancelAnimationFrame(id);frames.clear();
    for(const entry of textures.values()){entry.image.onload=null;entry.image.onerror=null;}
    for(const element of root.querySelectorAll('*')){
      element.onclick=null;element.onchange=null;element.oninput=null;element.onkeydown=null;element.onerror=null;
    }
    detailCanvas.remove();detailCanvas.width=detailCanvas.height=1;
    canvas.width=canvas.height=1;cache.clear();textures.clear();sprites.clear();infoCache.clear();
    document.documentElement.classList.remove('chart-viewer-page');
    document.documentElement.lang=previous.lang;document.title=previous.title;
    if(previous.background)document.documentElement.style.setProperty('--chart-background',previous.background);
    else document.documentElement.style.removeProperty('--chart-background');
  };
}
