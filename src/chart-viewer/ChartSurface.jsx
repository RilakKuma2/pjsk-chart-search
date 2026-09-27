import { memo } from 'react'

// Stable surface: canvas/menu internals are owned by the rendering engine.
const ChartSurface = memo(function ChartSurface({ hostRef }) {
  return <div className="chart-viewer" ref={hostRef}>

<main id="stage">
  <div id="scroll" tabIndex="0" aria-label="채보. 좌우로 스크롤하여 다음 구간을 볼 수 있습니다.">
    <div id="space">
      <canvas id="canvas" aria-hidden="true" />
      <div id="jump-marker" hidden><span></span></div>
      <section id="song-info" aria-label="곡 정보">
        <img id="jacket" alt="곡 커버" width="80" height="80" />
        <div><p id="difficulty"></p><h1 id="title">채보 불러오는 중…</h1></div>
      </section>
    </div>
  </div>
  <p id="message" role="status">채보 불러오는 중…</p>
</main>
<div id="floating-ui">
<button id="menu-toggle" data-i18n-aria="menu" aria-label="메뉴" aria-controls="menu" aria-expanded="false"><span aria-hidden="true">☰</span></button>
<section id="menu" data-i18n-aria="menu" aria-label="채보 메뉴" hidden>
  <div className="menu-heading"><button id="song-search-toggle" data-i18n-aria="search" aria-expanded="false" aria-controls="song-search-panel"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></svg></button><strong id="menu-song-title"></strong><button id="capture-view" data-i18n-aria="capture" aria-label="현재 화면 캡처" title="현재 화면 캡처"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14.5 4h-5L7 7H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-4z"/><circle cx="12" cy="13" r="4"/></svg></button><button id="language-toggle" data-i18n-aria="language" aria-expanded="false" aria-controls="language-panel"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg></button>
  <div id="song-search-panel" className="heading-popover" hidden><input id="song-search" type="search" data-i18n-placeholder="searchPlaceholder" autoComplete="off" /><div id="search-results" role="region" aria-live="polite"></div></div>
  <div id="language-panel" className="heading-popover" hidden><button data-language="ko" lang="ko">한국어</button><button data-language="en" lang="en">English</button><button data-language="ja" lang="ja">日本語</button></div></div>
  <div id="difficulties" role="group" data-i18n-aria="difficulty" aria-label="난이도"></div>
  <p id="capture-status" role="status"></p>
  <details open><summary data-i18n="bpmJump">BPM · 구간 이동</summary><div id="beat-intervals" role="region" data-i18n-aria="bpmJump"></div></details>
  <details open><summary data-i18n="skillJump">스킬 구간 이동</summary><div id="skill-jumps" className="button-grid"></div></details>
  <details><summary data-i18n="judgment">판정 강화 표시</summary>
    <p data-i18n="judgmentHelp">선택한 조건의 종료선을 표시합니다. 적용 구간은 스킬 구간 색칠을 켜면 표시됩니다.</p>
    <div id="judgment-options"></div><button id="judgment-reset" data-i18n="reset">기본 조건으로</button>
  </details>
  <label><input id="skill-fill" type="checkbox" /> <span data-i18n="skillFill">스킬 구간 색칠</span></label>
  <p id="position"></p><p id="stats"></p><p id="texture-status" role="status"></p>
</section>
<label id="mirror-control"><span data-i18n="mirror">미러</span> <input id="mirror" type="checkbox" /><span className="switch" aria-hidden="true"></span></label>
</div>

  </div>
})
export default ChartSurface
