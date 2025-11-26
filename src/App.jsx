import React, { useState, useEffect, useMemo } from 'react';
import { getChoseong } from 'es-hangul';
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
  "커버곡": "カバー"
};

const UI_TEXT = {
  ko: {
    searchPlaceholder: "곡명 또는 작곡가로 검색 (한/일)",
    svgOption: "svg 파일로 채보 보기<br>※텍스트 검색 가능하나 일부 애드블록에서 긴 로딩",
    calculator: "프로세카 계산기",
    loading: "로딩 중...",
    error: "캐시삭제/ios웹앱(바로가기)면 재설치: ",
    noResults: "검색 결과가 없습니다.",
    bgTitle: "배경화면 설정",
    bgOpacity: "배경화면 투명도",
    disclaimer: "이 웹사이트는 팬메이드 사이트이며 모든 권리는<br className=\"br-pc\"/>Sega, Colorful Palette, Crypton을 포함한<br className=\"br-pc\"/>자료들의 정당한 소유자에게 있습니다.",
    mirrorMode: "미러 모드"
  },
  jp: {
    searchPlaceholder: "曲名または作曲家で検索 (日/韓)",
    svgOption: "SVGファイルで譜面を見る ※テキスト検索可能、<br>一部広告ブロックで長いローディング",
    calculator: "プロセカ計算機",
    loading: "ローディング中...",
    error: "キャッシュを削除するか、再インストールしてください: ",
    noResults: "検索結果がありません。",
    bgTitle: "背景設定",
    bgOpacity: "背景の透明度",
    hideKoreanSubTitle: "韓国語の曲名を隠す",
    disclaimer: "このウェブサイトはファンメイドのサイトであり、<br className=\"br-pc\"/>すべての権利はSega、Colorful Palette、Crypton<br className=\"br-pc\"/>を含む資料の正当な所有者に帰属します。",
    mirrorMode: "ミラーモード"
  }
};

const PRESET_BGS = ['/bg.webp', ...Array.from({ length: 18 }, (_, i) => `/bg${i + 1}.webp`)];

