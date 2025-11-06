import React, { useState, useEffect, useMemo } from 'react';
import './App.css';

const UNIT_NAME_MAP = {
  "VS": "버싱",
  "L/n": "레오니",
  "MMJ": "모모점",
  "VBS": "비배스",
  "WxS": "원더쇼",
  "N25": "니고",
  "Oth": "기타",
  "Unk": "버싱"
};

const CLASS_MAP_JP = {
  "기존곡": "既存曲",
  "공모전": "公募展",
  "하코곡": "書き下ろし",
  "커버곡" : "カバー"
};

const UI_TEXT = {
  ko: {
    searchPlaceholder: "곡명 또는 작곡가로 검색 (한/일)",
    svgOption: "svg 파일로 채보 보기<br>※텍스트 검색 가능하나 일부 애드블록에서 긴 로딩",
    calculator: "프로세카 계산기",
    loading: "로딩 중...",
    error: "캐시삭제/ios웹앱(바로가기)면 재설치: ",
    noResults: "검색 결과가 없습니다."
  },
  jp: {
    searchPlaceholder: "曲名または作曲家で検索 (日/韓)",
    svgOption: "SVGファイルで譜面を見る<br>※テキスト検索可能、一部広告ブロックで長いローディング",
    calculator: "プロセカ計算機",
    loading: "ローディング中...",
    error: "キャッシュを削除するか、再インストールしてください: ",
    noResults: "検索結果がありません。"
  }
};

const DifficultyFilter = ({ diff, shorthand, value, onChange }) => {
  let start, end;
  if (diff === 'expert') { start = 21; end = 31; } 
  else if (diff === 'master') { start = 25; end = 37; } 
  else if (diff === 'append') { start = 24; end = 37; } 
  else { return null; }
  const levels = Array.from({ length: end - start + 1 }, (_, i) => end - i);
  return (
    <div className="filter-group">
      <div className={`filter-label ${diff}`}>{shorthand}</div>
      <select value={value} onChange={(e) => onChange(diff, e.target.value)}>
        <option value="">-</option>
        {diff === 'append' && <option value="all">All</option>}
        {levels.map(level => (
          <option key={`${diff}_${level}`} value={level}>{level}</option>
        ))}
      </select>
    </div>
  );
};

