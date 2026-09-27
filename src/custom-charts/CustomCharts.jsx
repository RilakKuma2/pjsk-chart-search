import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { getChoseong } from 'es-hangul'
import { customChartUrl, customRequest } from './api.js'
import './custom.css'

const DIFFS = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER', 'APPEND']
const LABELS = {
  ko: { title:'자작채보', saved:'저장된 채보', official:'공식 제작자', code:'채보 코드', open:'채보 불러오기', input:'채보 코드 또는 공유 주소 입력', invalid:'올바른 채보 코드를 입력해 주세요.', loading:'불러오는 중…', search:'곡명 · 채보 제목 · 제작자 · 코드 검색', recent:'최근 열람순', song:'곡명순', creator:'제작자순', level:'레벨순', difficulty:'난이도순', all:'모든 레벨', reset:'초기화', selected:'채보를 선택하세요', empty:'검색 결과가 없어요.', untitled:'제목 없음', copy:'코드 복사', copied:'복사됨', full:'전체 채보 보기', back:'뒤로', close:'닫기', retry:'다시 불러오기', options:'검색 옵션', sort:'정렬', order:'정렬 방향', preview:'채보 미리보기', count:'개', codeHelp:'코드를 입력하거나 저장된 채보에서 골라보세요.', home:'일반 채보 검색', copyError:'코드를 선택해서 복사해 주세요.' },
  en: { title:'CUSTOM CHARTS', saved:'Saved Charts', official:'Official Creators', code:'Chart ID', open:'Load Chart', input:'Chart code or shared URL', invalid:'Enter a valid chart code.', loading:'Loading…', search:'Song · Chart title · Creator · ID', recent:'Recently viewed', song:'Song title', creator:'Creator', level:'Level', difficulty:'Difficulty', all:'All levels', reset:'Reset', selected:'Select a chart', empty:'No matching charts.', untitled:'Untitled', copy:'Copy ID', copied:'Copied', full:'View Full', back:'Back', close:'Close', retry:'Reload', options:'Search options', sort:'Sort by', order:'Sort direction', preview:'Chart preview', count:'charts', codeHelp:'Enter a code or choose a saved chart.', home:'Official chart search', copyError:'Select the code to copy it.' },
  ja: { title:'カスタム譜面', saved:'保存された譜面', official:'公式クリエイター', code:'譜面コード', open:'譜面を読み込む', input:'譜面コードまたは共有URL', invalid:'有効な譜面コードを入力してください。', loading:'読み込み中…', search:'曲名・譜面タイトル・作者・コード', recent:'最近の閲覧順', song:'曲名順', creator:'作者順', level:'レベル順', difficulty:'難易度順', all:'すべてのレベル', reset:'リセット', selected:'譜面を選択してください', empty:'該当する譜面がありません。', untitled:'無題', copy:'コードをコピー', copied:'コピー済み', full:'譜面を開く', back:'戻る', close:'閉じる', retry:'再読み込み', options:'検索設定', sort:'並べ替え', order:'並び順', preview:'譜面プレビュー', count:'件', codeHelp:'コードを入力するか、保存された譜面を選んでください。', home:'通常譜面の検索', copyError:'コードを選択してコピーしてください。' },
}
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s/g, '').replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
const initialLanguage = () => { try { const saved=localStorage.getItem('chart-language'); if(LABELS[saved])return saved } catch {} return LABELS[navigator.language.slice(0,2)] ? navigator.language.slice(0,2) : 'en' }
const routeState = () => { const parts=location.pathname.split('/').filter(Boolean); return { saved:parts[1]==='saved', official:parts[2]==='official', selected:parts[2]==='official' ? parts[3]||'' : parts[2]||'' } }
const songName = (chart, lang) => (lang === 'ko' ? chart.title_ko : chart.title_jp) || chart.title_jp || chart.music_title || ''

function Preview({ chart, labels:t, inline=false, onClose }) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  useEffect(() => { setCopied(false);setCopyError(false) }, [chart?.id])
  if(!chart)return <aside className="custom-preview empty-preview">{t.selected}</aside>
  return <aside className={`custom-preview ${inline?'inline-preview':''}`}>
    <header><div><strong>{chart.custom_title || t.untitled}</strong><span>{chart.creator}</span></div>{onClose&&<button type="button" onClick={onClose} aria-label={t.close}>×</button>}</header>
    <div className="custom-preview-media">
      <iframe key={chart.id} src={customChartUrl(chart.id)} title={t.preview} loading="lazy" />
    </div>
    <div className="custom-code"><code>{chart.id}</code><button onClick={async()=>{try{await navigator.clipboard.writeText(chart.id);setCopied(true)}catch{setCopyError(true)}}}>{copied?t.copied:t.copy}</button></div>
    {copyError&&<p role="status">{t.copyError}</p>}
    <footer><a className="custom-primary" href={customChartUrl(chart.id)} target="_blank" rel="noopener noreferrer">{t.full} ↗</a></footer>
  </aside>
}

