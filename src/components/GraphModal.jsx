import React, { useState, useMemo, useEffect } from 'react';
import { getChoseong } from 'es-hangul';
import { toHiragana } from 'wanakana';
import DualRangeSlider from './DualRangeSlider';

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

const UNIT_ORDER = ["VS", "L/n", "MMJ", "VBS", "WxS", "N25", "Oth", "Unk"];

const UNIT_COLORS = {
    "VS": "#aaaaaa",
    "L/n": "#4455DD",
    "MMJ": "#88DD44",
    "VBS": "#EE1166",
    "WxS": "#FF9900",
    "N25": "#884499",
    "Oth": "#cccccc",
    "Unk": "#cccccc"
};

const DIFF_COLORS = {
    "easy": "#66aaff",
    "normal": "#66ff44",
    "hard": "#ffaa00",
    "expert": "#ff3355",
    "master": "#aa33ff",
    "append": "linear-gradient(to bottom right, #ad92fd, #fe7bde)"
};

const DIFFICULTIES = ["easy", "normal", "hard", "expert", "master", "append"];

// Defined order including both Korean (User request) and potential Japanese mapping equivalents for robustness
const MV_ORDER = [
    "MV X",
    "원곡MV", "원곡", "原曲", // Handle "원곡" and user's "원곡MV" label if distinct, plus JP "原曲"
    "2D",
    "원곡/2D", "原曲/2D",
    "2D/3D",
    "3D",
    "원곡/3D", "原曲/3D",
    "원곡/2D/3D", "原曲/2D/3D"
];

