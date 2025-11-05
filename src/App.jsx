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

  // WebP 채보 사용 여부를 localStorage에서 불러와 초기 상태로 설정
  const [useWebP, setUseWebP] = useState(
    () => localStorage.getItem('useWebP') === 'true'
  );

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
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      result = result.filter(song =>
        (song.title_ko && song.title_ko.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (song.title_jp && song.title_jp.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (song.composer && song.composer.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (song.composer_jp && song.composer_jp.toLowerCase().includes(lowerCaseSearchTerm)) // [추가] 일본어 작곡가 검색 조건
      );

    }
    if (expertLevel) { result = result.filter(song => song.levels.expert === parseInt(expertLevel)); } 
    else if (masterLevel) { result = result.filter(song => song.levels.master === parseInt(masterLevel)); } 
    else if (appendLevel) { result = result.filter(song => song.levels.append === parseInt(appendLevel)); }
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
  
  if (isLoading) return <div className="App"><h1>로딩 중...</h1></div>;
  if (error) return <div className="App"><h1>캐시삭제/ios웹앱(바로가기)면 재설치: {error.message}</h1></div>;

  return (
    <div className="App">
      <header>
        <img src="/title-image.webp?v=2" alt="pjsk-charts" className="title-image" />
        <a href="https://rilakkuma2.github.io/prsk-calc/" target="_blank" rel="noopener noreferrer" className="calculator-button">
          프로세카 계산기
        </a>
      </header>

      <div className="format-toggle-container">
        <div className="format-toggle">
          <input
            type="checkbox"
            id="webp-toggle"
            checked={useWebP}
            onChange={(e) => setUseWebP(e.target.checked)}
          />
          <label htmlFor="webp-toggle">이미지 파일로 채보 보기(로딩 느릴 시 체크)</label>
        </div>
      </div>

      <div className="filter-bar">
        <input 
          type="text" 
          placeholder="곡명 또는 작곡가로 검색 (한/일)" 
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
          // 이벤트 핸들러를 담을 객체 생성
          const coverHandlers = {
            onClick: (e) => {
              e.stopPropagation(); // 외부 클릭 감지 이벤트 전파 방지
              setActiveSongId(prevId => (prevId === song.id ? null : song.id));
            }
          };

          // 터치 기기가 아닐 때만 마우스 오버/아웃 이벤트 추가
          if (!isTouchDevice) {
            coverHandlers.onMouseEnter = () => setActiveSongId(song.id);
            coverHandlers.onMouseLeave = () => setActiveSongId(null);
          }
          
          // ver 필드를 기반으로 캐시 버스팅 문자열 생성
          const cacheBuster = song.ver && song.ver !== "0" ? `?v=${song.ver}` : '';

          return (
            <div key={song.id} className="song-item">
              <div 
                className="song-cover-wrapper"
                {...coverHandlers} // 이벤트 핸들러 객체 적용
              >
                <img 
                  loading="lazy" 
                  src={`https://asset.rilaksekai.com/cover/${String(song.id).padStart(3, '0')}.jpg${cacheBuster}`} 
                  alt={song.title_ko} 
                  className={`song-cover unit-border-${song.unit_code.replace('/', '-')}`} 
                />
                {activeSongId === song.id && (
                  <div className="song-popover">
                     <div className="popover-column">
                      <span>{song.classification || '-'}</span>
                      <span>{UNIT_NAME_MAP[song.unit_code] || song.unit_code}</span>
                    </div>
                    <div className="popover-column">
                      <span>{song.mv_type || '-'}</span>
                      <span>{song.composer || '-'}</span>
                    </div>
                    <div className="popover-column">
                      <span>{song.length || '-'}</span>
                      <span>{song.release_date || '-'}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="song-details">
                <div className="song-title-row">
                  <div className="song-titles">
                    <span className="title-ko">{song.title_ko}</span>
                    <span className="title-jp">{song.title_jp}</span>
                  </div>
                  {song.bpm && (
                    <span className="song-bpm">
                      {typeof song.bpm === 'string' ? song.bpm : `${song.bpm} BPM`}
                    </span>
                  )}
                </div>
                <div className="difficulty-circles">
                  {difficulties.map(diff => (
                    song.levels[diff] ? (
                      <a 
                        key={diff} 
                        // useWebP 상태와 cacheBuster를 함께 사용하여 링크 동적 생성
                        href={`https://asset.rilaksekai.com/${useWebP ? 'charts' : 'svg'}/${song.id}/${diff}.${useWebP ? 'html' : 'svg'}${cacheBuster}`}
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={`circle ${diff}`} 
                        title={`${diff.charAt(0).toUpperCase() + diff.slice(1)}: ${song.levels[diff]}`}
                      >
                        {song.levels[diff]}
                      </a>
                    ) : (<div key={diff} className="circle-placeholder"></div>)
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {filteredSongs.length === 0 && <p>검색 결과가 없습니다.</p>}
      </div>
    </div>
  );
}

export default App;
