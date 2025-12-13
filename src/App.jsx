import React, { useState, useEffect, useMemo } from 'react';
import { getChoseong } from 'es-hangul';
import { toHiragana } from 'wanakana';
import GraphModal from './components/GraphModal';
import DualRangeSlider from './components/DualRangeSlider';
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
    mirrorMode: "미러 모드",
    pageTitle: "프로세카 채보",
    hideSpoilers: "수록 예정 곡 숨기기",
    detailedSearch: "세부 검색",
    classification: "카테고리",
    unit: "유닛",
    mvType: "MV",
    length: "시간",
    bpm: "BPM",
    date: "출시일",
    sort: "정렬",
    asc: "오름차순",
    desc: "내림차순",
    songs: "곡",
    upcoming: "추가 수록 예정",
    noteCount: "노트 수",
    mvMember: "MV 인원"
  },
  jp: {
    pageTitle: "プロセカ楽曲難易度検索",
    searchPlaceholder: "曲名または作曲者で検索(ひらがな/韓国語/英語)",
    loading: "読み込み中...",
    error: "エラーが発生しました: ",
    tierList: "Tier表",
    calculator: "周回効率計算機",
    calculatorUrl: "https://pjsk-calc.pages.dev",
    mirrorMode: "ミラーモード",
    noResults: "検索結果がありません。",
    disclaimer: "本サイトは非公式ファンサイトです。<br>公式とは一切関係ありません。<br>データの間違い等による損害については責任を負いかねます。",
    svgOption: "高画質(WebP)を使用<br><span style='font-size: 0.8em; color: gray'>(チェックを外すとSVGを使用)</span>",
    hideKoreanSubTitle: "韓国語のタイトルを隠す",
    hideSpoilers: "ネタバレ(未実装曲)を隠す",
    bgOpacity: "背景の不透明度",
    detailedSearch: "詳細検索",
    classification: "分類",
    unit: "ユニット",
    mvType: "MV",
    unit: "ユニット",
    mvType: "MV",
    length: "時間",
    bpm: "BPM",
    date: "リリース日",
    sort: "並び替え",
    asc: "昇順",
    desc: "降順",
    songs: "曲",
    upcoming: "曲追加収録予定",
    noteCount: "ノーツ数",
    mvMember: "MV人数"
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
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);

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

  const [showDetailSearch, setShowDetailSearch] = useState(false);
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null); // 'classification' | 'unit' | 'mv' | 'sort' | null
  const [filterClassification, setFilterClassification] = useState([]);
  const [isMultiSelectClass, setIsMultiSelectClass] = useState(false);
  const [filterUnit, setFilterUnit] = useState([]);
  const [isMultiSelectUnit, setIsMultiSelectUnit] = useState(false);
  const [filterMvType, setFilterMvType] = useState([]);
  const [isMultiSelectMv, setIsMultiSelectMv] = useState(false);

  // Range filter states: [min, max]
  const [filterLength, setFilterLength] = useState([0, 0]);
  const [filterBpm, setFilterBpm] = useState([0, 0]);
  const [filterDate, setFilterDate] = useState([0, 0]); // timestamp

  // Debounced range states (for filtering)
  const [debouncedFilterLength, setDebouncedFilterLength] = useState([0, 0]);
  const [debouncedFilterBpm, setDebouncedFilterBpm] = useState([0, 0]);
  const [debouncedFilterDate, setDebouncedFilterDate] = useState([0, 0]);

  // New Note Count & MV Member Filters State
  const [filterExNote, setFilterExNote] = useState([0, 0]);
  const [filterMaNote, setFilterMaNote] = useState([0, 0]);
  const [filterApNote, setFilterApNote] = useState([0, 0]);
  const [filterMvMember, setFilterMvMember] = useState([]);
  const [isMultiSelectMvMember, setIsMultiSelectMvMember] = useState(false);

  const [debouncedFilterExNote, setDebouncedFilterExNote] = useState([0, 0]);
  const [debouncedFilterMaNote, setDebouncedFilterMaNote] = useState([0, 0]);
  const [debouncedFilterApNote, setDebouncedFilterApNote] = useState([0, 0]);
  const [debouncedFilterMvMember, setDebouncedFilterMvMember] = useState([]);

  const [activeNoteTab, setActiveNoteTab] = useState('ex'); // 'ex' | 'ma' | 'ap'

  // Global ranges for sliders
  const [globalRanges, setGlobalRanges] = useState({
    length: [0, 1000],
    bpm: [0, 500],
    date: [0, 0],
    exNote: [0, 2000],
    maNote: [0, 2000],
    apNote: [0, 2000],
    maNote: [0, 2000],
    apNote: [0, 2000]
  });

  const [sortOption, setSortOption] = useState(null); // 'length' | 'bpm' | 'date' | null
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  // Stashed filters for restoring state when re-opening Detailed Search
  const [stashedFilters, setStashedFilters] = useState(null);

  const [songCounts, setSongCounts] = useState({ released: 0, upcoming: 0 });


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

  // Debounce effects for ranges (0.2s delay as requested)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedFilterLength(filterLength), 200);
    return () => clearTimeout(handler);
  }, [filterLength]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedFilterBpm(filterBpm), 200);
    return () => clearTimeout(handler);
  }, [filterBpm]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedFilterDate(filterDate), 200);
    return () => clearTimeout(handler);
  }, [filterDate]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedFilterExNote(filterExNote), 200);
    return () => clearTimeout(handler);
  }, [filterExNote]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedFilterMaNote(filterMaNote), 200);
    return () => clearTimeout(handler);
  }, [filterMaNote]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedFilterApNote(filterApNote), 200);
    return () => clearTimeout(handler);
  }, [filterApNote]);

  useEffect(() => {
    setDebouncedFilterMvMember(filterMvMember);
  }, [filterMvMember]);

  useEffect(() => {
    fetch('https://api.rilaksekai.com/api/songs')
      .then(response => { if (!response.ok) throw new Error('네트워크 응답 오류'); return response.json(); })
      .then(data => {
        // 1. 원본 데이터로 즉시 렌더링 (로딩 해제)
        setAllSongs(data);

        let initialFiltered = data;
        if (hideSpoilers) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          initialFiltered = data.filter(song => {
            if (!song.release_date) return true;
            const releaseDate = new Date(song.release_date);
            return releaseDate <= today;
          });
        }
        setFilteredSongs(initialFiltered);
        setIsLoading(false);

        // Calculate global ranges
        const lengths = [];
        const bpms = [];
        const dates = [];

        data.forEach(song => {
          // Parse Length
          if (song.length) {
            const parts = song.length.split(':');
            if (parts.length === 2) {
              lengths.push(parseInt(parts[0]) * 60 + parseInt(parts[1]));
            }
          }
          // Parse BPM
          if (song.bpm) {
            const match = String(song.bpm).match(/\d+(\.\d+)?/);
            if (match) bpms.push(parseFloat(match[0]));
          }
          // Parse Date
          if (song.release_date) {
            dates.push(new Date(song.release_date).getTime());
          } else if (song.apd) {
            // Approximate date for append if needed, or skip
            // For now, let's treat APD as not affecting date range unless explicitly handled
          }
        });

        // Parse Note Counts and MV Members for Global Ranges
        const exNotes = [];
        const maNotes = [];
        const apNotes = [];
        const mvMembers = [];

        data.forEach(song => {
          if (song.ex_note) exNotes.push(parseInt(song.ex_note) || 0);
          if (song.ma_note) maNotes.push(parseInt(song.ma_note) || 0);
          if (song.ap_note) apNotes.push(parseInt(song.ap_note) || 0);
          if (song.mv_in) mvMembers.push(parseInt(song.mv_in) || 0);
        });

        const minLen = Math.min(...lengths);
        const maxLen = Math.max(...lengths);
        const minBpm = Math.min(...bpms);
        const maxBpm = Math.max(...bpms);
        const minDate = Math.min(...dates);
        const maxDate = Math.max(...dates);

        const minEx = exNotes.length ? Math.min(...exNotes) : 0;
        const maxEx = exNotes.length ? Math.max(...exNotes) : 2000;
        const minMa = maNotes.length ? Math.min(...maNotes) : 0;
        const maxMa = maNotes.length ? Math.max(...maNotes) : 2000;
        const minAp = apNotes.length ? Math.min(...apNotes) : 0;
        const maxAp = apNotes.length ? Math.max(...apNotes) : 2000;


        const newRanges = {
          length: [minLen > 0 ? minLen : 0, maxLen > 0 ? maxLen : 300],
          bpm: [minBpm > 0 ? minBpm : 0, maxBpm > 0 ? maxBpm : 300],
          date: [minDate > 0 ? minDate : 0, maxDate > 0 ? maxDate : new Date().getTime()],
          exNote: [minEx, maxEx],
          maNote: [minMa, maxMa],
          apNote: [minAp, maxAp]
        };
        setGlobalRanges(newRanges);

        // Initialize filters
        setFilterLength(newRanges.length);
        setFilterBpm(newRanges.bpm);
        setFilterDate(newRanges.date);
        setFilterExNote(newRanges.exNote);
        setFilterMaNote(newRanges.maNote);
        setFilterApNote(newRanges.apNote);

        setFilterMvMember([]);

        // Initialize debounced values
        setDebouncedFilterLength(newRanges.length);
        setDebouncedFilterBpm(newRanges.bpm);
        setDebouncedFilterDate(newRanges.date);
        setDebouncedFilterExNote(newRanges.exNote);
        setDebouncedFilterMaNote(newRanges.maNote);
        setDebouncedFilterApNote(newRanges.apNote);

        setDebouncedFilterMvMember([]);

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
            // 하지만 초기 로딩 시점(검색어 없음)이라면 필터링된 목록도 업데이트해야 함
            // 이때 스포일러 필터가 켜져 있다면 그것도 적용해야 함

            let nextFiltered = songsWithPhonetics;
            if (hideSpoilers) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              nextFiltered = songsWithPhonetics.filter(song => {
                if (!song.release_date) return true;
                const releaseDate = new Date(song.release_date);
                return releaseDate <= today;
              });
            }
            return nextFiltered;
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
    let result = [...allSongs]; // Fix sort mutation: always clone first
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

    if (filterClassification.length > 0) {
      result = result.filter(song => {
        const cls = language === 'jp' ? (CLASS_MAP_JP[song.classification] || song.classification) : song.classification;
        return filterClassification.includes(cls);
      });
    }

    if (filterUnit.length > 0) {
      result = result.filter(song => {
        const u = language === 'jp' ? song.unit_code : (UNIT_NAME_MAP[song.unit_code] || song.unit_code);
        return filterUnit.includes(u);
      });
    }

    if (filterMvType.length > 0) {
      result = result.filter(song => {
        const mv = song.mv_type || '';
        if (!mv) return false;

        return filterMvType.some(selectedType => {
          // Split by slash for compound types (e.g. "2D/3D")
          // Song matches if it matches ALL of the sub-types (AND logic as requested)
          const subTypes = selectedType.split('/');
          return subTypes.every(sub => {
            const type = sub.trim();
            if (type === '3D') return mv.includes('3D');
            if (type === '2D') return mv.includes('2D');
            if (type === '원곡' || type === '原曲') return mv.includes('원곡') || mv.includes('原曲');
            return mv.includes(type);
          });
        });
      });
    }

    // Range Filters
    // Length
    result = result.filter(song => {
      if (!song.length) return true;
      const parts = song.length.split(':');
      if (parts.length !== 2) return true;
      const songLen = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      return songLen >= debouncedFilterLength[0] && songLen <= debouncedFilterLength[1];
    });

    // BPM
    result = result.filter(song => {
      if (!song.bpm) return true;
      const match = String(song.bpm).match(/\d+(\.\d+)?/);
      const songBpm = match ? parseFloat(match[0]) : 0;
      return songBpm >= debouncedFilterBpm[0] && songBpm <= debouncedFilterBpm[1];
    });

    // Date
    result = result.filter(song => {
      if (!song.release_date) return true; // Keep songs without dates? Or filter them out? Usually keep.
      const songDate = new Date(song.release_date).getTime();
      return songDate >= debouncedFilterDate[0] && songDate <= debouncedFilterDate[1];
    });

    // Ex Note
    result = result.filter(song => {
      if (!song.ex_note) return true;
      const val = parseInt(song.ex_note) || 0;
      return val >= debouncedFilterExNote[0] && val <= debouncedFilterExNote[1];
    });

    // Ma Note
    result = result.filter(song => {
      if (!song.ma_note) return true;
      const val = parseInt(song.ma_note) || 0;
      return val >= debouncedFilterMaNote[0] && val <= debouncedFilterMaNote[1];
    });

    // Ap Note
    result = result.filter(song => {
      // Only filter if AP note exists? Or if song has Append, treat 0 as filtered?
      if (!song.ap_note) return true;
      const val = parseInt(song.ap_note) || 0;
      // If val is 0, maybe it means no append? 
      // But let's follow standard logic: if key exists, use it.
      return val >= debouncedFilterApNote[0] && val <= debouncedFilterApNote[1];
    });

    // MV Member
    result = result.filter(song => {
      if (debouncedFilterMvMember.length === 0) return true;
      if (!song.mv_in) return false;
      const val = parseInt(song.mv_in);

      // Check for 6+ logic
      // If "6" (represented as 6 in array) is selected, it handles >= 6
      // But need to know if 6 is selected.
      const includesSixPlus = debouncedFilterMvMember.includes(6);

      if (includesSixPlus && val >= 6) return true;

      return debouncedFilterMvMember.includes(val);
    });

    // APD Tab Specific Filter: If APD tab is active, show only songs with Append
    if (activeNoteTab === 'ap') {
      result = result.filter(song => song.levels.append != null);
    }

    // Calculate counts BEFORE hiding spoilers but AFTER other filters
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let releasedCount = 0;
    let upcomingCount = 0;

    result.forEach(song => {
      if (!song.release_date) {
        releasedCount++; // Assuming no date means released or basic song
      } else {
        const releaseDate = new Date(song.release_date);
        if (releaseDate <= today) {
          releasedCount++;
        } else {
          upcomingCount++;
        }
      }
    });

    setSongCounts({ released: releasedCount, upcoming: upcomingCount });

    // Now apply spoiler filter
    if (hideSpoilers) {
      result = result.filter(song => {
        if (!song.release_date) return true;
        const releaseDate = new Date(song.release_date);
        return releaseDate <= today;
      });
    }

    if (sortOption) {
      result.sort((a, b) => {
        let valA, valB;

        if (sortOption === 'length') {
          const parseTime = (timeStr) => {
            if (!timeStr) return 0;
            const parts = timeStr.split(':');
            if (parts.length === 2) {
              return parseInt(parts[0]) * 60 + parseInt(parts[1]);
            }
            return 0;
          };
          valA = parseTime(a.length);
          valB = parseTime(b.length);
        } else if (sortOption === 'bpm') {
          // BPM can be "120" or "120 (140)"
          const parseBpm = (bpmStr) => {
            if (typeof bpmStr === 'number') return bpmStr;
            if (!bpmStr) return 0;
            // extract first number
            const match = bpmStr.match(/\d+(\.\d+)?/);
            return match ? parseFloat(match[0]) : 0;
          };
          valA = parseBpm(a.bpm);
          valB = parseBpm(b.bpm);
        } else if (sortOption === 'date') {
          const getSortableDate = (song) => {
            // Override for APD tab: use Append release date if available
            if (activeNoteTab === 'ap' && song.apd) {
              return new Date(`20${song.apd}`).getTime();
            }
            return song.release_date ? new Date(song.release_date).getTime() : 0;
          };
          valA = getSortableDate(a);
          valB = getSortableDate(b);
        } else if (sortOption === 'noteCount') {
          // Sort by the currently active note tab's count
          if (activeNoteTab === 'ex') {
            valA = a.ex_note ? parseInt(a.ex_note) : 0;
            valB = b.ex_note ? parseInt(b.ex_note) : 0;
          } else if (activeNoteTab === 'ma') {
            valA = a.ma_note ? parseInt(a.ma_note) : 0;
            valB = b.ma_note ? parseInt(b.ma_note) : 0;
          } else if (activeNoteTab === 'ap') {
            valA = a.ap_note ? parseInt(a.ap_note) : 0;
            valB = b.ap_note ? parseInt(b.ap_note) : 0;
          } else {
            valA = 0;
            valB = 0;
          }
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredSongs(result);
  }, [debouncedSearchTerm, delayedSearchTerm, expertLevel, masterLevel, appendLevel, allSongs, useChoseongSearch, language, hideSpoilers, filterClassification, filterUnit, filterMvType, sortOption, sortOrder, debouncedFilterLength, debouncedFilterBpm, debouncedFilterDate, debouncedFilterExNote, debouncedFilterMaNote, debouncedFilterApNote, debouncedFilterMvMember, activeNoteTab]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Close song popover if click is outside
      if (!e.target.closest('.song-cover-wrapper')) {
        setActiveSongId(null);
      }
      // Close filter dropdowns if click is outside .filter-popover-container AND not inside mobile wrapper
      if (!e.target.closest('.filter-popover-container') && !e.target.closest('.mobile-popover-wrapper')) {
        setOpenFilterDropdown(null);
      }
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

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const renderFilterPopover = (type) => {
    switch (type) {
      case 'classification':
        return (
          <div className="filter-popover">
            <div className="popover-header">
              <span>{text.classification}</span>
              <button
                className={`multi-select-btn ${isMultiSelectClass ? 'active' : ''}`}
                onClick={() => {
                  setIsMultiSelectClass(!isMultiSelectClass);
                  if (!isMultiSelectClass && filterClassification.length > 1) {
                    setFilterClassification([filterClassification[filterClassification.length - 1]]);
                  }
                }}
                title={text.multiSelect}
              >
                다중선택
              </button>
              {filterClassification.length > 0 && (
                <button className="popover-reset-btn" onClick={() => setFilterClassification([])}>
                  ↺
                </button>
              )}
            </div>
            <div className="checkbox-group-vertical">
              {Object.values(language === 'jp' ? CLASS_MAP_JP : {
                "기존곡": "기존곡",
                "공모전": "공모전",
                "하코곡": "하코곡",
                "커버곡": "커버곡"
              }).map(opt => (
                <label key={opt} className={`checkbox-row`}>
                  <input
                    type="checkbox"
                    checked={filterClassification.includes(opt)}
                    onChange={(e) => {
                      if (isMultiSelectClass) {
                        if (e.target.checked) setFilterClassification(prev => [...prev, opt]);
                        else setFilterClassification(prev => prev.filter(v => v !== opt));
                      } else {
                        if (e.target.checked) setFilterClassification([opt]);
                        else setFilterClassification([]);
                      }
                    }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        );
      case 'unit':
        return (
          <div className="filter-popover">
            <div className="popover-header">
              <span>{text.unit}</span>
              <button
                className={`multi-select-btn ${isMultiSelectUnit ? 'active' : ''}`}
                onClick={() => {
                  setIsMultiSelectUnit(!isMultiSelectUnit);
                  if (!isMultiSelectUnit && filterUnit.length > 1) {
                    setFilterUnit([filterUnit[filterUnit.length - 1]]);
                  }
                }}
                title={text.multiSelect}
              >
                다중선택
              </button>
              {filterUnit.length > 0 && (
                <button className="popover-reset-btn" onClick={() => setFilterUnit([])}>
                  ↺
                </button>
              )}
            </div>
            <div className="checkbox-group-vertical grid-2-col">
              {Object.values(UNIT_NAME_MAP).filter((v, i, a) => a.indexOf(v) === i).map(unit => (
                <label key={unit} className={`checkbox-row`}>
                  <input
                    type="checkbox"
                    checked={filterUnit.includes(unit)}
                    onChange={(e) => {
                      if (isMultiSelectUnit) {
                        if (e.target.checked) setFilterUnit(prev => [...prev, unit]);
                        else setFilterUnit(prev => prev.filter(v => v !== unit));
                      } else {
                        if (e.target.checked) setFilterUnit([unit]);
                        else setFilterUnit([]);
                      }
                    }}
                  />
                  {unit}
                </label>
              ))}
            </div>
          </div>
        );
      case 'mv':
        return (
          <div className="filter-popover">
            <div className="popover-header">
              <span>{text.mvType}</span>
              <button
                className={`multi-select-btn ${isMultiSelectMv ? 'active' : ''}`}
                onClick={() => {
                  setIsMultiSelectMv(!isMultiSelectMv);
                  if (!isMultiSelectMv && filterMvType.length > 1) {
                    setFilterMvType([filterMvType[filterMvType.length - 1]]);
                  }
                }}
                title={text.multiSelect}
              >
                다중선택
              </button>
              {filterMvType.length > 0 && (
                <button className="popover-reset-btn" onClick={() => setFilterMvType([])}>
                  ↺
                </button>
              )}
            </div>
            <div className="checkbox-group-vertical">
              {(language === 'jp'
                ? ['3D', '2D', '原曲', '2D/3D', '原曲/2D', '原曲/3D', '原曲/2D/3D']
                : ['3D', '2D', '원곡', '2D/3D', '원곡/2D', '원곡/3D', '원곡/2D/3D']
              ).map(mv => (
                <label key={mv} className={`checkbox-row`}>
                  <input
                    type="checkbox"
                    checked={filterMvType.includes(mv)}
                    onChange={(e) => {
                      if (isMultiSelectMv) {
                        if (e.target.checked) setFilterMvType(prev => [...prev, mv]);
                        else setFilterMvType(prev => prev.filter(v => v !== mv));
                      } else {
                        if (e.target.checked) setFilterMvType([mv]);
                        else setFilterMvType([]);
                      }
                    }}
                  />
                  {mv}
                </label>
              ))}
            </div>
          </div>
        );
      case 'length':
        return (
          <div className="filter-popover" style={{ width: '250px' }}>
            <div className="popover-header">
              <span>{text.length}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`popover-sort-btn ${sortOption === 'length' ? 'active' : ''}`}
                  onClick={() => {
                    setSortOption('length');
                    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  {sortOption === 'length' && sortOrder === 'desc' ? '▼' : '▲'}
                </button>
                <button className="popover-reset-btn" onClick={() => {
                  setFilterLength(globalRanges.length);
                  if (sortOption === 'length') setSortOption(null);
                }}>
                  ↺
                </button>
              </div>
            </div>
            <DualRangeSlider
              min={globalRanges.length[0]}
              max={globalRanges.length[1]}
              value={filterLength}
              onChange={setFilterLength}
              formatLabel={(val) => {
                const m = Math.floor(val / 60);
                const s = val % 60;
                return `${m}:${s.toString().padStart(2, '0')}`;
              }}
            />
          </div>
        );
      case 'bpm':
        return (
          <div className="filter-popover" style={{ width: '250px' }}>
            <div className="popover-header">
              <span>{text.bpm}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`popover-sort-btn ${sortOption === 'bpm' ? 'active' : ''}`}
                  onClick={() => {
                    setSortOption('bpm');
                    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  {sortOption === 'bpm' && sortOrder === 'desc' ? '▼' : '▲'}
                </button>
                <button className="popover-reset-btn" onClick={() => {
                  setFilterBpm(globalRanges.bpm);
                  if (sortOption === 'bpm') setSortOption(null);
                }}>
                  ↺
                </button>
              </div>
            </div>
            <DualRangeSlider
              min={globalRanges.bpm[0]}
              max={globalRanges.bpm[1]}
              value={filterBpm}
              onChange={setFilterBpm}
            />
          </div>
        );
      case 'date':
        return (
          <div className="filter-popover" style={{ width: '250px' }}>
            <div className="popover-header">
              <span>{text.date}</span>
              <div className="popover-controls">
                <button
                  className={`popover-sort-btn ${sortOption === 'date' ? 'active' : ''}`}
                  onClick={() => {
                    setSortOption('date');
                    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  {sortOption === 'date' && sortOrder === 'desc' ? '▼' : '▲'}
                </button>
                <button className="popover-reset-btn" onClick={() => {
                  setFilterDate(globalRanges.date);
                  if (sortOption === 'date') setSortOption(null);
                }}>
                  ↺
                </button>
              </div>
            </div>
            <DualRangeSlider
              min={globalRanges.date[0]}
              max={globalRanges.date[1]}
              value={filterDate}
              onChange={setFilterDate}
              formatLabel={(val) => {
                const d = new Date(val);
                return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
              }}
              step={86400000}
            />
          </div>
        );
      case 'noteCount':
        return (
          <div className="filter-popover" style={{ width: '280px' }}>
            <div className="popover-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{text.noteCount}</span>
                <div className="popover-controls">
                  <button
                    className={`popover-sort-btn ${sortOption === 'noteCount' ? 'active' : ''}`}
                    onClick={() => {
                      setSortOption('noteCount');
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    {sortOption === 'noteCount' && sortOrder === 'desc' ? '▼' : '▲'}
                  </button>
                  <button className="popover-reset-btn" onClick={() => {
                    if (activeNoteTab === 'ex') setFilterExNote(globalRanges.exNote);
                    if (activeNoteTab === 'ma') setFilterMaNote(globalRanges.maNote);
                    if (activeNoteTab === 'ap') setFilterApNote(globalRanges.apNote);
                    if (sortOption === 'noteCount') setSortOption(null);
                  }}>
                    ↺
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                <button
                  style={{ flex: 1, padding: '4px', fontSize: '12px', background: activeNoteTab === 'ex' ? 'var(--accent-color)' : 'rgba(128,128,128,0.3)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                  onClick={() => setActiveNoteTab('ex')}
                >EX</button>
                <button
                  style={{ flex: 1, padding: '4px', fontSize: '12px', background: activeNoteTab === 'ma' ? 'var(--accent-color)' : 'rgba(128,128,128,0.3)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                  onClick={() => setActiveNoteTab('ma')}
                >MAS</button>
                <button
                  style={{ flex: 1, padding: '4px', fontSize: '12px', background: activeNoteTab === 'ap' ? 'var(--accent-color)' : 'rgba(128,128,128,0.3)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                  onClick={() => setActiveNoteTab('ap')}
                >APD</button>
              </div>
            </div>

            {activeNoteTab === 'ex' && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '12px', marginBottom: '5px', textAlign: 'center' }}>Expert: {filterExNote[0]} ~ {filterExNote[1]}</div>
                <DualRangeSlider min={globalRanges.exNote[0]} max={globalRanges.exNote[1]} value={filterExNote} onChange={setFilterExNote} step={10} />
              </div>
            )}
            {activeNoteTab === 'ma' && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '12px', marginBottom: '5px', textAlign: 'center' }}>Master: {filterMaNote[0]} ~ {filterMaNote[1]}</div>
                <DualRangeSlider min={globalRanges.maNote[0]} max={globalRanges.maNote[1]} value={filterMaNote} onChange={setFilterMaNote} step={10} />
              </div>
            )}
            {activeNoteTab === 'ap' && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '12px', marginBottom: '5px', textAlign: 'center' }}>Append: {filterApNote[0]} ~ {filterApNote[1]}</div>
                <DualRangeSlider min={globalRanges.apNote[0]} max={globalRanges.apNote[1]} value={filterApNote} onChange={setFilterApNote} step={10} />
              </div>
            )}
          </div>
        );
      case 'mvMember':
        return (
          <div className="filter-popover" style={{ width: '200px' }}>
            <div className="popover-header">
              <span>{text.mvMember}</span>
              <div className="popover-controls">
                <button
                  className={`multi-select-btn ${isMultiSelectMvMember ? 'active' : ''}`}
                  onClick={() => {
                    setIsMultiSelectMvMember(!isMultiSelectMvMember);
                    if (!isMultiSelectMvMember && filterMvMember.length > 1) {
                      setFilterMvMember([filterMvMember[filterMvMember.length - 1]]);
                    }
                  }}
                >
                  다중선택
                </button>
                <button className="popover-reset-btn" onClick={() => setFilterMvMember([])}>
                  ↺
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '10px' }}>
              {[1, 2, 3, 4, 5, 6].map(num => (
                <button
                  key={num}
                  style={{
                    padding: '8px 0',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: filterMvMember.includes(num) ? 'var(--accent-color)' : 'rgba(128,128,128,0.2)',
                    color: filterMvMember.includes(num) ? '#fff' : 'inherit',
                    fontWeight: filterMvMember.includes(num) ? 'bold' : 'normal',
                    transition: 'all 0.2s',
                    fontSize: '14px'
                  }}
                  onClick={() => {
                    if (isMultiSelectMvMember) {
                      setFilterMvMember(prev =>
                        prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
                      );
                    } else {
                      setFilterMvMember(prev =>
                        (prev.length === 1 && prev[0] === num) ? [] : [num]
                      );
                    }
                  }}
                >
                  {num === 6 ? '6+' : num}
                </button>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const difficulties = ['easy', 'normal', 'hard', 'expert', 'master', 'append'];
  const text = UI_TEXT[language];
  const [isMobile, setIsMobile] = useState(false);

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

      <div className="detailed-search-container">
        {(() => {
          const hasActiveFilters = filterClassification.length > 0 ||
            filterUnit.length > 0 ||
            filterMvType.length > 0 ||
            (sortOption && !(sortOption === 'date' && sortOrder === 'desc')) ||
            (filterLength[0] > globalRanges.length[0] || filterLength[1] < globalRanges.length[1]) ||
            (filterBpm[0] > globalRanges.bpm[0] || filterBpm[1] < globalRanges.bpm[1]) ||
            (filterDate[0] > globalRanges.date[0] || filterDate[1] < globalRanges.date[1]) ||
            (filterExNote[0] > globalRanges.exNote[0] || filterExNote[1] < globalRanges.exNote[1]) ||
            (filterMaNote[0] > globalRanges.maNote[0] || filterMaNote[1] < globalRanges.maNote[1]) ||
            (filterApNote[0] > globalRanges.apNote[0] || filterApNote[1] < globalRanges.apNote[1]) ||
            (filterMvMember.length > 0);
          const isDetailOpen = showDetailSearch || hasActiveFilters;

          return (
            <>
              <div className="ds-button-row">
                <button
                  className={`ds-toggle-btn ${hasActiveFilters ? 'active' : ''}`}
                  onClick={() => {
                    if (showDetailSearch) {
                      // CLOSING: Always stash current state and reset, regardless of hasActiveFilters
                      setStashedFilters({
                        classification: filterClassification,
                        unit: filterUnit,
                        mvType: filterMvType,
                        length: filterLength,
                        bpm: filterBpm,
                        date: filterDate,
                        exNote: filterExNote,
                        maNote: filterMaNote,
                        apNote: filterApNote,
                        mvMember: filterMvMember,
                        sortOption: sortOption,
                        sortOrder: sortOrder,
                        activeNoteTab: activeNoteTab
                      });

                      // Reset all to defaults (Clean state for Main View)
                      setFilterClassification([]);
                      setFilterUnit([]);
                      setFilterMvType([]);
                      setFilterLength(globalRanges.length);
                      setFilterBpm(globalRanges.bpm);
                      setFilterDate(globalRanges.date);
                      setFilterExNote(globalRanges.exNote);
                      setFilterMaNote(globalRanges.maNote);
                      setFilterApNote(globalRanges.apNote);
                      setFilterMvMember([]);
                      setSortOption(null);
                      setSortOrder('asc');
                      setActiveNoteTab('ex');

                      setShowDetailSearch(false);
                    } else {
                      // OPENING
                      if (stashedFilters) {
                        // Restore stash
                        setFilterClassification(stashedFilters.classification);
                        setFilterUnit(stashedFilters.unit);
                        setFilterMvType(stashedFilters.mvType);
                        setFilterLength(stashedFilters.length);
                        setFilterBpm(stashedFilters.bpm);
                        setFilterDate(stashedFilters.date);
                        setFilterExNote(stashedFilters.exNote);
                        setFilterMaNote(stashedFilters.maNote);
                        setFilterApNote(stashedFilters.apNote);
                        setFilterMvMember(stashedFilters.mvMember);
                        // Ensure we strictly default to date/desc if the STASHED sort was null/undefined
                        // This covers the case where stash was empty/reset
                        setSortOption(stashedFilters.sortOption || 'date');
                        setSortOrder(stashedFilters.sortOrder || 'desc');
                        setActiveNoteTab(stashedFilters.activeNoteTab || 'ex');
                      } else {
                        // Default behavior if no stash: Sort by Date Desc
                        setSortOption('date');
                        setSortOrder('desc');
                        setActiveNoteTab('ex');
                      }
                      setShowDetailSearch(true);
                    }
                  }}
                // style={{ cursor: hasActiveFilters ? 'default' : 'pointer' }} // Removed to allow clicking when active
                >
                  {text.detailedSearch} {isDetailOpen ? '▲' : '▼'}
                </button>
                <div className="count-reset-wrapper">
                  <div className="song-count-box">
                    {songCounts.released}{text.songs}
                    {songCounts.upcoming > 0 && (
                      <span className="upcoming-count">
                        ({songCounts.upcoming}{text.songs} {text.upcoming})
                      </span>
                    )}
                  </div>

                  <button
                    className="ds-reset-btn"
                    title="Reset Filters"
                    onClick={() => {
                      setFilterClassification([]);
                      setFilterUnit([]);
                      setFilterMvType([]);
                      setFilterLength(globalRanges.length);
                      setFilterBpm(globalRanges.bpm);
                      setFilterDate(globalRanges.date);
                      setFilterExNote(globalRanges.exNote);
                      setFilterMaNote(globalRanges.maNote);
                      setFilterApNote(globalRanges.apNote);
                      setFilterApNote(globalRanges.apNote);
                      setFilterMvMember([]);
                      setActiveNoteTab('ex');
                      setSortOption('date');
                      setSortOrder('desc');
                    }}
                    style={{
                      opacity: hasActiveFilters ? 1 : 0,
                      pointerEvents: hasActiveFilters ? 'auto' : 'none'
                    }}
                  >
                    ↺

                  </button>
                </div>
                <button
                  className="graph-toggle-btn"
                  onClick={() => setIsGraphModalOpen(true)}
                  title={language === 'jp' ? "統計グラフ" : "통계 그래프"}
                  style={{ marginLeft: 'auto' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="30" height="30">
                    <path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.1h-15V5h15v14.1zm0-16.1h-15c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                  </svg>
                </button>
              </div >

              {isDetailOpen && (
                <div className="detailed-search-content">
                  {/* Filter Groups as Popovers */}
                  <div className="filter-popover-container">
                    <button
                      className={`filter-group-btn ${filterClassification.length > 0 ? 'active' : ''}`}
                      onClick={() => setOpenFilterDropdown(openFilterDropdown === 'classification' ? null : 'classification')}
                    >
                      {text.classification}
                    </button>
                    {!isMobile && openFilterDropdown === 'classification' && renderFilterPopover('classification')}
                  </div>

                  <div className="filter-popover-container">
                    <button
                      className={`filter-group-btn ${filterUnit.length > 0 ? 'active' : ''}`}
                      onClick={() => setOpenFilterDropdown(openFilterDropdown === 'unit' ? null : 'unit')}
                    >
                      {text.unit}
                    </button>
                    {!isMobile && openFilterDropdown === 'unit' && renderFilterPopover('unit')}
                  </div>

                  <div className="filter-popover-container">
                    <button
                      className={`filter-group-btn ${filterMvType.length > 0 ? 'active' : ''}`}
                      onClick={() => setOpenFilterDropdown(openFilterDropdown === 'mv' ? null : 'mv')}
                    >
                      {text.mvType}
                    </button>
                    {!isMobile && openFilterDropdown === 'mv' && renderFilterPopover('mv')}
                  </div>

                  <div className="filter-popover-container">
                    <button
                      className={`filter-group-btn ${openFilterDropdown === 'length' || (filterLength[0] > globalRanges.length[0] || filterLength[1] < globalRanges.length[1]) ? 'active' : ''}`}
                      onClick={() => setOpenFilterDropdown(openFilterDropdown === 'length' ? null : 'length')}
                    >
                      {text.length}
                    </button>
                    {!isMobile && openFilterDropdown === 'length' && renderFilterPopover('length')}
                  </div>

                  <div className="filter-popover-container">
                    <button
                      className={`filter-group-btn ${openFilterDropdown === 'bpm' || (filterBpm[0] > globalRanges.bpm[0] || filterBpm[1] < globalRanges.bpm[1]) ? 'active' : ''}`}
                      onClick={() => setOpenFilterDropdown(openFilterDropdown === 'bpm' ? null : 'bpm')}
                    >
                      {text.bpm}
                    </button>
                    {!isMobile && openFilterDropdown === 'bpm' && renderFilterPopover('bpm')}
                  </div>

                  <div className="filter-popover-container">
                    <button
                      className={`filter-group-btn ${openFilterDropdown === 'date' || (filterDate[0] > globalRanges.date[0] || filterDate[1] < globalRanges.date[1]) ? 'active' : ''}`}
                      onClick={() => setOpenFilterDropdown(openFilterDropdown === 'date' ? null : 'date')}
                    >
                      {text.date}
                    </button>
                    {!isMobile && openFilterDropdown === 'date' && renderFilterPopover('date')}
                  </div>

                  {/* Combined Note Count Filter */}
                  <div className="filter-popover-container">
                    <button
                      className={`filter-group-btn ${openFilterDropdown === 'noteCount' ||
                        (filterExNote[0] > globalRanges.exNote[0] || filterExNote[1] < globalRanges.exNote[1]) ||
                        (filterMaNote[0] > globalRanges.maNote[0] || filterMaNote[1] < globalRanges.maNote[1]) ||
                        (filterApNote[0] > globalRanges.apNote[0] || filterApNote[1] < globalRanges.apNote[1])
                        ? 'active' : ''}`}
                      onClick={() => setOpenFilterDropdown(openFilterDropdown === 'noteCount' ? null : 'noteCount')}
                    >
                      {text.noteCount}
                    </button>
                    {!isMobile && openFilterDropdown === 'noteCount' && renderFilterPopover('noteCount')}
                  </div>

                  {/* MV Member Filter */}
                  <div className="filter-popover-container">
                    <button
                      className={`filter-group-btn ${openFilterDropdown === 'mvMember' || filterMvMember.length > 0 ? 'active' : ''}`}
                      onClick={() => setOpenFilterDropdown(openFilterDropdown === 'mvMember' ? null : 'mvMember')}
                    >
                      {text.mvMember}
                    </button>
                    {!isMobile && openFilterDropdown === 'mvMember' && renderFilterPopover('mvMember')}
                  </div>
                </div>
              )
              }
              {isMobile && isDetailOpen && openFilterDropdown && (
                <div className="mobile-popover-wrapper">
                  {renderFilterPopover(openFilterDropdown)}
                </div>
              )}
            </>
          );
        })()}
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
                      {sortOption === 'length' && song.length && (
                        <span style={{ marginLeft: '0.5rem' }}>{song.length}</span>
                      )}
                      {sortOption === 'noteCount' && (
                        <span style={{ marginLeft: '0.5rem' }}>
                          {activeNoteTab === 'ex' && song.ex_note}
                          {activeNoteTab === 'ma' && song.ma_note}
                          {activeNoteTab === 'ap' && song.ap_note}
                        </span>
                      )}
                      {sortOption === 'date' && (
                        <span style={{ marginLeft: '0.5rem' }}>
                          {activeNoteTab === 'ap' && song.apd ? `20${song.apd}` : song.release_date}
                        </span>
                      )}
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
            )}
          </div>
        </div>
        <button onClick={handleScrollToTop} className="scroll-top-button">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" />
          </svg>
        </button>
      </div>

      <GraphModal
        isOpen={isGraphModalOpen}
        onClose={() => setIsGraphModalOpen(false)}
        allSongs={allSongs}
        language={language}
      />
    </div >
  );
}

export default App;