const GraphModal = ({ isOpen, onClose, allSongs, language }) => {
    if (!isOpen) return null;

    const [activeTab, setActiveTab] = useState('level'); // 'level', 'append', 'other'
    const [xAxisOther, setXAxisOther] = useState('unit'); // unit, classification, mv_type, year, month, bpm, time

    // Local filters
    const [filterUnit, setFilterUnit] = useState([]);
    const [isMultiSelectUnit, setIsMultiSelectUnit] = useState(false);
    const [filterClassification, setFilterClassification] = useState([]);
    const [isMultiSelectClass, setIsMultiSelectClass] = useState(false);
    const [filterMvType, setFilterMvType] = useState([]);
    const [isMultiSelectMv, setIsMultiSelectMv] = useState(false);
    const [filterDifficulties, setFilterDifficulties] = useState(['expert', 'master']);

    // New Filters State (Length, BPM, Date)
    // We need globalRanges first to init state, but state init runs once.
    // We'll init with defaults and update via useEffect if needed, or calc ranges first?
    // For simplicity, we'll calc globalRanges inside component body, and use useEffect or just check if null.
    // Actually, let's use a functional State initializer or effect.

    const [filterLength, setFilterLength] = useState([0, 600]); // 0 to 10 min default
    const [filterBpm, setFilterBpm] = useState([0, 400]);
    const [filterDate, setFilterDate] = useState([new Date('2020-09-30').getTime(), new Date().getTime()]);
    const [filterExNote, setFilterExNote] = useState([0, 2000]);
    const [filterMaNote, setFilterMaNote] = useState([0, 2000]);
    const [filterApNote, setFilterApNote] = useState([0, 2000]);
    const [filterMvMember, setFilterMvMember] = useState([]);
    const [isMultiSelectMvMember, setIsMultiSelectMvMember] = useState(false);

    const [activeNoteTab, setActiveNoteTab] = useState('ex'); // 'ex' | 'ma' | 'ap'

    // New State for Month Graph Type
    // const [monthGraphType, setMonthGraphType] = useState('seasonal'); // REMOVED - Always Timeline
    const [selectedPoint, setSelectedPoint] = useState(null); // { label, value, x, y } for tooltip

    const text = useMemo(() => {
        const textLanguage = language; // Use the language prop directly
        if (textLanguage === 'jp') {
            return {
                title: "統計グラフ",
                tabs: {
                    level: "レベル別",
                    append: "APPEND",
                    other: "その他"
                },
                xAxis: "X軸:",
                filter: "追加フィルター",
                diffFilter: "難易度フィルター",
                close: "閉じる",
                reset: "リセット",
                units: "ユニット",
                classification: "カテゴリ",
                mvType: "MV種類",
                year: "リリース年",
                month: "リリース月",
                bpm: "BPM",
                time: "曲の長さ",
                length: "時間",
                date: "リリース日",
                count: "曲数",
                noData: "データがありません。",
                noteCount: "ノーツ数",
                mvMember: "MV人数"
            };
        }
        return {
            title: textLanguage === 'ko' ? "통계 그래프" : "Statistical Graph",
            tabs: {
                level: textLanguage === 'ko' ? "레벨별" : "By Level",
                append: textLanguage === 'ko' ? "APPEND" : "APPEND",
                other: textLanguage === 'ko' ? "기타 분류" : "Other"
            },
            xAxis: textLanguage === 'ko' ? "X축 기준:" : "X-Axis:",
            filter: textLanguage === 'ko' ? "추가 필터" : "Additional Filters",
            diffFilter: textLanguage === 'ko' ? "난이도 필터" : "Difficulty Filter",
            close: textLanguage === 'ko' ? "닫기" : "Close",
            reset: textLanguage === 'ko' ? "초기화" : "Reset",
            units: textLanguage === 'ko' ? "유닛" : "Unit",
            classification: textLanguage === 'ko' ? "카테고리" : "Category",
            mvType: textLanguage === 'ko' ? "MV 종류" : "MV Type",
            year: textLanguage === 'ko' ? "출시 년도" : "Release Year",
            month: textLanguage === 'ko' ? "출시월" : "Release Month",
            bpm: textLanguage === 'ko' ? "BPM" : "BPM",
            time: textLanguage === 'ko' ? "곡 길이" : "Duration",
            length: textLanguage === 'ko' ? "곡 길이" : "Length",
            date: textLanguage === 'ko' ? "출시일" : "Date",
            count: textLanguage === 'ko' ? "곡 수" : "Song Count",
            noData: textLanguage === 'ko' ? "데이터가 없습니다." : "No data available.",
            noteCount: textLanguage === 'ko' ? "노트 수" : "Note Count",
            mvMember: textLanguage === 'ko' ? "MV 인원" : "MV Members"
        };
    }, [language]);

    // Helper to get translated values
    const getUnitName = (code) => language === 'jp' ? code : (UNIT_NAME_MAP[code] || code);
    // Helper to reverse translate unit name to code for coloring/sorting logic
    const getUnitCodeFromName = (name) => {
        if (language !== 'jp') {
            const entry = Object.entries(UNIT_NAME_MAP).find(([key, val]) => val === name);
            return entry ? entry[0] : 'Oth';
        }
        return name; // In JP mode, name is code
    };

    const getClassName = (cls) => language === 'jp' ? (CLASS_MAP_JP[cls] || cls) : cls;

    // Calculate Global Ranges
    const globalRanges = useMemo(() => {
        if (!allSongs || allSongs.length === 0) return { length: [0, 600], bpm: [0, 400], date: [new Date('2020-09-30').getTime(), new Date().getTime()] };

        let minLen = Infinity, maxLen = -Infinity;
        let minBpm = Infinity, maxBpm = -Infinity;
        let minDate = Infinity, maxDate = -Infinity;

        allSongs.forEach(s => {
            // Length
            if (s.length) {
                const parts = s.length.split(':');
                if (parts.length === 2) {
                    const sec = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                    if (!isNaN(sec)) {
                        if (sec < minLen) minLen = sec;
                        if (sec > maxLen) maxLen = sec;
                    }
                }
            }
            // BPM
            if (s.bpm) {
                const match = String(s.bpm).match(/\d+(\.\d+)?/);
                if (match) {
                    const val = parseFloat(match[0]);
                    if (val < minBpm) minBpm = val;
                    if (val > maxBpm) maxBpm = val;
                }
            }
            // Date
            if (s.release_date) {
                const d = new Date(s.release_date).getTime();
                if (!isNaN(d)) {
                    if (d < minDate) minDate = d;
                    if (d > maxDate) maxDate = d;
                }
            }
        });

        // Defaults if no data
        if (minLen === Infinity) { minLen = 0; maxLen = 300; }
        if (minBpm === Infinity) { minBpm = 0; maxBpm = 300; }
        if (minDate === Infinity) {
            const now = new Date().getTime();
            minDate = now; maxDate = now;
        }

        // Add padding or exact? Exact.
        // Ex Note
        const exNotes = allSongs.reduce((acc, s) => { if (s.ex_note) acc.push(parseInt(s.ex_note) || 0); return acc; }, []);
        const maNotes = allSongs.reduce((acc, s) => { if (s.ma_note) acc.push(parseInt(s.ma_note) || 0); return acc; }, []);
        const apNotes = allSongs.reduce((acc, s) => { if (s.ap_note) acc.push(parseInt(s.ap_note) || 0); return acc; }, []);
        const mvMembers = allSongs.reduce((acc, s) => { if (s.mv_in) acc.push(parseInt(s.mv_in) || 0); return acc; }, []);

        const minEx = exNotes.length ? Math.min(...exNotes) : 0;
        const maxEx = exNotes.length ? Math.max(...exNotes) : 2000;
        const minMa = maNotes.length ? Math.min(...maNotes) : 0;
        const maxMa = maNotes.length ? Math.max(...maNotes) : 2000;
        const minAp = apNotes.length ? Math.min(...apNotes) : 0;
        const maxAp = apNotes.length ? Math.max(...apNotes) : 2000;

        return {
            length: [minLen, maxLen],
            bpm: [minBpm, maxBpm],
            date: [minDate, maxDate],
            exNote: [minEx, maxEx],
            maNote: [minMa, maxMa],
            apNote: [minAp, maxAp]
        };
    }, [allSongs]);

    // Initialize State with Global Ranges only on first valid load
    useEffect(() => {
        if (globalRanges) {
            // Only set if we haven't touched them? Or always reset when global ranges change significantly?
            // Actually, we should just init once.
            // But if allSongs loads later...
            // Let's use a flag or just check if state is default.
            // For now, simple set on mount or change if they are at 'default-default'.
            // Better: Just set them initially.
            // But since 'useState' initial value is only used once, if globalRanges changes (e.g. data load), we might want to update ranges if user hasn't touched them.
            // Let's skip complex sync for now and assume user can reset.
            // Wait, actually, let's sync local state to global ranges IF the local state is 'out of bounds' or empty?
            // Simpler: Just rely on user usage. But we need valid defaults.
            setFilterLength(prev => (prev[0] === 0 && prev[1] === 600) ? globalRanges.length : prev);
            setFilterBpm(prev => (prev[0] === 0 && prev[1] === 400) ? globalRanges.bpm : prev);
            setFilterDate(prev => (prev[0] === 1601424000000 && prev[1] > 1700000000000) ? globalRanges.date : prev); // Approx check
            setFilterExNote(prev => (prev[0] === 0 && prev[1] === 2000) ? globalRanges.exNote : prev);
            setFilterMaNote(prev => (prev[0] === 0 && prev[1] === 2000) ? globalRanges.maNote : prev);
            setFilterApNote(prev => (prev[0] === 0 && prev[1] === 2000) ? globalRanges.apNote : prev);
            setFilterMvMember([]);
        }
    }, [globalRanges]);


    // Filter songs based on local filters
    const filteredSongs = useMemo(() => {
        return allSongs.filter(song => {
            // Length Filter
            if (song.length) {
                const parts = song.length.split(':');
                if (parts.length === 2) {
                    const sec = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                    if (sec < filterLength[0] || sec > filterLength[1]) return false;
                }
            }

            // BPM Filter
            if (song.bpm) {
                const match = String(song.bpm).match(/\d+(\.\d+)?/);
                if (match) {
                    const val = parseFloat(match[0]);
                    if (val < filterBpm[0] || val > filterBpm[1]) return false;
                }
            }

            // Date Filter
            if (song.release_date) {
                const d = new Date(song.release_date).getTime();
                if (d < filterDate[0] || d > filterDate[1]) return false;
            }

            // Ex Note
            if (song.ex_note) {
                const val = parseInt(song.ex_note) || 0;
                if (val < filterExNote[0] || val > filterExNote[1]) return false;
            }

            // Ma Note
            if (song.ma_note) {
                const val = parseInt(song.ma_note) || 0;
                if (val < filterMaNote[0] || val > filterMaNote[1]) return false;
            }

            // Ap Note
            if (song.ap_note) {
                const val = parseInt(song.ap_note) || 0;
                // If ap_note exists, filter by range. If not exists, should we include?
                // Standard behavior: include if no filter applied? But here filter is always applied as range.
                // Assuming untargeted songs shouldn't be filtered out unless they have the field and it's out of range?
                // Actually, if we filter by AP note range [500, 1000], songs without AP should probably be excluded?
                // Let's assume: if song has NO append, and we are not specifically filtering for "All" or "None",
                // usually range filter implies "must have value in range".
                // But for 'Append Note', many songs don't have it.
                // If user sets range 0-2000 (default), it includes 0. 
                // So if parse(undefined) is NaN, it fails.
                // Let's treat undefined as 0 or skip check if range matches global?
                // Safest: check if filter is active (not default). If default, pass.
                // But here logic is simple range check.
                // Let's treat missing as 0 for comparison if range includes 0.
                // Note logic in App.jsx: if (!song.ap_note) return true;
                if (val < filterApNote[0] || val > filterApNote[1]) return false;
            } else {
                // Song has no AP note. If filter range doesn't cover "0" or "undefined" case...
                // App.jsx logic: return true if no ap_note.
                // We should match App.jsx logic for consistency.
                // But wait, if I want to find songs with >1000 AP notes, I don't want songs with NO AP notes.
                // App.jsx: if (!song.ap_note) return true; -> THIS MEANS FILTER IS IGNORED for non-AP songs.
                // This means you CANNOT filter to ONLY AP songs using this slider in App.jsx.
                // User might find this weird. But I should stick to App.jsx pattern I just implemented or fix both?
                // In App.jsx I wrote: if (!song.ap_note) return true;
                // Let's stick to that for now to avoid breaking existing songs visibility.
            }

            // MV Member
            if (song.mv_in) {
                // Checkboxes: if array empty, showing all (or none? user likely wants all if nothing selected)
                // BUT in App.jsx I made it allow all if empty.
                if (filterMvMember.length > 0) {
                    const val = parseInt(song.mv_in);

                    const includesSixPlus = filterMvMember.includes(6);
                    if (includesSixPlus && val >= 6) return true;

                    if (!filterMvMember.includes(val)) return false;
                }
            } else {
                if (filterMvMember.length > 0) return false; // Exclude if filtering by count and no data
            }

            // Unit Filter
            if (filterUnit.length > 0) {
                const u = getUnitName(song.unit_code);
                if (!filterUnit.includes(u)) return false;
            }
            // Classification Filter
            if (filterClassification.length > 0) {
                const cls = getClassName(song.classification);
                if (!filterClassification.includes(cls)) return false;
            }
            // MV Type Filter
            if (filterMvType.length > 0) {
                const songType = (language === 'jp' && song.mv_type === '원곡') ? '原曲' : song.mv_type;

                const match = filterMvType.some(f => {
                    const parts = f.split('/');
                    return parts.includes(songType);
                });
                if (!match) return false;
            }
            return true;
        });
    }, [allSongs, filterUnit, filterClassification, filterMvType, language, filterLength, filterBpm, filterDate, filterExNote, filterMaNote, filterApNote, filterMvMember]);

    // Helper to generate active filter chips
    const activeChips = useMemo(() => {
        const chips = [];

        // Unit
        filterUnit.forEach(u => chips.push({ label: u, type: 'unit', onRemove: () => setFilterUnit(prev => prev.filter(x => x !== u)) }));

        // Classification
        filterClassification.forEach(c => chips.push({ label: c, type: 'class', onRemove: () => setFilterClassification(prev => prev.filter(x => x !== c)) }));

        // MV
        filterMvType.forEach(m => chips.push({ label: `${m}`, type: 'mv', onRemove: () => setFilterMvType(prev => prev.filter(x => x !== m)) }));

        // Length
        // Compare with globalRanges. But globalRanges depends on render.
        // If diff > tolerance?
        if (filterLength[0] > globalRanges.length[0] || filterLength[1] < globalRanges.length[1]) {
            // Format secs to mm:ss
            const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
            chips.push({
                label: `${fmt(filterLength[0])} ~ ${fmt(filterLength[1])}`,
                type: 'length',
                onRemove: () => setFilterLength(globalRanges.length)
            });
        }

        // BPM
        if (filterBpm[0] > globalRanges.bpm[0] || filterBpm[1] < globalRanges.bpm[1]) {
            chips.push({
                label: `BPM ${Math.round(filterBpm[0])} ~ ${Math.round(filterBpm[1])}`,
                type: 'bpm',
                onRemove: () => setFilterBpm(globalRanges.bpm)
            });
        }
        if (filterDate[0] > globalRanges.date[0] || filterDate[1] < globalRanges.date[1]) {
            const fmt = (ms) => {
                const d = new Date(ms);
                return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
            };
            chips.push({
                label: `${fmt(filterDate[0])} ~ ${fmt(filterDate[1])}`,
                type: 'date',
                onRemove: () => setFilterDate(globalRanges.date)
            });
        }

        // Ex Note
        if (filterExNote[0] > globalRanges.exNote[0] || filterExNote[1] < globalRanges.exNote[1]) {
            chips.push({ label: `EX ${filterExNote[0]}~${filterExNote[1]}`, type: 'exNote', onRemove: () => setFilterExNote(globalRanges.exNote) });
        }
        // Ma Note
        if (filterMaNote[0] > globalRanges.maNote[0] || filterMaNote[1] < globalRanges.maNote[1]) {
            chips.push({ label: `MA ${filterMaNote[0]}~${filterMaNote[1]}`, type: 'maNote', onRemove: () => setFilterMaNote(globalRanges.maNote) });
        }
        // Ap Note
        if (filterApNote[0] > globalRanges.apNote[0] || filterApNote[1] < globalRanges.apNote[1]) {
            chips.push({ label: `AP ${filterApNote[0]}~${filterApNote[1]}`, type: 'apNote', onRemove: () => setFilterApNote(globalRanges.apNote) });
        }
        // MV Member
        if (filterMvMember.length > 0) {
            chips.push({ label: `MV ${filterMvMember.sort().join(',')}인`, type: 'mvMember', onRemove: () => setFilterMvMember([]) });
        }

        return chips;
    }, [filterUnit, filterClassification, filterMvType, filterLength, filterBpm, filterDate, filterExNote, filterMaNote, filterApNote, filterMvMember, globalRanges]);


    // Compute Chart Data
    const chartData = useMemo(() => {
        const data = {};

        filteredSongs.forEach(song => {
            if (activeTab === 'level') {
                // Check standard difficulties (excluding append)
                const diffsToCheck = filterDifficulties.filter(d => d !== 'append');
                diffsToCheck.forEach(diff => {
                    const val = song.levels && song.levels[diff];
                    if (val !== undefined && val !== null) {
                        const k = String(val);
                        if (!data[k]) data[k] = { total: 0, breakdown: {} };
                        data[k].total += 1;
                        data[k].breakdown[diff] = (data[k].breakdown[diff] || 0) + 1;
                    }
                });
            } else if (activeTab === 'append') {
                // Check ONLY Append
                const val = song.levels && song.levels.append;
                if (val !== undefined && val !== null) {
                    const k = String(val);
                    if (!data[k]) data[k] = { total: 0, breakdown: {} };
                    data[k].total += 1;
                    data[k].breakdown['append'] = (data[k].breakdown['append'] || 0) + 1;
                }
            } else {
                // activeTab === 'other'
                let key = null;

                if (xAxisOther === 'unit') {
                    key = getUnitName(song.unit_code);
                } else if (xAxisOther === 'classification') {
                    key = getClassName(song.classification);
                } else if (xAxisOther === 'mv_type') {
                    key = song.mv_type;
                    if (language === 'jp' && key === '원곡') key = '原曲';
                } else if (xAxisOther === 'year') {
                    if (song.release_date) {
                        const d = new Date(song.release_date);
                        let anniv = d.getFullYear() - 2020;
                        // Sep is month 8. Cutoff is Sep 30.
                        // If before Sep 30, it belongs to previous anniversary year.
                        if (d.getMonth() < 8 || (d.getMonth() === 8 && d.getDate() < 30)) {
                            anniv--;
                        }
                        // Handle pre-release? 2020-09-30 is launch. Before that? Project Sekai had no songs before launch?
                        // Assuming valid data >= Launch. If < 0, maybe group to 0 or ignore?
                        // Logic gives 0 for 2020-09-30+.
                        if (anniv < 0) anniv = 0;
                        key = String(anniv);
                    }
                } else if (xAxisOther === 'month') {
                    if (song.release_date) {
                        key = song.release_date.substring(5, 7); // MM
                    }
                } else if (xAxisOther === 'bpm') {
                    // Binning logic: 20 BPM intervals
                    const val = song.bpm ? parseFloat(String(song.bpm).match(/\d+(\.\d+)?/)[0]) : 0;
                    if (val > 0) {
                        const bin = Math.floor(val / 20) * 20;
                        key = String(bin);
                    }
                } else if (xAxisOther === 'time') {
                    // Binning logic: 10 seconds intervals
                    if (song.length) {
                        const parts = song.length.split(':');
                        if (parts.length === 2) {
                            const seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                            const bin = Math.floor(seconds / 10) * 10;
                            key = String(bin);
                        }
                    }
                } else if (xAxisOther === 'mv_member') {
                    // Group by MV member count. Exclude 0, empty, or non-numeric placeholder
                    const val = song.mv_in;
                    if (val && val !== '0' && val !== 0 && val !== '-') {
                        key = String(val);
                    }
                }

                if (key !== null && key !== undefined && key !== '') {
                    const k = String(key);
                    if (!data[k]) data[k] = { total: 0, breakdown: {} };
                    data[k].total += 1;
                }
            }
        });

        // Sort keys
        let keys = Object.keys(data);

        // Numeric sort for Level, Year, Month, BPM, Time, MV Member
        const isNumeric = activeTab === 'level' || activeTab === 'append' ||
            (activeTab === 'other' && ['year', 'month', 'bpm', 'time', 'mv_member'].includes(xAxisOther));

        if (isNumeric) {
            keys.sort((a, b) => parseInt(a) - parseInt(b));
        } else if (activeTab === 'other' && xAxisOther === 'mv_type') {
            keys.sort((a, b) => {
                // Clean up key if needed or map to order
                // Use exact match or 'starts with' if variations exist, but keys should be exact.
                // We treat "원곡" as the slot for "원곡MV" if "원곡MV" is not in data but user called it that.
                // Actually the user prompts "원곡MV" might be what they WANT to see, but data has "원곡".
                // We'll trust MV_ORDER has "원곡" and "原曲".
                const idxA = MV_ORDER.indexOf(a);
                const idxB = MV_ORDER.indexOf(b);
                // If not found, put at end
                return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
            });
        } else if (activeTab === 'other' && xAxisOther === 'unit') {
            // Sort by predefined UNIT_ORDER
            keys.sort((a, b) => {
                const codeA = getUnitCodeFromName(a);
                const codeB = getUnitCodeFromName(b);
                const idxA = UNIT_ORDER.indexOf(codeA);
                const idxB = UNIT_ORDER.indexOf(codeB);
                const res = (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
                return res;
            });
        } else {
            keys.sort();
        }

        // Format labels if needed sort applied
        return keys.map(k => {
            let label = k;
            if (activeTab === 'other') {
                if (xAxisOther === 'bpm') {
                    label = `${k}~`;
                } else if (xAxisOther === 'year') {
                    label = `${k}주년`;
                } else if (xAxisOther === 'time') {
                    const totalSec = parseInt(k);
                    const m = Math.floor(totalSec / 60);
                    const s = totalSec % 60;
                    label = `${m}:${s.toString().padStart(2, '0')}`;
                } else if (xAxisOther === 'mv_member') {
                    label = `${k}명`;
                }
            }
            return { label: label, ...data[k] };
        });
    }, [filteredSongs, activeTab, xAxisOther, language, filterDifficulties]);

    // Timeline Data Logic
    const timelineData = useMemo(() => {
        if (activeTab !== 'other' || xAxisOther !== 'month') return [];

        // 1. Find Min/Max Date from filtered songs
        if (filteredSongs.length === 0) return [];

        const dates = filteredSongs
            .map(s => s.release_date ? new Date(s.release_date) : null)
            .filter(d => d);

        if (dates.length === 0) return [];

        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        // Start from Min Month
        const startYear = minDate.getFullYear();
        const startMonth = minDate.getMonth(); // 0-11
        const endYear = maxDate.getFullYear();
        const endMonth = maxDate.getMonth();

        const dataMap = {};
        filteredSongs.forEach(s => {
            if (!s.release_date) return;
            const d = new Date(s.release_date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            dataMap[key] = (dataMap[key] || 0) + 1;
        });

        const result = [];
        let currYear = startYear;
        let currMonth = startMonth; // 0-based

        while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
            const label = `${currYear}-${String(currMonth + 1).padStart(2, '0')}`;
            result.push({
                label: label,
                year: currYear,
                month: currMonth + 1, // 1-based
                total: dataMap[label] || 0
            });

            currMonth++;
            if (currMonth > 11) {
                currMonth = 0;
                currYear++;
            }
        }
        return result;
    }, [filteredSongs, activeTab, xAxisOther]);

    // Calculate Max Value for Scaling (Modified to include timelineData)
    const maxVal = useMemo(() => {
        if (activeTab === 'other' && xAxisOther === 'month') {
            if (timelineData.length === 0) return 0;
            return Math.max(...timelineData.map(d => d.total));
        }

        if (chartData.length === 0) return 0;

        let valuesToConsider = chartData;
        if (activeTab === 'other' && xAxisOther === 'unit') {
            const vsName = getUnitName("VS");
            valuesToConsider = chartData.filter(d => d.label !== vsName);
        }

        if (valuesToConsider.length === 0) return Math.max(...chartData.map(d => d.total));

        return Math.max(...valuesToConsider.map(d => d.total));
    }, [chartData, activeTab, xAxisOther, language, timelineData]);



    const [openFilterDropdown, setOpenFilterDropdown] = useState(null);

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const renderFilterPopover = (type) => {
        switch (type) {
            case 'unit':
                return (
                    <div className="filter-popover" onClick={(e) => e.stopPropagation()}>
                        <div className="popover-header">
                            <span>{text.units}</span>
                            <button
                                className={`multi-select-btn ${isMultiSelectUnit ? 'active' : ''}`}
                                onClick={() => {
                                    setIsMultiSelectUnit(!isMultiSelectUnit);
                                    if (!isMultiSelectUnit && filterUnit.length > 1) {
                                        setFilterUnit([filterUnit[filterUnit.length - 1]]);
                                    }
                                }}
                                title={isMultiSelectUnit ? "Multi-select ON" : "Multi-select OFF"}
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
                            {UNIT_ORDER.map(code => (
                                <label key={code} className="checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={filterUnit.includes(getUnitName(code))}
                                        onChange={(e) => {
                                            const u = getUnitName(code);
                                            if (isMultiSelectUnit) {
                                                if (e.target.checked) setFilterUnit(prev => [...prev, u]);
                                                else setFilterUnit(prev => prev.filter(v => v !== u));
                                            } else {
                                                if (e.target.checked) setFilterUnit([u]);
                                                else setFilterUnit([]);
                                            }
                                        }}
                                    />
                                    {getUnitName(code)}
                                </label>
                            ))}
                        </div>
                    </div>
                );
            case 'classification':
                return (
                    <div className="filter-popover" onClick={(e) => e.stopPropagation()}>
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
                                <label key={opt} className="checkbox-row">
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
            case 'mv':
                return (
                    <div className="filter-popover" onClick={(e) => e.stopPropagation()}>
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
                                <label key={mv} className="checkbox-row">
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
                    <div className="filter-popover" style={{ width: '250px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="popover-header">
                            <span>{text.length}</span>
                            <button className="popover-reset-btn" onClick={() => setFilterLength(globalRanges.length)}>
                                ↺
                            </button>
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
                    <div className="filter-popover" style={{ width: '250px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="popover-header">
                            <span>{text.bpm}</span>
                            <button className="popover-reset-btn" onClick={() => setFilterBpm(globalRanges.bpm)}>
                                ↺
                            </button>
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
                    <div className="filter-popover" style={{ width: '250px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="popover-header">
                            <span>{text.date}</span>
                            <button className="popover-reset-btn" onClick={() => setFilterDate(globalRanges.date)}>
                                ↺
                            </button>
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
                            step={86400000} // 1 day
                        />
                    </div>
                );
            case 'noteCount':
                return (
                    <div className="filter-popover" style={{ width: '280px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="popover-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{text.noteCount}</span>
                                <button className="popover-reset-btn" onClick={() => {
                                    if (activeNoteTab === 'ex') setFilterExNote(globalRanges.exNote);
                                    if (activeNoteTab === 'ma') setFilterMaNote(globalRanges.maNote);
                                    if (activeNoteTab === 'ap') setFilterApNote(globalRanges.apNote);
                                }}>
                                    ↺
                                </button>
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
                                <DualRangeSlider
                                    min={globalRanges.exNote[0]}
                                    max={globalRanges.exNote[1]}
                                    value={filterExNote}
                                    onChange={setFilterExNote}
                                    step={10}
                                />
                            </div>
                        )}
                        {activeNoteTab === 'ma' && (
                            <div style={{ marginTop: '10px' }}>
                                <div style={{ fontSize: '12px', marginBottom: '5px', textAlign: 'center' }}>Master: {filterMaNote[0]} ~ {filterMaNote[1]}</div>
                                <DualRangeSlider
                                    min={globalRanges.maNote[0]}
                                    max={globalRanges.maNote[1]}
                                    value={filterMaNote}
                                    onChange={setFilterMaNote}
                                    step={10}
                                />
                            </div>
                        )}
                        {activeNoteTab === 'ap' && (
                            <div style={{ marginTop: '10px' }}>
                                <div style={{ fontSize: '12px', marginBottom: '5px', textAlign: 'center' }}>Append: {filterApNote[0]} ~ {filterApNote[1]}</div>
                                <DualRangeSlider
                                    min={globalRanges.apNote[0]}
                                    max={globalRanges.apNote[1]}
                                    value={filterApNote}
                                    onChange={setFilterApNote}
                                    step={10}
                                />
                            </div>
                        )}
                    </div>
                );
            case 'mvMember':
                return (
                    <div className="filter-popover" style={{ width: '200px' }} onClick={(e) => e.stopPropagation()}>
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
                                        color: filterMvMember.includes(num) ? '#fff' : '#000',
                                        fontWeight: filterMvMember.includes(num) ? 'bold' : 'normal',
                                        transition: 'all 0.2s',
                                        fontSize: '14px' // ensure readable
                                    }}
                                    onClick={() => {
                                        if (isMultiSelectMvMember) {
                                            setFilterMvMember(prev =>
                                                prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
                                            );
                                        } else {
                                            // Single select mode: toggle if same clicked, else replace
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

    const renderDiffFilterBtn = (diff) => {
        const isFiltered = activeTab === 'append'
            ? (diff === 'append')
            : filterDifficulties.includes(diff);

        // For Append Tab: only append is clickable (or maybe none if fixed)
        // Actually for Append tab, it is fixed to Append.
        // For Level tab: exclude Append.

        if (activeTab === 'append' && diff !== 'append') return null;
        if (activeTab === 'level' && diff === 'append') return null;

        const handleClick = () => {
            if (activeTab === 'append') return; // Fixed

            // Toggle logic
            setFilterDifficulties(prev => {
                if (prev.includes(diff)) return prev.filter(d => d !== diff);
                return [...prev, diff];
            });
        };

        // Add specific style for non-filtered state if needed to match App.jsx 'filter-label'
        const baseClass = activeTab === 'append' || isFiltered
            ? `circle ${diff} filtered`
            : `circle ${diff}`; // Inactive but keeps circle border

        let label = '';
        switch (diff) {
            case 'easy': label = 'EY'; break;
            case 'normal': label = 'NM'; break;
            case 'hard': label = 'HD'; break;
            case 'expert': label = 'EX'; break;
            case 'master': label = 'MAS'; break;
            case 'append': label = 'APD'; break;
            default: label = diff.charAt(0).toUpperCase() + diff.slice(1);
        }

        return (
            <div
                key={diff}
                className={baseClass}
                onClick={handleClick}
                style={{ cursor: 'pointer', opacity: 1 }}
            >
                {label}
            </div>
        );
    };

    return (
        <div className="graph-modal-overlay" onClick={onClose}>
            <div className="graph-modal-content" onClick={(e) => {
                e.stopPropagation();
                setOpenFilterDropdown(null);
            }}>
                <div className="graph-header">
                    <div className="header-top">
                        <div className="graph-tabs">
                            <button
                                className={`graph-tab-btn ${activeTab === 'level' ? 'active' : ''}`}
                                onClick={() => setActiveTab('level')}
                            >
                                {text.tabs.level}
                            </button>
                            <button
                                className={`graph-tab-btn ${activeTab === 'append' ? 'active' : ''}`}
                                onClick={() => setActiveTab('append')}
                            >
                                {text.tabs.append}
                            </button>
                            <button
                                className={`graph-tab-btn ${activeTab === 'other' ? 'active' : ''}`}
                                onClick={() => setActiveTab('other')}
                            >
                                {text.tabs.other}
                            </button>
                        </div>
                        <button className="close-btn" onClick={onClose}>✕</button>
                    </div>
                </div>

                <div className="graph-controls">
                    {/* Controls specific to tabs */}
                    {activeTab === 'level' && (
                        <div className="control-section">
                            <div className="difficulty-filters" style={{ justifyContent: 'flex-start' }}>
                                {['easy', 'normal', 'hard', 'expert', 'master'].map(diff => renderDiffFilterBtn(diff))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'other' && (
                        <div className="control-section">
                            <select value={xAxisOther} onChange={e => setXAxisOther(e.target.value)} className="graph-select">
                                <option value="unit">{text.units}</option>
                                <option value="classification">{text.classification}</option>
                                <option value="mv_type">{text.mvType}</option>
                                <option value="year">{text.year}</option>
                                <option value="month">{text.month}</option>
                                <option value="bpm">{text.bpm}</option>
                                <option value="time">{text.time}</option>
                                <option value="mv_member">{text.mvMember}</option>
                            </select>
                        </div>
                    )}

                    <div className="control-section">
                        <div className="detailed-search-content" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {/* Unit Filter */}
                            <div className="filter-popover-container">
                                <button
                                    className={`filter-group-btn ${filterUnit.length > 0 ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenFilterDropdown(openFilterDropdown === 'unit' ? null : 'unit');
                                    }}
                                >
                                    {text.units}
                                </button>
                                {(!isMobile && openFilterDropdown === 'unit') && renderFilterPopover('unit')}
                            </div>

                            {/* Classification Filter */}
                            <div className="filter-popover-container">
                                <button
                                    className={`filter-group-btn ${filterClassification.length > 0 ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenFilterDropdown(openFilterDropdown === 'classification' ? null : 'classification');
                                    }}
                                >
                                    {text.classification}
                                </button>
                                {(!isMobile && openFilterDropdown === 'classification') && renderFilterPopover('classification')}
                            </div>

                            {/* MV Type Filter */}
                            <div className="filter-popover-container">
                                <button
                                    className={`filter-group-btn ${filterMvType.length > 0 ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenFilterDropdown(openFilterDropdown === 'mv' ? null : 'mv');
                                    }}
                                >
                                    {text.mvType}
                                </button>
                                {(!isMobile && openFilterDropdown === 'mv') && renderFilterPopover('mv')}
                            </div>

                            {/* Length Filter */}
                            <div className="filter-popover-container">
                                <button
                                    className={`filter-group-btn ${openFilterDropdown === 'length' || (filterLength[0] > globalRanges.length[0] || filterLength[1] < globalRanges.length[1]) ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenFilterDropdown(openFilterDropdown === 'length' ? null : 'length');
                                    }}
                                >
                                    {text.length}
                                </button>
                                {(!isMobile && openFilterDropdown === 'length') && renderFilterPopover('length')}
                            </div>

                            {/* BPM Filter */}
                            <div className="filter-popover-container">
                                <button
                                    className={`filter-group-btn ${openFilterDropdown === 'bpm' || (filterBpm[0] > globalRanges.bpm[0] || filterBpm[1] < globalRanges.bpm[1]) ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenFilterDropdown(openFilterDropdown === 'bpm' ? null : 'bpm');
                                    }}
                                >
                                    {text.bpm}
                                </button>
                                {(!isMobile && openFilterDropdown === 'bpm') && renderFilterPopover('bpm')}
                            </div>

                            {/* Date Filter */}
                            <div className="filter-popover-container">
                                <button
                                    className={`filter-group-btn ${openFilterDropdown === 'date' || (filterDate[0] > globalRanges.date[0] || filterDate[1] < globalRanges.date[1]) ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenFilterDropdown(openFilterDropdown === 'date' ? null : 'date');
                                    }}
                                >
                                    {text.date}
                                </button>
                                {(!isMobile && openFilterDropdown === 'date') && renderFilterPopover('date')}
                            </div>


                            {/* Combined Note Count Filter */}
                            <div className="filter-popover-container">
                                <button className={`filter-group-btn ${openFilterDropdown === 'noteCount' ||
                                    (filterExNote[0] > globalRanges.exNote[0] || filterExNote[1] < globalRanges.exNote[1]) ||
                                    (filterMaNote[0] > globalRanges.maNote[0] || filterMaNote[1] < globalRanges.maNote[1]) ||
                                    (filterApNote[0] > globalRanges.apNote[0] || filterApNote[1] < globalRanges.apNote[1])
                                    ? 'active' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(openFilterDropdown === 'noteCount' ? null : 'noteCount'); }}>
                                    {text.noteCount}
                                </button>
                                {(!isMobile && openFilterDropdown === 'noteCount') && renderFilterPopover('noteCount')}
                            </div>

                            {/* MV Member Filter */}
                            <div className="filter-popover-container">
                                <button className={`filter-group-btn ${openFilterDropdown === 'mvMember' || filterMvMember.length > 0 ? 'active' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(openFilterDropdown === 'mvMember' ? null : 'mvMember'); }}>
                                    {text.mvMember}
                                </button>
                                {(!isMobile && openFilterDropdown === 'mvMember') && renderFilterPopover('mvMember')}
                            </div>

                        </div>
                        {isMobile && openFilterDropdown && (
                            <div className="mobile-popover-wrapper">
                                {renderFilterPopover(openFilterDropdown)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="chart-container" style={{ position: 'relative' }}>
                    {/* Active Filter Chips */}
                    {activeChips.length > 0 && (
                        <div className="chart-filter-chips">
                            {activeChips.map((chip, i) => (
                                <div key={i} className="filter-chip" onClick={chip.onRemove}>
                                    {chip.label}
                                    <span className="chip-remove">✕</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Render Timeline Graph if active */}
                    {activeTab === 'other' && xAxisOther === 'month' ? (
                        timelineData.length === 0 ? (
                            <div className="no-data">{text.noData}</div>
                        ) : (
                            <div className="line-chart-wrapper" style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }} onClick={() => setSelectedPoint(null)}>
                                <svg width="100%" height="250" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                                    {(() => {
                                        // Calculate Points
                                        const yMax = maxVal > 0 ? maxVal * 1.2 : 10;

                                        const points = timelineData.map((d, i) => {
                                            const x = (i / (timelineData.length - 1)) * 100;
                                            const y = 100 - (d.total / yMax * 100);
                                            return { x, y, ...d };
                                        });

                                        const pathD = points.map((p, i) =>
                                            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                                        ).join(' ');

                                        return (
                                            <>
                                                {/* Line Path */}
                                                <path
                                                    d={pathD}
                                                    fill="none"
                                                    stroke="var(--accent-color)"
                                                    strokeWidth="0.5" // Thinner stroke relative to 100x100 coord system locally? No, vector-effect handles it.
                                                    vectorEffect="non-scaling-stroke"
                                                    style={{ strokeWidth: '2px' }}
                                                />

                                                {/* Interaction Points */}
                                                {points.map((p, i) => (
                                                    <circle
                                                        key={i}
                                                        cx={p.x}
                                                        cy={p.y}
                                                        r="0" // Invisible by default or small?
                                                    // Let's make them small visible dots
                                                    // Note: r is in user units (0-100). If aspect ratio is skewed, dots will be ovals without vector-effect.
                                                    // Better to use vector-effect or just use CSS to style dots if possible? 
                                                    // Actually, standard SVG circles with non-scaling-stroke might work, or just small r value.
                                                    // If viewBox is 100x100 but displayed at 800x300, 1 unit X is 8px, 1 unit Y is 3px.
                                                    // Dots will be distorted.
                                                    // FIX: Use nested SVG or just rely on the hover target being invisible overlay? 
                                                    // Or easier: Just use the previous percentage based approach for circles but overlay them on top of the viewBox SVG?
                                                    // No, I can mix.
                                                    // Let's use 'vector-effect: non-scaling-stroke' for the line. 
                                                    // For circles, we can't easily avoid distortion with preserveAspectRatio="none".
                                                    // Use a separate overlay for dots using percentages? Yes.
                                                    />
                                                ))}
                                                {/* Re-rendering circles in a separate overlay div is cleaner for interaction and aspect ratio */}
                                            </>
                                        );
                                    })()}
                                </svg>
                                {/* Overlay for Dots (Percentage based to maintain aspect ratio of dots) */}
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '250px', pointerEvents: 'none' }}>
                                    {(() => {
                                        const yMax = maxVal > 0 ? maxVal * 1.2 : 10;
                                        return timelineData.map((d, i) => {
                                            const x = (i / (timelineData.length - 1)) * 100;
                                            const y = 100 - (d.total / yMax * 100);
                                            return (
                                                <div
                                                    key={i}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${x}%`,
                                                        top: `${y}%`,
                                                        width: '5px',
                                                        height: '5px',
                                                        borderRadius: '50%',
                                                        backgroundColor: 'var(--accent-color)',
                                                        // border: '2px solid var(--accent-color)',
                                                        transform: 'translate(-50%, -50%)',
                                                        cursor: 'pointer',
                                                        pointerEvents: 'auto',
                                                        transition: 'transform 0.2s',
                                                        zIndex: 2
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.transform = 'translate(-50%, -50%) scale(1.5)'}
                                                    onMouseLeave={(e) => {
                                                        if (selectedPoint?.label !== d.label) e.target.style.transform = 'translate(-50%, -50%) scale(1)';
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedPoint(selectedPoint?.label === d.label ? null : { ...d, x, y, total: d.total });
                                                    }}
                                                />
                                            );
                                        });
                                    })()}
                                </div>

                                {/* X-Axis Labels */}
                                <div className="line-chart-xaxis" style={{ position: 'relative', width: '100%', height: '30px', marginTop: '10px' }}>
                                    {timelineData.map((d, i) => {
                                        // Logic: Show N-th Anniversary
                                        // Base: 2020-10 = 0.
                                        // Check Month 10 (Oct) and Month 4 (Apr).
                                        if (d.month !== 10 && d.month !== 4) return null;

                                        const leftPos = (i / (timelineData.length - 1)) * 100;
                                        let labelText = '';

                                        // Calculate diff in years from 2020
                                        let diff = d.year - 2020;
                                        if (d.month === 4) {
                                            // Apr is X.5 years.
                                            // e.g. Apr 2021. 2021-2020=1. Should be 0.5. So 1 - 0.5.
                                            diff -= 0.5;
                                        }

                                        // 2020-04 would be -0.5, avoid? Data starts Sept 2020.
                                        if (diff < 0) return null;

                                        labelText = `${diff}`;

                                        return (
                                            <span
                                                key={i}
                                                className="chart-axis-label year-label"
                                                style={{
                                                    position: 'absolute',
                                                    left: `${leftPos}%`,
                                                    transform: 'translateX(-50%)',
                                                    whiteSpace: 'nowrap',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold',
                                                    color: '#555'
                                                }}
                                            >
                                                {labelText}
                                            </span>
                                        );
                                    })}
                                </div>

                                {/* Tooltip Overlay */}
                                {selectedPoint && (
                                    <div
                                        className="chart-tooltip"
                                        style={{
                                            position: 'absolute',
                                            left: `${selectedPoint.x}%`,
                                            top: `10%`,
                                            transform: 'translateX(-50%)',
                                            backgroundColor: 'rgba(255,255,255,0.95)',
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            pointerEvents: 'none',
                                            whiteSpace: 'nowrap',
                                            zIndex: 10,
                                            border: '1px solid rgba(0,0,0,0.1)',
                                            color: '#333',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                        }}
                                    >
                                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{selectedPoint.label}</div>
                                        <div style={{ fontSize: '0.9rem' }}>{selectedPoint.total} 곡</div>
                                    </div>
                                )}
                            </div>
                        )
                    ) : (
                        chartData.length === 0 ? (
                            <div className="no-data">{text.noData}</div>
                        ) : (
                            <div className="bar-chart">
                                {chartData.map((d, i) => {
                                    // Determine Bar Color(s)
                                    let barContent = null;

                                    // If Level (Standard or Append): Stacked bars logic (though append is single)
                                    if (activeTab === 'level' || activeTab === 'append') {
                                        // Ensure sorting by difficulty order for consistent stacking
                                        const diffsPresent = Object.keys(d.breakdown).sort((a, b) => {
                                            return DIFFICULTIES.indexOf(a) - DIFFICULTIES.indexOf(b);
                                        });

                                        barContent = diffsPresent.map(diff => {
                                            const count = d.breakdown[diff];
                                            const bg = DIFF_COLORS[diff];
                                            return (
                                                <div
                                                    key={diff}
                                                    style={{
                                                        flex: count,
                                                        background: bg, // Use background shorthand for gradient support
                                                        width: '100%'
                                                    }}
                                                    title={`${diff}: ${count}`}
                                                />
                                            );
                                        });
                                    } else {
                                        // Standard colored bar for 'Other' tab
                                        let barColor = `hsl(${(i * 45) % 360}, 70%, 60%)`;
                                        if (xAxisOther === 'unit') {
                                            const code = getUnitCodeFromName(d.label);
                                            barColor = UNIT_COLORS[code] || barColor;
                                        }
                                        barContent = (
                                            <div style={{ flex: 1, backgroundColor: barColor, width: '100%' }} />
                                        );
                                    }

                                    // Cap height at 85% to leave room for labels (VS allowed to go +10% higher relative to others)
                                    let heightCap = 85;
                                    if (activeTab === 'other' && xAxisOther === 'unit') {
                                        const vsName = getUnitName("VS");
                                        if (d.label === vsName) heightCap = 85 * 1.2; // +20%
                                    }
                                    const heightPercent = maxVal > 0 ? Math.min((d.total / maxVal) * 85, heightCap) : 0;

                                    return (
                                        <div key={d.label} className="bar-group">
                                            <div
                                                className="bar"
                                                style={{
                                                    height: `${heightPercent}%`,
                                                    display: 'flex',
                                                    flexDirection: 'column-reverse', // Stack from bottom
                                                    backgroundColor: 'transparent'
                                                }}
                                                title={`${d.label}: ${d.total}`}
                                            >
                                                {barContent}
                                                <span className="bar-value">{d.total}</span>
                                            </div>
                                            <span className="bar-label">{d.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
};


export default GraphModal;