const BackgroundSelector = ({ setBackground, language }) => {
  const [showBackgroundOptions, setShowBackgroundOptions] = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgDataUrl = event.target.result;
      setBackground(imgDataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="background-selector">
      <button className="bg-toggle-btn" onClick={() => setShowBackgroundOptions(!showBackgroundOptions)}>
        {UI_TEXT[language].bgTitle}
      </button>
      {showBackgroundOptions && (
        <div className="bg-options-content">
          <div className="preset-grid">
            {PRESET_BGS.map(bg => (
              <button key={bg} className="preset-item" onClick={() => setBackground(bg)}>
                <img src={bg} alt={`preset ${bg}`} />
              </button>
            ))}
            <label htmlFor="bg-upload" className="preset-item upload-btn">
              +
              <input id="bg-upload" type="file" accept="image/*" onChange={handleImageUpload} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

const DifficultyFilter = ({ diff, shorthand, value, onChange }) => {
  let start, end;
  if (diff === 'expert') { start = 21; end = 32; }
  else if (diff === 'master') { start = 25; end = 37; }
  else if (diff === 'append') { start = 24; end = 38; }
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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [delayedSearchTerm, setDelayedSearchTerm] = useState('');
  const [expertLevel, setExpertLevel] = useState('');
  const [masterLevel, setMasterLevel] = useState('');
  const [appendLevel, setAppendLevel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSongId, setActiveSongId] = useState(null);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'ko');
  const [background, setBackground] = useState(() => localStorage.getItem('background') || '/bg.webp');
  const [hideKoreanSubTitle, setHideKoreanSubTitle] = useState(() => localStorage.getItem('hideKoreanSubTitle') === 'true');
  const [backgroundOpacity, setBackgroundOpacity] = useState(() => {
    const storedOpacity = localStorage.getItem('backgroundOpacity');
    return storedOpacity !== null ? parseInt(storedOpacity, 10) : 80;
  });

  const [useWebP, setUseWebP] = useState(() => {
    const storedValue = localStorage.getItem('useWebP');
    return storedValue === null ? true : storedValue === 'true';
  });

  const [useChoseongSearch, setUseChoseongSearch] = useState(() => {
    const storedValue = localStorage.getItem('useChoseongSearch');
    return storedValue === null ? true : storedValue === 'true';
  });

  const [isMirrorMode, setIsMirrorMode] = useState(() => {
    const storedValue = localStorage.getItem('isMirrorMode');
    return storedValue === null ? false : storedValue === 'true';
  });

  const isTouchDevice = useMemo(() => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 100);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDelayedSearchTerm(searchTerm);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  useEffect(() => {
    fetch('https://api.rilaksekai.com/api/songs')
      .then(response => { if (!response.ok) throw new Error('네트워크 응답 오류'); return response.json(); })
      .then(data => {
        const songsWithChoseong = data.map(song => ({
          ...song,
          choseong: song.title_ko ? getChoseong(song.title_ko).replace(/\s/g, '') : ''
        }));
        setAllSongs(songsWithChoseong);
        setFilteredSongs(songsWithChoseong);
      })
      .catch(error => setError(error))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('hideKoreanSubTitle', hideKoreanSubTitle);
  }, [hideKoreanSubTitle]);

  useEffect(() => {
    localStorage.setItem('backgroundOpacity', backgroundOpacity);
    document.body.style.setProperty('--background-opacity', backgroundOpacity / 100);
  }, [backgroundOpacity]);

  useEffect(() => {
    localStorage.setItem('isMirrorMode', isMirrorMode);
  }, [isMirrorMode]);

  useEffect(() => {
    if (background) {
      if (background.startsWith('data:image')) {
        const img = new Image();
        img.src = background;
        img.onload = () => {
          localStorage.setItem('background', background);
          document.body.style.setProperty('--background-image', `url(${background})`);
        };
        img.onerror = () => {
          localStorage.removeItem('background');
          const defaultBg = '/bg.webp';
          setBackground(defaultBg);
          document.body.style.setProperty('--background-image', `url(${defaultBg})`);
        };
      } else {
        localStorage.setItem('background', background);
        document.body.style.setProperty('--background-image', `url(${background})`);
      }
    } else {
      const defaultBg = '/bg.webp';
      setBackground(defaultBg);
      document.body.style.setProperty('--background-image', `url(${defaultBg})`);
    }
  }, [background]);

  useEffect(() => {
    let result = allSongs;
    if (debouncedSearchTerm) {
      const normalizedSearchTerm = debouncedSearchTerm.toLowerCase().replace(/\s/g, '');
      const standardSearch = result.filter(song =>
        (song.title_ko && song.title_ko.toLowerCase().replace(/\s/g, '').includes(normalizedSearchTerm)) ||
        (song.title_jp && song.title_jp.toLowerCase().replace(/\s/g, '').includes(normalizedSearchTerm)) ||
        (song.composer && song.composer.toLowerCase().replace(/\s/g, '').includes(normalizedSearchTerm)) ||
        (song.composer_jp && song.composer_jp.toLowerCase().replace(/\s/g, '').includes(normalizedSearchTerm))
      );

      if (standardSearch.length === 0 && useChoseongSearch && language === 'ko' && delayedSearchTerm.length >= 2 && debouncedSearchTerm === delayedSearchTerm) {
        // 입력된 검색어의 초성을 추출 (예: "감사감사" -> "ㄱㅅㄱㅅ")
        const searchInitials = getChoseong(delayedSearchTerm).replace(/\s/g, '');

        result = result.filter(song => {
          if (!song.choseong) return false;
          return song.choseong.includes(searchInitials);
        });
      } else {
        result = standardSearch;
      }
    }

    if (expertLevel) {
      result = result.filter(song => song.levels.expert === parseInt(expertLevel));
    } else if (masterLevel) {
      result = result.filter(song => song.levels.master === parseInt(masterLevel));
    } else if (appendLevel) {
      if (appendLevel === "all") {
        result = result.filter(song => song.levels.append != null);
      } else {
        result = result.filter(song => song.levels.append === parseInt(appendLevel));
      }

      const getSortableDate = (song) => {
        let dateStr;
        if (song.apd) {
          dateStr = `20${song.apd}`;
        } else {
          dateStr = song.release_date;
        }
        if (!dateStr) return new Date(0);
        return new Date(dateStr);
      };

      result.sort((a, b) => getSortableDate(b) - getSortableDate(a));
    }

    setFilteredSongs(result);
  }, [debouncedSearchTerm, delayedSearchTerm, expertLevel, masterLevel, appendLevel, allSongs, useChoseongSearch, language]);

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveSongId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('useWebP', useWebP);
  }, [useWebP]);

  useEffect(() => {
    localStorage.setItem('useChoseongSearch', useChoseongSearch);
  }, [useChoseongSearch]);

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
    <div className={`App ${language === 'jp' ? 'lang-jp' : ''}`}>
      <header>
        <img src="/title-image.webp?v=2" alt="pjsk-charts" className="title-image" />
        <a href="https://calc.rilaksekai.com/" target="_blank" rel="noopener noreferrer" className="calculator-button">
          {text.calculator}
        </a>
      </header>



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
            <div key={song.id} className="song-item" style={{ '--bg-image': `url(https://asset.rilaksekai.com/cover/${String(song.id).padStart(3, '0')}.jpg${cacheBuster})` }}>
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
                      <span style={{ textAlign: 'right' }}>
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
                    {!(isJapanese && hideKoreanSubTitle) && <span className="title-jp">{subTitle}</span>}
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
                    if (diff === 'append' && !level) {
                      return null; // Don't render anything for append if it doesn't exist
                    }
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

                    const mirrorSuffix = isMirrorMode ? '_mr' : '';

                    return (
                      <a
                        key={diff}
                        href={`https://asset.rilaksekai.com/${useWebP ? 'charts' : 'svg'}/${song.id}/${diff}${mirrorSuffix}.${useWebP ? 'html' : 'svg'}${cacheBuster}`}
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

      <div className="mirror-toggle-wrapper">
        <div className="mirror-toggle-content">
          <div className="settings-container">
            <button onClick={() => setIsOptionsOpen(!isOptionsOpen)} className="settings-button">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.58 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </button>
            {isOptionsOpen && (
              <div className="options-window">
                <button className="close-options-btn" onClick={() => setIsOptionsOpen(false)}>✕</button>
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
                {language === 'jp' && (
                  <div className="format-toggle">
                    <input
                      type="checkbox"
                      id="hide-ko-sub-toggle"
                      checked={hideKoreanSubTitle}
                      onChange={(e) => setHideKoreanSubTitle(e.target.checked)}
                    />
                    <label htmlFor="hide-ko-sub-toggle">{text.hideKoreanSubTitle}</label>
                  </div>
                )}
                {language === 'ko' && (
                  <div className="format-toggle">
                    <input
                      type="checkbox"
                      id="choseong-search-toggle"
                      checked={useChoseongSearch}
                      onChange={(e) => setUseChoseongSearch(e.target.checked)}
                    />
                    <label htmlFor="choseong-search-toggle">초성 검색 사용(느리면 체크 해제)</label>
                  </div>
                )}
                <div className="opacity-slider-container">
                  <label htmlFor="opacity-slider">{text.bgOpacity}</label>
                  <div className="opacity-control">
                    <input
                      type="range"
                      id="opacity-slider"
                      min="0"
                      max="100"
                      value={backgroundOpacity}
                      onChange={(e) => setBackgroundOpacity(parseInt(e.target.value, 10))}
                    />
                    <button className="reset-opacity-btn" onClick={() => setBackgroundOpacity(80)} title="Reset opacity">
                      ↺
                    </button>
                  </div>
                </div>
                <BackgroundSelector setBackground={setBackground} language={language} />
                <p className="disclaimer-text" dangerouslySetInnerHTML={{ __html: text.disclaimer }} />
              </div>
            )}
          </div>
          <div className="mirror-toggle-container">
            <label className="mirror-toggle-label">
              <input
                type="checkbox"
                checked={isMirrorMode}
                onChange={(e) => setIsMirrorMode(e.target.checked)}
              />
              <span className="mirror-toggle-text">{text.mirrorMode}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
