import React, { useState, useEffect, useMemo } from 'react';
import { getChoseong } from 'es-hangul';
import { toHiragana } from 'wanakana';
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
    searchPlaceholder: "곡명 또는 작곡가로 검색 (한/일/음독/로마자)",
    svgOption: "svg 파일로 채보 보기<br>※텍스트 검색 가능하나 일부 애드블록에서 긴 로딩",
    calculator: "프로세카 계산기",
    tierList: "서열표",
    loading: "로딩 중...",
    error: "캐시삭제/ios웹앱(바로가기)면 재설치: ",
    noResults: "검색 결과가 없습니다.",
    bgTitle: "배경화면 설정",
    bgOpacity: "배경화면 투명도",
    disclaimer: "이 웹사이트는 팬메이드 사이트이며 모든 권리는<br className=\"br-pc\"/>Sega, Colorful Palette, Crypton을 포함한<br className=\"br-pc\"/>자료들의 정당한 소유자에게 있습니다.",
    mirrorMode: "미러 모드",
    pageTitle: "프로세카 채보",
    hideSpoilers: "수록 예정 곡 숨기기"
  },
  jp: {
    searchPlaceholder: "曲名または作曲家で検索 (日/韓/ローマ字)",
    svgOption: "SVGファイルで譜面を見る ※テキスト検索可能、<br>一部広告ブロックで長いローディング",
    calculator: "プロセカ計算機",
    tierList: "難易度表",
    loading: "ローディング中...",
    error: "キャッシュを削除するか、再インストールしてください: ",
    noResults: "検索結果がありません。",
    bgTitle: "背景設定",
    bgOpacity: "背景の透明度",
    hideKoreanSubTitle: "韓国語の曲名を隠す",
    disclaimer: "このウェブサイトはファンメイドのサイトであり、<br className=\"br-pc\"/>すべての権利はSega、Colorful Palette、Crypton<br className=\"br-pc\"/>を含む資料の正当な所有者に帰属します。",
    mirrorMode: "ミラーモード",
    pageTitle: "プロセカ譜面",
    hideSpoilers: "収録予定曲を隠す"
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

  const [language, setLanguage] = useState(() => {
    const storedLang = localStorage.getItem('language');
    if (storedLang) return storedLang;
    const browserLang = navigator.language || navigator.userLanguage;
    return browserLang && browserLang.startsWith('ja') ? 'jp' : 'ko';
  });
  const [background, setBackground] = useState(() => localStorage.getItem('background') || '/bg.webp');
  const [hideKoreanSubTitle, setHideKoreanSubTitle] = useState(() => {
    const storedValue = localStorage.getItem('hideKoreanSubTitle');
    if (storedValue !== null) return storedValue === 'true';
    const browserLang = navigator.language || navigator.userLanguage;
    return browserLang && browserLang.startsWith('ja');
  });
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

  const [hideSpoilers, setHideSpoilers] = useState(() => {
    const storedValue = localStorage.getItem('hideSpoilers');
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
        // 1. 원본 데이터로 즉시 렌더링 (로딩 해제)
        setAllSongs(data);
        setFilteredSongs(data);
        setIsLoading(false);

        // 2. 초성 및 발음 변환은 비동기로 처리 (UI 차단 방지)
        setTimeout(() => {
          const songsWithPhonetics = data.map(song => {
            // Helper to normalize text
            const normalize = (text) => text ? text.toLowerCase().replace(/\s/g, '') : '';

            const titleJp = normalize(song.title_jp);
            const titleJpHiragana = titleJp ? toHiragana(titleJp) : '';

            const titleHi = normalize(song.title_hi);
            const titleHangul = normalize(song.title_hangul); // Server-side generated

            const composerJp = normalize(song.composer_jp);
            const composerJpHiragana = composerJp ? toHiragana(composerJp) : '';
            // Composer hangul conversion is not yet in test.py, but user only mentioned test.py for title_hangul primarily.
            // Wait, looking at test.py I only added title_hangul.
            // I should double check if I need composer_hangul too. User said "title_hi" specifically but my previous impl did composer too.
            // Let's assume title for now, or better: update test.py to also do composer.
            // Actually, I should update test.py to include composer_hangul as well to fully replace the client-side logic.
            // I will update App.jsx assuming I will update test.py for composer too.

            // For now let's stick to what's in JSON or what's needed.
            // The user request was "test.py... translate kanji/hiragana to title_hi... and pre-calculate Hangul pronunciation".
            // I added title_hangul to test.py.
            // I can't rely on composer_hangul from JSON yet unless I add it to test.py.
            // I should update test.py to include composer_hangul in the next step or same step if possible.
            // But I effectively just modified test.py. I should add composer_hangul there too.

            return {
              ...song,
              choseong: song.title_ko ? getChoseong(song.title_ko).replace(/\s/g, '') : '',
              _search: {
                titleJp,
                titleJpHiragana,
                titleHangul,
                titleHi,
                composerJp,
                composerJpHiragana,
              }
            };
          });

          // 변환된 데이터로 업데이트 (기존 데이터 교체)
          setAllSongs(songsWithPhonetics);
          // 검색어가 없을 때만 필터된 목록도 업데이트 (사용자가 이미 검색 중일 수 있음)
          setFilteredSongs(prev => {
            // 만약 사용자가 그 사이 검색을 했다면 필터된 목록은 건드리지 않음
            // (단, 여기서는 간단히 전체 목록만 업데이트하고, 검색 로직이 allSongs를 참조하므로 
            //  다음 검색부터 초성이 적용됨. 현재 보여지는 목록에 초성 데이터를 입히려면 아래처럼 처리)
            return songsWithPhonetics;
          });
        }, 0);
      })
      .catch(error => {
        setError(error);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    localStorage.setItem('language', language);
    document.title = UI_TEXT[language].pageTitle;
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
    localStorage.setItem('hideSpoilers', hideSpoilers);
  }, [hideSpoilers]);

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
      const searchHiragana = toHiragana(normalizedSearchTerm);

      const standardSearch = result.filter(song => {
        // Helper to normalize text for comparison (remove spaces, lower case)
        const normalize = (text) => text ? text.toLowerCase().replace(/\s/g, '') : '';

        // Korean search
        if (song.title_ko && normalize(song.title_ko).includes(normalizedSearchTerm)) return true;
        if (song.composer && normalize(song.composer).includes(normalizedSearchTerm)) return true;

        // Japanese search (with Kana unification and Hangul pronunciation)
        if (song._search) {
          const {
            titleJp, titleJpHiragana, titleHangul,
            titleHi,
            composerJp, composerJpHiragana
          } = song._search;

          if (titleJp) {
            if (titleJp.includes(normalizedSearchTerm)) return true;
            if (titleJpHiragana.includes(searchHiragana)) return true;
            if (titleHangul && titleHangul.includes(normalizedSearchTerm)) return true;
          }
          if (titleHi) {
            if (titleHi.includes(normalizedSearchTerm)) return true;
            if (titleHi.includes(searchHiragana)) return true;
            // title_hangul covers this as it is derived from title_hi/title_jp
          }
          if (composerJp) {
            if (composerJp.includes(normalizedSearchTerm)) return true;
            if (composerJpHiragana.includes(searchHiragana)) return true;
            // composer_hangul missing on server-side currently.
          }
        } else {
          // Fallback
          if (song.title_hangul && song.title_hangul.includes(normalizedSearchTerm)) return true;
        }

        return false;
      });

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

    if (hideSpoilers) {
      const today = new Date();
      // Set time to 00:00:00 for accurate date comparison
      today.setHours(0, 0, 0, 0);

      result = result.filter(song => {
        if (!song.release_date) return true; // Keep songs without date
        const releaseDate = new Date(song.release_date);
        return releaseDate <= today;
      });
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
  }, [debouncedSearchTerm, delayedSearchTerm, expertLevel, masterLevel, appendLevel, allSongs, useChoseongSearch, language, hideSpoilers]);

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
        <a href="/" onClick={(e) => { e.preventDefault(); window.location.reload(); }}>
          <img src="/title-image.webp?v=2" alt="pjsk-charts" className="title-image" />
        </a>
        <div className="header-buttons">
          <a href="https://force.rilaksekai.com/stats" className="calculator-button">
            {UI_TEXT[language].tierList}
          </a>
          <a href="https://rilaksekai.com/" target="_blank" rel="noopener noreferrer" className="calculator-button">
            {text.calculator}
          </a>
        </div>
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
          const mvType = isJapanese && song.mv_type && song.mv_type.trim() === '원곡' ? '原曲' : song.mv_type;
          const classification = isJapanese ? (CLASS_MAP_JP[song.classification] || song.classification) : song.classification;

          return (
            <div key={song.id} className="song-item" style={{ '--bg-image': `url(https://asset.rilaksekai.com/cover/${String(song.id).padStart(3, '0')}.webp${cacheBuster})` }}>
              <div
                className="song-cover-wrapper"
                {...coverHandlers}
              >
                <img
                  loading="lazy"
                  src={`https://asset.rilaksekai.com/cover/${String(song.id).padStart(3, '0')}.webp${cacheBuster}`}
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

                    const mirrorSuffix = (isMirrorMode && !useWebP) ? '_mr' : '';

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
                    <label htmlFor="choseong-search-toggle">초성 검색 사용(검색 느리면 체크 해제)</label>
                  </div>
                )}
                <div className="format-toggle">
                  <input
                    type="checkbox"
                    id="spoiler-toggle"
                    checked={hideSpoilers}
                    onChange={(e) => setHideSpoilers(e.target.checked)}
                  />
                  <label htmlFor="spoiler-toggle">{text.hideSpoilers}</label>
                </div>
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
                <div style={{ position: 'relative' }}>
                  <p className="disclaimer-text" dangerouslySetInnerHTML={{ __html: text.disclaimer }} />
                  <a
                    href="https://github.com/RilakKuma2/pjsk-chart-search"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="github-link"
                    style={{ position: 'absolute', bottom: '5px', right: 0, color: '#aaa' }}
                  >
                    <svg height="24" viewBox="0 0 16 16" version="1.1" width="24" aria-hidden="true" fill="currentColor">
                      <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                    </svg>
                  </a>
                </div>
              </div>
            )}
          </div>
          {!useWebP && (
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
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