export default function CustomCharts() {
  const [lang,setLang]=useState(initialLanguage),t=LABELS[lang]
  const [mobile,setMobile]=useState(()=>matchMedia('(max-width:768px)').matches)
  useEffect(()=>{const query=matchMedia('(max-width:768px)');const update=()=>setMobile(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[])
  const [route,setRoute]=useState(routeState),[code,setCode]=useState(''),[result,setResult]=useState(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const selectedRow=useRef(null)
  const [charts,setCharts]=useState(null),[listError,setListError]=useState(''),[retry,setRetry]=useState(0)
  const [query,setQuery]=useState(''),[sort,setSort]=useState('recent'),[descending,setDescending]=useState(true)
  const [diffs,setDiffs]=useState([]),[level,setLevel]=useState(''),[options,setOptions]=useState(true),[limit,setLimit]=useState(80)
  const delayedQuery=useDeferredValue(query), listRef=useRef(null), sentinel=useRef(null), request=useRef(null)
  const navigate=path=>{history.pushState(null,'',path);setRoute(routeState())}
  const listPath=(selected='',official=route.official)=>`/custom/saved${official?'/official':''}${selected?`/${selected}`:''}`
  useEffect(()=>{
    document.documentElement.classList.add('custom-charts-page')
    const pop=()=>setRoute(routeState());window.addEventListener('popstate',pop)
    const escape=event=>{if(event.key==='Escape'&&routeState().saved){history.pushState(null,'','/custom');pop()}}
    window.addEventListener('keydown',escape)
    return()=>{document.documentElement.classList.remove('custom-charts-page');window.removeEventListener('popstate',pop);window.removeEventListener('keydown',escape);request.current?.abort()}
  },[])
  useEffect(()=>{document.title=`${t.title} · Project SEKAI`;document.documentElement.lang=lang;try{localStorage.setItem('chart-language',lang)}catch{}},[lang,t])
  useEffect(()=>{
    if(!route.saved||charts)return
    const abort=new AbortController();setListError('')
    customRequest('/api/chart-list',abort.signal).then(data=>{
      if(abort.signal.aborted)return
      setCharts(data.charts.filter(chart=>chart.has_json!==false).map(chart=>{const text=[chart.custom_title,chart.creator,chart.id,chart.music_id,chart.music_title,chart.title_ko,chart.title_jp,chart.title_hi,chart.title_hangul].join(' ');return {...chart,_search:normalize(text),_initials:normalize(getChoseong(text))}}))
    }).catch(e=>{if(!abort.signal.aborted)setListError(e.message)})
    return()=>abort.abort()
  },[route.saved,charts,retry])
  const filtered=useMemo(()=>{
    const base=(charts||[]).filter(c=>(!route.official||c.is_official)&&(!diffs.length||diffs.includes(c.difficulty))&&(!level||String(c.level)===level))
    const search=normalize(delayedQuery);let found=base.filter(c=>!search||c._search.includes(search))
    if(!found.length&&search.length>=2){const initials=normalize(getChoseong(delayedQuery));found=base.filter(c=>c._initials.includes(initials))}
    const key=c=>sort==='title'?songName(c,lang):sort==='creator'?c.creator:sort==='level'?Number(c.level)||0:sort==='difficulty'?DIFFS.indexOf(c.difficulty):c.accessed_at||''
    return found.sort((a,b)=>{const x=key(a),y=key(b);const cmp=typeof x==='number'?x-y:String(x).localeCompare(String(y),lang,{numeric:true});return (cmp||a.id.localeCompare(b.id))*(descending?-1:1)})
  },[charts,route.official,diffs,level,delayedQuery,sort,descending,lang])
  const selected=charts?.find(c=>c.id===route.selected)
  useEffect(()=>{
    if(!route.saved||!selected)return
    const frame=requestAnimationFrame(()=>selectedRow.current?.scrollIntoView({block:'nearest'}))
    return()=>cancelAnimationFrame(frame)
  },[route.saved,route.selected,selected,limit,mobile])
  const levels=useMemo(()=>[...new Set((charts||[]).filter(c=>!route.official||c.is_official).map(c=>String(c.level)))].sort((a,b)=>(parseInt(a)||0)-(parseInt(b)||0)),[charts,route.official])
  useEffect(()=>{setLimit(80);if(listRef.current)listRef.current.scrollTop=0},[filtered])
  useEffect(()=>{
    if(!route.selected)return
    const index=filtered.findIndex(c=>c.id===route.selected)
    if(index>=0)setLimit(n=>Math.max(n,index+20))
  },[route.selected,filtered])
  useEffect(()=>{
    if(!sentinel.current||!route.saved)return
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))setLimit(n=>Math.min(filtered.length,n+80))},{root:listRef.current,rootMargin:'400px'})
    observer.observe(sentinel.current);return()=>observer.disconnect()
  },[route.saved,filtered.length,limit])
  async function loadChart(event){
    event.preventDefault();let id=code.trim()
    try{if(/^https?:\/\//i.test(id))id=new URL(id).pathname.split('/').filter(Boolean).pop()||''}catch{}
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)){setError(t.invalid);return}
    request.current?.abort();const abort=new AbortController();request.current=abort;setBusy(true);setError('');setResult(null)
    try{const chart=await customRequest(`/api/chart-json/${encodeURIComponent(id)}`,abort.signal);if(abort.signal.aborted)return;setResult({id,custom_title:chart.customTitle,creator:chart.artist});setCharts(null)}
    catch(e){if(!abort.signal.aborted)setError(e.message)}finally{if(!abort.signal.aborted)setBusy(false)}
  }
  const retryList=()=>{setCharts(null);setRetry(n=>n+1)}
  return <main className="custom-site">
    <header className="custom-top"><div><a className="custom-brand" href="/custom">PROJECT SEKAI</a><h1>{t.title}</h1></div><nav><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value)}><option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option></select><button onClick={()=>navigate('/custom/saved')}>{t.saved}</button></nav></header>
    <section className="custom-content"><form className="custom-input-panel" onSubmit={loadChart}><label htmlFor="custom-code-input">{t.code}</label><input id="custom-code-input" value={code} onChange={e=>setCode(e.target.value)} placeholder={t.input} autoComplete="off" spellCheck={false}/><button className="custom-primary" disabled={busy}>{busy?t.loading:t.open}</button><p>{t.codeHelp}</p></form>
      {error&&<p className="custom-error" role="alert">{error}</p>}
      {result&&<Preview key={result.id} chart={result} labels={t}/>}
    </section>
    <footer className="custom-footer"><a href="/">{t.home}</a><p>This website is not affiliated with SEGA, Colorful Palette or Crypton.</p></footer>
    {route.saved&&<section className="custom-saved" aria-label={t.saved}>
      <header className="custom-saved-heading"><button onClick={()=>navigate('/custom')} aria-label={t.back}>←</button><h2>{t.saved}</h2><button className={route.official?'active':''} aria-pressed={route.official} onClick={()=>navigate(listPath('',!route.official))}>{t.official}</button><button onClick={retryList} aria-label={t.retry}>↻</button></header>
      <div className="custom-filters"><div className="custom-search-row"><input type="search" placeholder={t.search} aria-label={t.search} value={query} onChange={e=>setQuery(e.target.value)}/><button className="custom-options-toggle" aria-expanded={options} onClick={()=>setOptions(v=>!v)}>{t.options} {options?'▴':'▾'}</button></div>
        <div className={`custom-filter-options ${options?'':'collapsed'}`}><select aria-label={t.sort} value={sort} onChange={e=>setSort(e.target.value)}>{[['recent',t.recent],['title',t.song],['creator',t.creator],['level',t.level],['difficulty',t.difficulty]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button aria-label={t.order} onClick={()=>setDescending(v=>!v)}>{descending?'▼':'▲'}</button><select aria-label={t.level} value={level} onChange={e=>setLevel(e.target.value)}><option value="">{t.all}</option>{levels.map(n=><option key={n} value={n}>Lv. {n}</option>)}</select><button onClick={()=>{setQuery('');setSort('recent');setDescending(true);setDiffs([]);setLevel('')}}>{t.reset}</button><div className="custom-diffs">{DIFFS.map(diff=><button key={diff} className={`diff-${diff} ${diffs.includes(diff)?'active':''}`} aria-pressed={diffs.includes(diff)} onClick={()=>setDiffs(old=>old.includes(diff)?old.filter(x=>x!==diff):[...old,diff])}>{diff}</button>)}</div></div>
        <span className="custom-count" role="status">{charts?`${filtered.length.toLocaleString()} / ${charts.length.toLocaleString()} ${t.count}`:t.loading}</span>
      </div>
      <div className="custom-split"><div className="custom-list" ref={listRef}>
        {listError&&<div className="custom-error" role="alert">{listError}<button onClick={retryList}>{t.retry}</button></div>}
        {charts&&!filtered.length&&<p>{t.empty}</p>}
        {filtered.slice(0,limit).map(chart=><div key={chart.id}><button ref={route.selected===chart.id?selectedRow:null} className={`custom-list-item ${route.selected===chart.id?'selected':''}`} onClick={()=>navigate(listPath(chart.id))} aria-pressed={route.selected===chart.id}><span className={`custom-diff-badge diff-${chart.difficulty}`}>{chart.level}</span><img loading="lazy" decoding="async" src={`https://asset.rilaksekai.com/cover/${String(chart.music_id).padStart(3,'0')}.webp`} alt="" width="56" height="56"/><span className="custom-item-info"><strong>{chart.custom_title||t.untitled}</strong><span>{chart.creator}</span><small>{songName(chart,lang)}</small><code>{chart.id}</code></span></button>{mobile&&route.selected===chart.id&&<div className="custom-mobile-preview"><Preview chart={chart} labels={t} inline onClose={()=>navigate(listPath())}/></div>}</div>)}
        {limit<filtered.length&&<div className="custom-list-more" ref={sentinel}><button onClick={()=>setLimit(n=>n+80)}>＋</button></div>}
      </div>{!mobile&&<div className="custom-desktop-preview"><Preview key={selected?.id||'empty'} chart={selected} labels={t}/></div>}</div>
    </section>}
  </main>
}