function App() {
  const [allSongs, setAllSongs] = useState([]);
  const [filteredSongs, setFilteredSongs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expertLevel, setExpertLevel] = useState('');
  const [masterLevel, setMasterLevel] = useState('');
  const [appendLevel, setAppendLevel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSongId, setActiveSongId] = useState(null);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [language, setLanguage] = useState('ko');

  // WebP 채보 사용 여부를 localStorage에서 불러와 초기 상태로 설정
  const [useWebP, setUseWebP] = useState(() => {
    const storedValue = localStorage.getItem('useWebP');
    return storedValue === null ? true : storedValue === 'true';
  });

  // 터치 기기인지 여부를 앱 로딩 시 한 번만 확인
  const isTouchDevice = useMemo(() => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  useEffect(() => {
    fetch('https://api.rilaksekai.com/api/songs')
      .then(response => { if (!response.ok) throw new Error('네트워크 응답 오류'); return response.json(); })
      .then(data => { setAllSongs(data); setFilteredSongs(data); })
      .catch(error => setError(error))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    let result = allSongs;
    if (searchTerm) {
      const normalizedSearchTerm = searchTerm.toLowerCase().replace(/\s/g, '');
      result = result.filter(song =>
        (song.title_ko && song.title_ko.toLowerCase().replace(/\s/g, '').includes(normalizedSearchTerm)) ||
        (song.title_jp && song.title_jp.toLowerCase().replace(/\s/g, '').includes(normalizedSearchTerm)) ||
        (song.composer && song.composer.toLowerCase().replace(/\s/g, '').includes(normalizedSearchTerm)) ||
        (song.composer_jp && song.composer_jp.toLowerCase().replace(/\s/g, '').includes(normalizedSearchTerm))
      );
    }

    if (expertLevel) {
      result = result.filter(song => song.levels.expert === parseInt(expertLevel));
    } else if (masterLevel) {
      result = result.filter(song => song.levels.master === parseInt(masterLevel));
    } else if (appendLevel) { // This block is only entered if appendLevel is not ""
      if (appendLevel === "all") {
        result = result.filter(song => song.levels.append != null);
      } else { // This is for a specific number
        result = result.filter(song => song.levels.append === parseInt(appendLevel));
      }
      
      // (APD) 레벨 검색 시 정렬 로직
      const getSortableDate = (song) => {
        let dateStr;
        if (song.apd) {
          // apd는 'yy/mm/dd' 형식이므로 '20'을 앞에 붙여 'yyyy/mm/dd'로 만듭니다.
          dateStr = `20${song.apd}`;
        } else {
          dateStr = song.release_date;
        }
        // 날짜 문자열이 유효하지 않으면 아주 오래된 날짜를 반환하여 정렬 시 뒤로 보냅니다.
        if (!dateStr) return new Date(0);
        return new Date(dateStr);
      };

      result.sort((a, b) => getSortableDate(b) - getSortableDate(a));
    }

    setFilteredSongs(result);
  }, [searchTerm, expertLevel, masterLevel, appendLevel, allSongs]);

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveSongId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // useWebP 상태가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('useWebP', useWebP);
  }, [useWebP]);

  const handleFilterChange = (diff, value) => {
    setExpertLevel(''); setMasterLevel(''); setAppendLevel('');
    if (value) {
      if (diff === 'expert') setExpertLevel(value);
      if (diff === 'master') setMasterLevel(value);
      if (diff === 'append') setAppendLevel(value);
    }
  };

  const difficulties = ['easy', 'normal', 'hard', 'expert', 'master', 'append'];
  const text = UI_TEXT[language];

  if (isLoading) return <div className="App"><h1>{text.loading}</h1></div>;
  if (error) return <div className="App"><h1>{text.error}{error.message}</h1></div>;

  return (
    <div className="App">
      <header>
        <img src="/title-image.webp?v=2" alt="pjsk-charts" className="title-image" />
        <a href="https://rilaksekai.com/prsk-calc/" target="_blank" rel="noopener noreferrer" className="calculator-button">
          {text.calculator}
        </a>
      </header>

      <div className="options-container">
        <button onClick={() => setIsOptionsOpen(!isOptionsOpen)} className="options-button">
          <img src="/option.webp" alt="Options" />
        </button>
        {isOptionsOpen && (
          <div className="options-window">
            <div className="language-selector">
              <span>🌐</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="ko">🇰🇷한국어</option>
                <option value="jp">🇯🇵日本語</option>
              </select>
            </div>
            <div className="format-toggle">
              <input
                type="checkbox"
                id="webp-toggle"
                checked={!useWebP}
                onChange={(e) => setUseWebP(!e.target.checked)}
              />
              <label htmlFor="webp-toggle" dangerouslySetInnerHTML={{ __html: text.svgOption }} />
            </div>
          </div>
        )}
      </div>

      <div className="filter-bar">
        <input 
          type="text" 
          placeholder={text.searchPlaceholder}
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="search-input" 
        />
        <div className="difficulty-filters">
          <DifficultyFilter diff="expert" shorthand="EX" value={expertLevel} onChange={handleFilterChange} />
          <DifficultyFilter diff="master" shorthand="MAS" value={masterLevel} onChange={handleFilterChange} />
          <DifficultyFilter diff="append" shorthand="APD" value={appendLevel} onChange={handleFilterChange} />
        </div>
      </div>

      <div className="song-list">
        {filteredSongs.map(song => {
          const coverHandlers = {
            onClick: (e) => {
              e.stopPropagation();
              setActiveSongId(prevId => (prevId === song.id ? null : song.id));
            }
          };

          if (!isTouchDevice) {
            coverHandlers.onMouseEnter = () => setActiveSongId(song.id);
            coverHandlers.onMouseLeave = () => setActiveSongId(null);
          }
          
          const cacheBuster = song.ver && song.ver !== "0" ? `?v=${song.ver}` : '';

          const isJapanese = language === 'jp';
          const title = isJapanese ? song.title_jp : song.title_ko;
          const subTitle = isJapanese ? song.title_ko : song.title_jp;
          const composer = isJapanese ? song.composer_jp : song.composer;
          const unit = isJapanese ? song.unit_code : (UNIT_NAME_MAP[song.unit_code] || song.unit_code);
          const mvType = isJapanese && song.mv_type === '원곡' ? '原曲' : song.mv_type;
          const classification = isJapanese ? (CLASS_MAP_JP[song.classification] || song.classification) : song.classification;

          return (
            <div key={song.id} className="song-item" style={{'--bg-image': `url(https://asset.rilaksekai.com/cover/${String(song.id).padStart(3, '0')}.jpg${cacheBuster})`}}>
              <div 
                className="song-cover-wrapper"
                {...coverHandlers}
              >
                <img 
                  loading="lazy" 
                  src={`https://asset.rilaksekai.com/cover/${String(song.id).padStart(3, '0')}.jpg${cacheBuster}`} 
                  alt={title} 
                  className={`song-cover unit-border-${song.unit_code.replace('/', '-')}`} 
                />
                {activeSongId === song.id && (
                  <div className="song-popover">
                     <div className="popover-column">
                      <span>{classification || '-'}</span>
                      <span>{unit}</span>
                    </div>
                    <div className="popover-column">
                      <span>{mvType || '-'}</span>
                      <span>{composer || '-'}</span>
                    </div>
                    <div className="popover-column">
                      <span>{song.length || '-'}</span>
                      <span style={{textAlign: 'right'}}>
                        {song.release_date || '-'}
                        {song.apd && <div>(APD) {song.apd}</div>}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="song-details">
                <div className="song-title-row">
                  <div className="song-titles">
                    <span className="title-ko">{title}</span>
                    <span className="title-jp">{subTitle}</span>
                  </div>
                  {song.bpm && (
                    <span className="song-bpm">
                      {typeof song.bpm === 'string' ? song.bpm : `${song.bpm} BPM`}
                    </span>
                  )}
                </div>
                <div className="difficulty-circles">
                  {difficulties.map(diff => {
                    const level = song.levels[diff];
                    if (!level) {
                      return <div key={diff} className="circle-placeholder"></div>;
                    }

                    let isFiltered = false;
                    if (diff === 'expert' && expertLevel && level === parseInt(expertLevel)) isFiltered = true;
                    if (diff === 'master' && masterLevel && level === parseInt(masterLevel)) isFiltered = true;
                    if (diff === 'append' && appendLevel) {
                      if (appendLevel === 'all' && level != null) isFiltered = true;
                      if (level === parseInt(appendLevel)) isFiltered = true;
                    }
                    const classNames = `circle ${diff} ${isFiltered ? 'filtered' : ''}`;

                    return (
                      <a 
                        key={diff} 
                        href={`https://asset.rilaksekai.com/${useWebP ? 'charts' : 'svg'}/${song.id}/${diff}.${useWebP ? 'html' : 'svg'}${cacheBuster}`}
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={classNames} 
                        title={`${diff.charAt(0).toUpperCase() + diff.slice(1)}: ${level}`}
                      >
                        {level}
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
        {filteredSongs.length === 0 && <p>{text.noResults}</p>}
      </div>
    </div>
  );
}

export default App;
