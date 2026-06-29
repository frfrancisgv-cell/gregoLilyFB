import React, { useState, useMemo, useEffect } from 'react';
import { Download, FileCode, CheckCircle2, Copy, Eye, Image as ImageIcon, Music } from 'lucide-react';
import { useJgabc } from './hooks/useJgabc';
import { convertGabcToLilypond, ConvertOptions } from './lib/gabcToLilypond';
import JSZip from 'jszip';
import { ExsurgePreview } from './components/ExsurgePreview';
import { LilyPondPreview } from './components/LilyPondPreview';
import { liturgicalData, getUpcomingCelebrations, getCelebrationDatesMap, getLiturgicalCycle, extractPsalmKey, type ProperEntry } from './lib/liturgicalData';


const psalmModules = import.meta.glob('./lib/jgabc/psalms/*.txt', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const psalmKeys = Object.keys(psalmModules)
  .map(path => {
    const filename = path.split('/').pop()?.replace('.txt', '') || '';
    return filename;
  })
  .sort((a, b) => {
    // sort numbers first, then letters
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return a.localeCompare(b);
  });
(window as any).__psalmKeys = psalmKeys;

function cleanPolyGabcForGregorio(gabc: string): string {
  if (!gabc) return "";
  // Replace bracketed SATB groups with just the Soprano voice (the first bracket)
  // and strip the trailing bass note/accents that follow the brackets.
  return gabc.replace(/\{([^}]+)\}(?:\{[^}]+\})*[a-zA-Z0-9\._<>\.#xy!r]*/g, "$1");
}

// GABC letter → diatonic pitch index (same anchor as gabcToLilypond.ts)
// diatonicPitches[28] = "c'" (middle C)
const diatonicPitches = [
  "c,,","d,,","e,,","f,,","g,,","a,,","b,,",
  "c,","d,","e,","f,","g,","a,","b,",
  "c","d","e","f","g","a","b",
  "c'","d'","e'","f'","g'","a'","b'",
  "c''","d''","e''","f''","g''","a''","b''"
];

function gabcFirstNoteName(gabc: string): string | null {
  // Extract clef
  const clefMatch = gabc.match(/\(([cf][1-4]b?)\)/i);
  const clef = clefMatch ? clefMatch[1].toLowerCase() : 'c4';
  const clefType = clef[0];
  const clefLine = parseInt(clef[1]) || 4;
  const anchorPos = (clefLine * 2) + 1;
  const anchorPitchIndex = clefType === 'c' ? 28 : 24; // c' or a (treble)
  // Find first pitched note (letters a-m, not clef-related)
  const noteMatch = gabc.match(/\(([^)]+)\)/);
  if (!noteMatch) return null;
  // Find letters a-m in the notation, skipping clef tokens
  const tokens = gabc.replace(/\([^)]+\)/g, (m) => {
    // Keep non-clef notation, strip clef
    if (/^[cf][1-4]b?$/.test(m.slice(1, -1).trim())) return ' ';
    return m;
  });
  const firstNote = tokens.match(/\(([^)]+)\)/);
  if (!firstNote) return null;
  const notationStr = firstNote[1].trim();
  const chars = notationStr.replace(/[^a-m]/gi, '');
  if (!chars) return null;
  const ch = chars[0].toLowerCase();
  const pos = ch.charCodeAt(0) - 97; // 'a'=0
  const pitchIdx = anchorPitchIndex + (pos - anchorPos);
  if (pitchIdx < 0 || pitchIdx >= diatonicPitches.length) return null;
  // Return just the letter name (C, D, E, F, G, A, B)
  return diatonicPitches[pitchIdx].replace(/[,']/g, '').toUpperCase();
}

// Map gregobase mode number + optional first note to a jgabc tone string
function modeToTone(mode: string, firstNote?: string | null, availableTones?: string[]): string {
  const m = mode.trim();
  // If we have available tones from jgabc and a first note, try to match
  if (availableTones && firstNote) {
    // jgabc tone variant letter matches the first note
    const candidates = availableTones.filter(t => t.startsWith(m + '.'));
    const noteMatch = candidates.find(t => {
      const variant = t.slice(m.length + 1).toUpperCase();
      return variant === firstNote || variant.startsWith(firstNote);
    });
    if (noteMatch) return noteMatch;
    if (candidates.length > 0) return candidates[0];
  }
  // Default fallback map
  const defaults: Record<string, string> = {
    '1': '1.D', '2': '2.D', '3': '3.a', '4': '4.E',
    '5': '5.a', '6': '6.F', '7': '7.a', '8': '8.G',
    'g': '1.D', 'd': '2.D', 'e': '3.a', 'E': '4.E',
    'f': '6.F', 'G': '8.G',
  };
  return defaults[m] || '1.D';
}

export default function App() {
  const jgabcLoaded = useJgabc();
  const [psalmText, setPsalmText] = useState("Dixit Dóminus Dómino meo: * Sede a dextris meis:\nDonec ponam inimícos tuos, * scabéllum pedum tuórum.");
  const [psalmTone, setPsalmTone] = useState("1.D");
  const [docTitle, setDocTitle] = useState("Psalm 109");
  const [docSubtitle, setDocSubtitle] = useState("Psalm Tone: 1.D");
  const [polyphonyGabc, setPolyphonyGabc] = useState("f gh {m<}{K}{d>}hr {m<}{J}{f>}h '{m</l<}{J.}{c.>}g. {m<}{J}{f>}hr {m.<}{J.}{f.>}h.\n{m<}{J}{f>}hr {l<}{J}{c>}g {k<}{H}{d>}f 'ix{k<}{I}{0>}g {k<}{I}{0>}gr {k<k</j</k<}{I/I/H/H}{0>/a>/a/>d>}gv/f/e/d.");
  const [chantGabc, setChantGabc] = useState("");
  const [polyPreviewFormat, setPolyPreviewFormat] = useState<'lilypond' | 'gregorio'>('lilypond');
  
  const [polyTones, setPolyTones] = useState<{name: string, gabc: string}[]>([]);
  const [selectedPolyToneName, setSelectedPolyToneName] = useState("Mode 1 4pt");

  // --- Proper Antiphon state ---
  const today = new Date();
  const currentCycle = getLiturgicalCycle(today);
  const upcomingDays = useMemo(() => getUpcomingCelebrations(today), []);
  const celebrationDatesMap = useMemo(() => getCelebrationDatesMap(today), []);
  const [selectedLiturgy, setSelectedLiturgy] = useState<string>('');
  const [selectedProper, setSelectedProper] = useState<ProperEntry | null>(null);
  const [antiphonGabc, setAntiphonGabc] = useState<string>('');
  const [antiphonLoading, setAntiphonLoading] = useState(false);
  const [antiphonGregobaseId, setAntiphonGregobaseId] = useState<number | null>(null);
  const [antiphonError, setAntiphonError] = useState<string>('');
  const [antiphonCandidates, setAntiphonCandidates] = useState<any[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [antiphonMode, setAntiphonMode] = useState<number | null>(null);
  const [antiphonModeVar, setAntiphonModeVar] = useState<string | null>(null);
  const [antiphonSelectMode, setAntiphonSelectMode] = useState<'liturgical' | 'search'>('liturgical');
  const [searchIncipit, setSearchIncipit] = useState('');
  const [searchType, setSearchType] = useState('Communion');

  // --- Verse alternation settings ---
  const [chantVersesPerCycle, setChantVersesPerCycle] = useState(1);
  const [polyVersesPerCycle, setPolyVersesPerCycle] = useState(1);

  // --- LilyPond staff size ---
  const [lilyStaffSize, setLilyStaffSize] = useState(14);
  const [gregorioStaffSize, setGregorioStaffSize] = useState(17);

  const fetchPolyTones = async () => {
    try {
      const res = await fetch("/api/polyphonic-tones");
      if (res.ok) {
        const data = await res.json();
        setPolyTones(data);
      }
    } catch (e) {
      console.error("Failed to fetch polyphonic tones:", e);
    }
  };

  useEffect(() => {
    fetchPolyTones();
  }, []);
  
  const [includeGloriaPatri, setIncludeGloriaPatri] = useState(true);
  const [pdfTotalVerses, setPdfTotalVerses] = useState(3);

  const [options, setOptions] = useState<ConvertOptions>({
    compressReciting: true,
    compressStrophic: true,
    forceBreak: true,
    showBarlines: true,
    hideStems: false,
    transposeVal: 'c c'
  });
  
  const [lualatexOutput, setLualatexOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [pdfBase64, setPdfBase64] = useState("");
  const [activeOutputTab, setActiveOutputTab] = useState<'pdf' | 'source'>('pdf');

  const availableTones = useMemo(() => {
    if (!jgabcLoaded || !(window as any).g_tones) return [];
    const tones: string[] = [];
    const g_tones = (window as any).g_tones;
    for (const prefix of Object.keys(g_tones)) {
      const td = g_tones[prefix];
      if (td.terminations) {
        for (const ending of Object.keys(td.terminations)) {
          tones.push(`${prefix}${ending}`);
        }
      } else {
        tones.push(prefix);
      }
    }
    return tones;
  }, [jgabcLoaded]);

  const preview = useMemo(() => {
    if (!jgabcLoaded || !window.applyPsalmTone) return { gabc: '', lilypond: '' };
    const verses = psalmText.split('\n').filter(line => line.trim().length > 0);
    if (verses.length === 0) return { gabc: '', lilypond: '' };
    
    // Setup for tone mapping
    let medGabc = "";
    let termGabc = "";
    let clef = 'c4';

    let cleanChantGabc = chantGabc;
    const clefMatch = chantGabc.match(/^\s*\(([a-f][1-4]b?)\)/i);
    if (clefMatch) {
        clef = clefMatch[1].toLowerCase();
        cleanChantGabc = chantGabc.replace(/^\s*\(([a-f][1-4]b?)\)/i, '');
    }
    const chantParts = cleanChantGabc.trim().split('\n').filter(p => p.trim());
    medGabc = chantParts[0] || "";
    termGabc = chantParts[1] || medGabc;

    // Preview Verse 1 (Chant)
    const verse1 = verses[0];
    let toneAnnotation = psalmTone;
    if (psalmTone.includes('.')) {
        toneAnnotation = psalmTone.replace('.', ' ');
    }
    let gabcPreview = `annotation: ${toneAnnotation};\n%%\n(${clef}) `;
    try {
        const parts = verse1.split('*');
        if (parts.length > 0) {
            const medResult = window.applyPsalmTone({ 
                text: parts[0].trim(), 
                gabc: medGabc || psalmTone, 
                useBoldItalic: true,
                firstPrefix: false
            });
            gabcPreview += (typeof medResult === 'string' ? medResult : (medResult.gabc || String(medResult)));
        }
        if (parts.length > 1) {
            gabcPreview += " *(:) ";
            const termResult = window.applyPsalmTone({ 
                text: parts[1].trim(), 
                gabc: termGabc || psalmTone, 
                useBoldItalic: true,
                firstPrefix: false
            });
            gabcPreview += (typeof termResult === 'string' ? termResult : (termResult.gabc || String(termResult)));
        }
        gabcPreview += " (::)";
    } catch (e) {
        console.error("Verse 1 error:", e);
        gabcPreview = "(c4)"; 
    }

    // Preview Polyphony (using Verse 2 if available, otherwise Verse 1)
    const polyVerse = verses.length > 1 ? verses[1] : verses[0];
    let polyPreview = "";
    // Extract clef from polyphony GABC itself; if absent, inherit from chant
    const polyClefMatch = polyphonyGabc.match(/^\s*\(([cf][1-4]b?)\)/i);
    const polyClef = polyClefMatch ? polyClefMatch[1].toLowerCase() : clef;
    try {
        const polyParts = polyphonyGabc.trim().split('\n').filter(p => p.trim());
        const textParts = polyVerse.split('*');

        if (textParts.length > 0 && polyParts.length > 0) {
            let polyInput: any = polyParts[0].trim();
            // Strip leading clef from polyInput so jgabc doesn't choke on it
            polyInput = polyInput.replace(/^\s*\([cf][1-4]b?\)\s*/i, '');
            if ((window as any).getGabcTones && (window as any).removeIntonation) {
                try {
                    let toneList = (window as any).getGabcTones(polyInput);
                    if (toneList && typeof toneList === 'object') {
                        toneList = (window as any).removeIntonation(toneList);
                        polyInput = toneList;
                    }
                } catch(e) {}
            }
            const medPoly = window.applyPsalmTone({
                text: textParts[0].trim(),
                gabc: polyInput,
                useBoldItalic: false,
                firstPrefix: false
            });
            polyPreview += typeof medPoly === 'string' ? medPoly : (medPoly.gabc || String(medPoly));
        }

        if (textParts.length > 1 && polyParts.length > 1) {
            polyPreview += " *(:) ";
            const termPoly = window.applyPsalmTone({
                text: textParts[1].trim(),
                gabc: (polyParts.length > 1 ? polyParts.slice(1).join('\n') : polyParts[0]).trim(),
                useBoldItalic: false,
                firstPrefix: false
            });
            polyPreview += typeof termPoly === 'string' ? termPoly : (termPoly.gabc || String(termPoly));
        } else if (textParts.length > 1 && polyParts.length === 1) {
            polyPreview += " *(:) ";
            let polyInputTerm: any = polyParts[0].trim();
            if ((window as any).getGabcTones && (window as any).removeIntonation) {
                try {
                    let toneList = (window as any).getGabcTones(polyInputTerm);
                    if (toneList && typeof toneList === 'object') {
                        toneList = (window as any).removeIntonation(toneList);
                        polyInputTerm = toneList;
                    }
                } catch(e) {}
            }
            const termPoly = window.applyPsalmTone({
                text: textParts[1].trim(),
                gabc: polyInputTerm,
                useBoldItalic: false,
                firstPrefix: false
            });
            polyPreview += typeof termPoly === 'string' ? termPoly : (termPoly.gabc || String(termPoly));
        }
    } catch (e) {
        console.error("Verse 2 error:", e);
        polyPreview = ""; 
    }

    const hasClef = /^\s*\(([cf][1-4])\)/i.test(polyPreview);
    const lilypondPreview = convertGabcToLilypond(hasClef ? polyPreview : `(${polyClef}) ${polyPreview}`, { ...options, forceBreak: false });
    return { gabc: gabcPreview, polyGabc: hasClef ? polyPreview : `(${polyClef}) ${polyPreview}`, lilypond: lilypondPreview };
  }, [psalmText, psalmTone, chantGabc, polyphonyGabc, options, jgabcLoaded]);



  useEffect(() => {
    if (!jgabcLoaded) return;
    const g_tones = (window as any).g_tones;
    if (g_tones) {
        let toneStr = psalmTone.trim();
        let toneKey = Object.keys(g_tones).find(k => toneStr.startsWith(k)) || "";
        const toneData = g_tones[toneKey];
        if (toneData) {
            let clef = toneData.clef || 'c4';
            let ending = toneStr.substring(toneKey.length).trim();
            let med = toneData.mediant || "";
            let term = "";
            if (ending && toneData.terminations && toneData.terminations[ending]) {
                term = toneData.terminations[ending];
            } else if (toneData.termination) {
                term = toneData.termination;
            } else if (toneData.mediant) {
                term = toneData.mediant;
            }
            setChantGabc(`(${clef}) ${med}\n${term}`);
        }
    }
  }, [psalmTone, jgabcLoaded]);

  useEffect(() => {
    // Only auto-update subtitle when no proper is selected
    if (!selectedProper && (!docSubtitle || docSubtitle.startsWith("Psalm Tone:"))) {
      setDocSubtitle(`Psalm Tone: ${psalmTone}`);
    }
  }, [psalmTone, selectedProper]);

  useEffect(() => {
    if (!psalmTone || polyTones.length === 0) return;
    const match = psalmTone.match(/^([1-8])/);
    if (match) {
      const modeNum = match[1];
      const targetModeName = `Mode ${modeNum}`;
      const found = polyTones.find(t => t.name.toLowerCase() === targetModeName.toLowerCase() || t.name.toLowerCase().startsWith(targetModeName.toLowerCase()));
      if (found) {
        setSelectedPolyToneName(found.name);
        setPolyphonyGabc(found.gabc);
      }
    }
  }, [psalmTone, polyTones]);

  // --- Load proper antiphon from GregoBase ---
  const applyChantData = async (data: any, proper: ProperEntry) => {
    let finalGabc = data.gabc || '';

    // Derive psalm tone and variant (fallback to first note if missing)
    let tone = "1.D";
    let variant = (data.modeVar && data.modeVar !== 'NULL' && data.modeVar !== '') ? data.modeVar : '';
    if (data.mode) {
      if (variant) {
        const targetTone = `${data.mode}.${variant}`.toLowerCase();
        const matchedTone = availableTones.find(t => t.toLowerCase() === targetTone);
        if (matchedTone) {
          tone = matchedTone;
          if (matchedTone.includes('.')) {
            variant = matchedTone.split('.')[1];
          }
        } else {
          tone = `${data.mode}.${variant}`;
        }
      } else {
        const firstNote = gabcFirstNoteName(finalGabc);
        const derivedTone = modeToTone(data.mode, firstNote, availableTones);
        tone = derivedTone;
        if (derivedTone.includes('.')) {
          variant = derivedTone.split('.')[1];
        }
      }
      setPsalmTone(tone);

      // Build the annotation (e.g. "8 G") and prepend it to GABC if not already present
      let annotation = data.mode;
      if (variant) {
        annotation += ` ${variant}`;
      }
      const annotationHeader = `annotation: ${annotation};`;
      if (finalGabc && !finalGabc.includes(annotationHeader)) {
        if (finalGabc.includes('%%')) {
          finalGabc = `${annotationHeader}\n` + finalGabc;
        } else {
          finalGabc = `${annotationHeader}\n%%\n` + finalGabc;
        }
      }
    }

    setAntiphonGabc(finalGabc);
    setAntiphonGregobaseId(data.id || null);
    setAntiphonMode(data.mode ? parseInt(data.mode, 10) : null);
    setAntiphonModeVar(variant || null);

    // Auto-load the appointed psalm
    const psalmKey = extractPsalmKey(proper.verses);
    if (psalmKey) {
      const path = `./lib/jgabc/psalms/${psalmKey}.txt`;
      if (psalmModules[path]) {
        try {
          const rawText = await psalmModules[path]();
          const text = typeof rawText === 'string' ? rawText : (rawText as any)?.default || String(rawText);
          let cleaned = text
            .split('\n')
            .filter((l: string) => !l.startsWith('v.') && !l.startsWith('ps.') && l.trim().length > 0)
            .map((l: string) => l.replace(/^\d+\.\s*/, '').replace(/<[^>]+>/g, '').trim())
            .join('\n');
          if (includeGloriaPatri) {
            cleaned += '\nGlória Patri, et Fílio, * et Spirítui Sancto.\nSicut erat in princípio, et nunc, et semper, * et in sǽcula sæculórum. Amen.';
          }
          setPsalmText(cleaned);
          // Set doc title from proper
          const psalmNum = parseInt(psalmKey, 10);
          const psalmLabel = isNaN(psalmNum) ? psalmKey : `Psalm ${psalmNum}`;
          setDocTitle(`${proper.day} — ${proper.type}`);
          setDocSubtitle(`${proper.incipit}, ${psalmLabel}, Tone ${tone}`);
        } catch (err) {
          console.error('Failed to load psalm', err);
        }
      }
    }
  };

  // --- Load proper antiphon from GregoBase ---
  const loadProper = async (proper: ProperEntry) => {
    setSelectedProper(proper);
    setAntiphonGabc('');
    setAntiphonMode(null);
    setAntiphonModeVar(null);
    setAntiphonError('');
    setAntiphonLoading(true);
    setAntiphonCandidates([]);
    setSelectedCandidateId(null);
    try {
      const params = new URLSearchParams({ incipit: proper.incipit, type: proper.type });
      const res = await fetch(`/api/gregobase-chant?${params}`);
      if (!res.ok) {
        setAntiphonError(`Not found in GregoBase: ${proper.incipit}`);
        setAntiphonGabc('');
        setAntiphonMode(null);
        setAntiphonModeVar(null);
        setAntiphonGregobaseId(null);
      } else {
        const data = await res.json();
        if (data.match) {
          await applyChantData(data.match, proper);
          setAntiphonCandidates(data.candidates || []);
          setSelectedCandidateId(data.match.id);
        }
      }
    } catch (err: any) {
      setAntiphonError(err.message || 'Failed to load antiphon');
    } finally {
      setAntiphonLoading(false);
    }
  };

  const loadCandidateChant = async (candidateId: number, proper: ProperEntry) => {
    setAntiphonLoading(true);
    setAntiphonError('');
    try {
      const res = await fetch(`/api/gregobase-chant?id=${candidateId}`);
      if (!res.ok) {
        setAntiphonError(`Failed to load chant version ID: ${candidateId}`);
      } else {
        const data = await res.json();
        if (data.match) {
          await applyChantData(data.match, proper);
          setSelectedCandidateId(candidateId);
        }
      }
    } catch (err: any) {
      setAntiphonError(err.message || 'Failed to load version');
    } finally {
      setAntiphonLoading(false);
    }
  };

  const searchByIncipit = async (targetIncipit: string, targetType: string) => {
    if (!targetIncipit.trim()) return;
    setAntiphonLoading(true);
    setAntiphonError('');
    setAntiphonCandidates([]);
    setSelectedCandidateId(null);
    setAntiphonMode(null);
    setAntiphonModeVar(null);
    setSelectedProper(null);
    try {
      const params = new URLSearchParams({ incipit: targetIncipit.trim(), type: targetType });
      const res = await fetch(`/api/gregobase-chant?${params}`);
      if (!res.ok) {
        setAntiphonError(`Not found in GregoBase: ${targetIncipit}`);
        setAntiphonGabc('');
        setAntiphonMode(null);
        setAntiphonModeVar(null);
        setAntiphonGregobaseId(null);
      } else {
        const data = await res.json();
        if (data.match) {
          const mockProper: ProperEntry = {
            id: -1,
            season: 'Search',
            day: 'Ad-hoc Search',
            type: targetType as any,
            incipit: data.match.incipit,
            translation: '',
            source: '',
            verses: 'Ps 1', // default placeholder
            cycle: 'All'
          };
          setSelectedProper(mockProper);
          await applyChantData(data.match, mockProper);
          setAntiphonCandidates(data.candidates || []);
          setSelectedCandidateId(data.match.id);
        } else {
          setAntiphonError(`No match found for: ${targetIncipit}`);
        }
      }
    } catch (err: any) {
      setAntiphonError(err.message || 'Failed to load chant');
    } finally {
      setAntiphonLoading(false);
    }
  };

  const generateOutput = async () => {
    if (!window.applyPsalmTone) {
      alert("jgabc library is still loading or failed to load. Please try again in a few seconds.");
      return;
    }

    try {
      const allLines = psalmText.split('\n').filter(line => line.trim().length > 0);
      let psalmVerses = [...allLines];
      let doxologyLines: string[] = [];
      
      const hasGloria = allLines.some(l => l.toLowerCase().includes('gloria patri') || l.toLowerCase().includes('glória patri'));
      if (hasGloria) {
        const gloriaIdx = allLines.findIndex(l => l.toLowerCase().includes('gloria patri') || l.toLowerCase().includes('glória patri'));
        if (gloriaIdx !== -1) {
          psalmVerses = allLines.slice(0, gloriaIdx);
          if (includeGloriaPatri) {
            doxologyLines = allLines.slice(gloriaIdx);
          }
        }
      } else if (includeGloriaPatri) {
        doxologyLines = [
          'Glória Patri, et Fílio, * et Spirítui Sancto.',
          'Sicut erat in princípio, et nunc, et semper, * et in sǽcula sæculórum. Amen.'
        ];
      }

      const numPsalmVerses = Math.max(0, pdfTotalVerses - 1);
      const selectedPsalmVerses = psalmVerses.slice(0, numPsalmVerses);
      const verses = [...selectedPsalmVerses, ...doxologyLines];

      // Compute effective title/subtitle
      let effectiveTitle = docTitle || 'Psalm';
      let effectiveSubtitle = docSubtitle || `Psalm Tone: ${psalmTone}`;
      if (selectedProper) {
        const psalmKey = extractPsalmKey(selectedProper.verses);
        const psalmNum = psalmKey ? parseInt(psalmKey, 10) : NaN;
        const psalmLabel = psalmKey ? (isNaN(psalmNum) ? psalmKey : `Psalm ${psalmNum}`) : selectedProper.verses;
        effectiveTitle = `${selectedProper.day} — ${selectedProper.type}`;
        effectiveSubtitle = `${selectedProper.incipit}, ${psalmLabel}, Tone ${psalmTone}`;
      }
      
      let latexString = `% =========================================================================
% IMPORTANT: You MUST compile this file with the --shell-escape flag!
%
% Command: lualatex --shell-escape <your-filename>.tex
% 
% This is required because gregoriotex and lyluatex need to run external 
% programs (gregorio and lilypond) during the compilation process.
% =========================================================================

\\documentclass[12pt]{article}
\\usepackage{gregoriotex}
\\usepackage{lyluatex}
\\usepackage[margin=1in]{geometry}

\\grechangestaffsize{${gregorioStaffSize}}

% Color the mediant star red
\\let\\oldgreheightstar\\greheightstar
\\renewcommand{\\greheightstar}{\\textcolor{gregoriocolor}{\\oldgreheightstar}}

\\begin{document}

\\begin{center}
  \\textbf{\\Large ${effectiveTitle}}\\\\[1ex]
  \\textit{\\large ${effectiveSubtitle}}
\\end{center}

`;

      // Include antiphon GABC before psalm verses if one is selected
      if (antiphonGabc) {
        const cleanAntiphon = antiphonGabc.replace(/<\/?(?:b|i|v|sp)[^>]*>/g, '');
        latexString += `% Antiphon\n\\begin{gabccode}\n${cleanAntiphon}\n\\end{gabccode}\n\n`;
      }

      // Verse alternation: determine which verses are chant vs. polyphony
      // Cycle: [chantVersesPerCycle chant verses] then [polyVersesPerCycle poly verses] repeating
      const cycleLen = chantVersesPerCycle + polyVersesPerCycle;

      verses.forEach((verseText, index) => {
        const posInCycle = cycleLen > 0 ? index % cycleLen : 0;
        const isChant = polyVersesPerCycle === 0 || (chantVersesPerCycle > 0 && posInCycle < chantVersesPerCycle);
        
        let clef = 'c4';
        let cleanChantGabc = chantGabc;
        const clefMatch = chantGabc.match(/^\s*\(([a-f][1-4]b?)\)/i);
        if (clefMatch) {
            clef = clefMatch[1].toLowerCase();
            cleanChantGabc = chantGabc.replace(/^\s*\(([a-f][1-4]b?)\)/i, '');
        }

        let gabcRaw = "";
        try {
            let medGabc = "";
            let termGabc = "";
            const chantParts = cleanChantGabc.trim().split('\n').filter(p => p.trim());
            medGabc = chantParts[0] || "";
            termGabc = chantParts[1] || medGabc;

            gabcRaw = `(${clef}) `;

            const parts = verseText.split('*');
            if (parts.length > 0) {
                let medInput: any = medGabc || psalmTone;
                if (index > 0 && (window as any).getGabcTones && (window as any).removeIntonation) {
                    try {
                        let toneList = (window as any).getGabcTones(medInput);
                        if (toneList && typeof toneList === 'object') {
                            toneList = (window as any).removeIntonation(toneList);
                            medInput = toneList;
                        }
                    } catch(e) {}
                }
                const medResult = (window as any).applyPsalmTone({ 
                    text: parts[0].trim(), 
                    gabc: medInput, 
                    useBoldItalic: true,
                    firstPrefix: false
                });
                gabcRaw += (typeof medResult === 'string' ? medResult : (medResult.gabc || String(medResult)));
            }

            if (parts.length > 1) {
                const gabcStar = '<v>\\greheightstar</v>';
                gabcRaw += ` ${gabcStar}(:) `;
                const termResult = (window as any).applyPsalmTone({ 
                    text: parts[1].trim(), 
                    gabc: termGabc || psalmTone, 
                    useBoldItalic: true,
                    firstPrefix: false
                });
                gabcRaw += (typeof termResult === 'string' ? termResult : (termResult.gabc || String(termResult)));
            }

            gabcRaw += " (::)";
            
        } catch (err: any) {
            console.error("applyPsalmTone failed:", err);
            gabcRaw = `(c4) ${verseText} (::)`;
        }

        if (isChant) {
          // Chant verse (Gregorio)
          latexString += `% Verse ${index + 1} (Chant)\n\\begin{gabccode}\n${gabcRaw}\n\\end{gabccode}\n\n`;
        } else {
          // Falsobordone Polyphony verse (LilyPond)
          let polyGabcRaw = "";
          const polyClefMatchGen = polyphonyGabc.match(/^\s*\(([cf][1-4]b?)\)/i);
          const polyClef = polyClefMatchGen ? polyClefMatchGen[1].toLowerCase() : clef;
          try {
              const polyParts = polyphonyGabc.trim().split('\n').filter(p => p.trim());
              const textParts = verseText.split('*');

              if (textParts.length > 0 && polyParts.length > 0) {
                  let polyInput: any = polyParts[0].trim();
                  polyInput = polyInput.replace(/^\s*\([cf][1-4]b?\)\s*/i, '');
                  if ((window as any).getGabcTones && (window as any).removeIntonation) {
                      try {
                          let toneList = (window as any).getGabcTones(polyInput);
                          if (toneList && typeof toneList === 'object') {
                              toneList = (window as any).removeIntonation(toneList);
                              polyInput = toneList;
                          }
                      } catch(e) {}
                  }
                  const medPoly = window.applyPsalmTone({
                      text: textParts[0].trim(),
                      gabc: polyInput,
                      useBoldItalic: false,
                      firstPrefix: false
                  });
                  polyGabcRaw += typeof medPoly === 'string' ? medPoly : (medPoly.gabc || String(medPoly));
              }

              if (textParts.length > 1 && polyParts.length > 1) {
                  polyGabcRaw += " *(:) ";
                  let polyInputTerm: any = polyParts.slice(1).join('\n').trim();
                  if ((window as any).getGabcTones && (window as any).removeIntonation) {
                      try {
                          let toneList = (window as any).getGabcTones(polyInputTerm);
                          if (toneList && typeof toneList === 'object') {
                              toneList = (window as any).removeIntonation(toneList);
                              polyInputTerm = toneList;
                          }
                      } catch(e) {}
                  }
                  const termPoly = window.applyPsalmTone({
                      text: textParts[1].trim(),
                      gabc: polyInputTerm,
                      useBoldItalic: false,
                      firstPrefix: false
                  });
                  polyGabcRaw += typeof termPoly === 'string' ? termPoly : (termPoly.gabc || String(termPoly));
              } else if (textParts.length > 1 && polyParts.length === 1) {
                  polyGabcRaw += " *(:) ";
                  let polyInputTerm: any = polyParts[0].trim();
                  if ((window as any).getGabcTones && (window as any).removeIntonation) {
                      try {
                          let toneList = (window as any).getGabcTones(polyInputTerm);
                          if (toneList && typeof toneList === 'object') {
                              toneList = (window as any).removeIntonation(toneList);
                              polyInputTerm = toneList;
                          }
                      } catch(e) {}
                  }
                  const termPoly = window.applyPsalmTone({
                      text: textParts[1].trim(),
                      gabc: polyInputTerm,
                      useBoldItalic: false,
                      firstPrefix: false
                  });
                  polyGabcRaw += typeof termPoly === 'string' ? termPoly : (termPoly.gabc || String(termPoly));
              }
              
          } catch (err) {
              polyGabcRaw = `${verseText} (::)`;
          }
          const hasClef = /^\s*\(([cf][1-4])\)/i.test(polyGabcRaw);
          const lilypondStr = convertGabcToLilypond(hasClef ? polyGabcRaw : `(${polyClef}) ${polyGabcRaw}`, { ...options, noHeader: true });
          latexString += `% Verse ${index + 1} (Falsobordone)\n\\noindent\\begin{lilypond}[staffsize=${lilyStaffSize},fragment=false]\n\\paper {\n  indent = 0\\mm\n  short-indent = 0\\mm\n}\n\n${lilypondStr}\n\\end{lilypond}\n\n`;
        }
      });

      latexString += `\\end{document}`;
      setLualatexOutput(latexString);
      
      setIsCompiling(true);
      setPdfBase64("");
      try {
        const res = await fetch("/api/lualatex-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: latexString })
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to compile PDF.");
        }
        
        const data = await res.json();
        if (data.pdfBase64) {
          setPdfBase64(data.pdfBase64);
          setActiveOutputTab('pdf');
        }
      } catch (err: any) {
        console.error(err);
        alert("Compilation failed: " + err.message);
      } finally {
        setIsCompiling(false);
      }
      
      return latexString;
    } catch (err) {
      console.error(err);
      alert("An error occurred during generation. Check the console.");
      return null;
    }
  };



  const copyToClipboard = () => {
    navigator.clipboard.writeText(lualatexOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDownloadFilename = (ext: string): string => {
    const cleanString = (str: string) => {
      let s = str.replace(/Ordinary\s+Time/gi, 'OT');
      s = s.replace(/&/g, 'and');
      s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      s = s.replace(/[^a-zA-Z0-9\s\-_]/g, '');
      s = s.trim().replace(/[\s\-_]+/g, '_');
      return s;
    };
    const cleanTitle = cleanString(docTitle || '');
    const cleanSubtitle = cleanString(docSubtitle || '');
    
    let finalSubtitle = cleanSubtitle;
    if (cleanSubtitle.toLowerCase().startsWith('psalm_tone_')) {
      finalSubtitle = cleanSubtitle.substring(11);
    }
    
    const shortTitle = cleanTitle.substring(0, 35);
    const shortSub = finalSubtitle.substring(0, 35);
    
    let baseName = '';
    if (shortTitle && shortSub) {
      baseName = `${shortTitle}_${shortSub}`;
    } else {
      baseName = shortTitle || shortSub || `psalm_${psalmTone}`;
    }
    
    baseName = baseName.replace(/^_+|_+$/g, '');
    return `${baseName}.${ext}`;
  };

  const downloadFile = async () => {
    const zip = new JSZip();
    let finalCode = lualatexOutput;
    let gabcIndex = 0;
    const gabcRegex = /\\begin\{gabccode\}\s*([\s\S]*?)\s*\\end\{gabccode\}/g;
    let match;

    // Use a string replacement to avoid regex state mutation issues while replacing
    let tempCode = lualatexOutput;
    while ((match = gabcRegex.exec(tempCode)) !== null) {
      gabcIndex++;
      // Remove any HTML tags that jgabc leaves in the text which break gregorio
      const cleanGabc = match[1].replace(/<\/?(?:b|i|v)[^>]*>/g, '');
      const gabcContent = `name: snippet-${gabcIndex};\n%%\n${cleanGabc}`;
      const gabcFileName = `snippet-${gabcIndex}.gabc`;
      zip.file(gabcFileName, gabcContent);
      finalCode = finalCode.replace(match[0], `\\gregorioscore{snippet-${gabcIndex}.gtex}`);
    }

    zip.file("main.tex", finalCode);
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = getDownloadFilename('zip');
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    if (!pdfBase64) return;
    const byteCharacters = atob(pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {type: 'application/pdf'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getDownloadFilename('pdf');
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#d4d4d8] font-sans p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#c5a059] rounded flex items-center justify-center text-black font-bold">
            <span className="font-serif text-xl">℣</span>
          </div>
          <div>
            <h1 className="text-2xl font-serif italic tracking-wide text-[#c5a059]">Gregorio & LilyPond Falsobordone Builder</h1>
            <p className="text-gray-400 mt-1 text-sm">Generate LuaLaTeX from Psalm text using Jgabc + Polyphonic Falsobordone auto-conversion.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Proper Antiphon Selector */}
            <div className="bg-[#111111] border border-[#c5a059]/20 rounded-xl p-5 space-y-3">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#c5a059] font-bold pb-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <Music className="w-4 h-4" /> Proper Antiphon
                <span className="ml-auto text-[#c5a059]/50 text-[9px] normal-case tracking-normal">Year {currentCycle}</span>
              </h2>

              {/* Tab Selector */}
              <div className="flex border-b border-[#2a2a2a] mb-3">
                <button
                  type="button"
                  className={`flex-1 pb-2 text-[9px] uppercase tracking-wider font-bold transition-colors ${antiphonSelectMode === 'liturgical' ? 'text-[#c5a059] border-b-2 border-[#c5a059]' : 'text-gray-500 hover:text-gray-300'}`}
                  onClick={() => {
                    setAntiphonSelectMode('liturgical');
                    setAntiphonCandidates([]);
                    setSelectedCandidateId(null);
                    setSelectedProper(null);
                    setAntiphonGabc('');
                    setAntiphonMode(null);
                    setAntiphonModeVar(null);
                    setAntiphonError('');
                  }}
                >
                  By Liturgical Day
                </button>
                <button
                  type="button"
                  className={`flex-1 pb-2 text-[9px] uppercase tracking-wider font-bold transition-colors ${antiphonSelectMode === 'search' ? 'text-[#c5a059] border-b-2 border-[#c5a059]' : 'text-gray-500 hover:text-gray-300'}`}
                  onClick={() => {
                    setAntiphonSelectMode('search');
                    setAntiphonCandidates([]);
                    setSelectedCandidateId(null);
                    setSelectedProper(null);
                    setAntiphonGabc('');
                    setAntiphonMode(null);
                    setAntiphonModeVar(null);
                    setAntiphonError('');
                  }}
                >
                  Incipit Search
                </button>
              </div>

              {antiphonSelectMode === 'liturgical' ? (
                <>
                  {/* Dropdown 1: Select Liturgical Day */}
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">Liturgical Day</label>
                    <select
                      className="w-full bg-[#1a1a1a] border border-[#333] text-[#d4d4d8] rounded p-2 focus:border-[#c5a059] outline-none text-xs transition-colors cursor-pointer"
                      value={selectedLiturgy}
                      onChange={(e) => {
                        setSelectedLiturgy(e.target.value);
                        setSelectedProper(null);
                        setAntiphonGabc('');
                        setAntiphonMode(null);
                        setAntiphonModeVar(null);
                        setAntiphonError('');
                      }}
                    >
                      <option value="">— Select a Celebration —</option>
                      {/* Upcoming days first */}
                      {upcomingDays.length > 0 && (
                        <optgroup label="Upcoming (next 7 days)">
                          {upcomingDays.filter(day =>
                            liturgicalData.some(e => e.day === day && (e.cycle === 'All' || e.cycle === currentCycle))
                          ).map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </optgroup>
                      )}
                      {/* All other days */}
                      <optgroup label="All Celebrations">
                        {(() => {
                          const allDays = [...new Set(liturgicalData
                            .filter(e => e.cycle === 'All' || e.cycle === currentCycle)
                            .map(e => e.day)
                          )];
                          const remainingDays = allDays.filter(day => !upcomingDays.includes(day));
                          return remainingDays.sort((a, b) => {
                            const dateA = celebrationDatesMap[a] ? celebrationDatesMap[a].getTime() : Infinity;
                            const dateB = celebrationDatesMap[b] ? celebrationDatesMap[b].getTime() : Infinity;
                            if (dateA !== dateB) return dateA - dateB;
                            return a.localeCompare(b);
                          }).map(day => (
                            <option key={day} value={day}>{day}</option>
                          ));
                        })()}
                      </optgroup>
                    </select>
                  </div>

                  {/* Dropdown 2: Select Proper (Introit/Offertory/Communion) */}
                  {selectedLiturgy && (() => {
                    const propers = liturgicalData.filter(e =>
                      e.day === selectedLiturgy && (e.cycle === 'All' || e.cycle === currentCycle)
                    );
                    return propers.length > 0 ? (
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">Antiphon</label>
                        <select
                          className="w-full bg-[#1a1a1a] border border-[#333] text-[#d4d4d8] rounded p-2 focus:border-[#c5a059] outline-none text-xs transition-colors cursor-pointer"
                          value={selectedProper?.id ?? ''}
                          onChange={(e) => {
                            const id = parseInt(e.target.value);
                            const found = propers.find(p => p.id === id);
                            if (found) loadProper(found);
                          }}
                        >
                          <option value="">— Select Antiphon —</option>
                          {propers.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.type}: {p.incipit}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null;
                  })()}
                </>
              ) : (
                <div className="space-y-3">
                  {/* Ad-hoc Incipit Search */}
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">Incipit Search</label>
                    <input
                      type="text"
                      placeholder="e.g. Gustate, Tu es Petrus..."
                      className="w-full bg-[#1a1a1a] border border-[#333] text-[#d4d4d8] rounded p-2 focus:border-[#c5a059] outline-none text-xs transition-colors"
                      value={searchIncipit}
                      onChange={(e) => setSearchIncipit(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          searchByIncipit(searchIncipit, searchType);
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">Usage Type</label>
                    <select
                      className="w-full bg-[#1a1a1a] border border-[#333] text-[#d4d4d8] rounded p-2 focus:border-[#c5a059] outline-none text-xs transition-colors cursor-pointer"
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value)}
                    >
                      <option value="Communion">Communion</option>
                      <option value="Offertory">Offertory</option>
                      <option value="Introit">Introit</option>
                      <option value="Gradual">Gradual</option>
                      <option value="Alleluia">Alleluia</option>
                      <option value="Tract">Tract</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => searchByIncipit(searchIncipit, searchType)}
                    disabled={antiphonLoading || !searchIncipit.trim()}
                    className="w-full bg-[#c5a059] hover:bg-[#d4b16a] text-black font-semibold py-2 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                  >
                    {antiphonLoading ? 'Searching...' : 'Search Chant'}
                  </button>
                </div>
              )}

              {/* Chant Version / Source selector, shown in either mode if candidates exist */}
              {antiphonCandidates.length > 1 && (
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">Chant Version / Source</label>
                  <select
                    className="w-full bg-[#1a1a1a] border border-[#333] text-[#d4d4d8] rounded p-2 focus:border-[#c5a059] outline-none text-xs transition-colors cursor-pointer"
                    value={selectedCandidateId ?? ''}
                    onChange={(e) => {
                      const cid = parseInt(e.target.value);
                      if (selectedProper) {
                        loadCandidateChant(cid, selectedProper);
                      }
                    }}
                  >
                    {antiphonCandidates.map(c => {
                      const part = c.officePart ? ` [${c.officePart.toUpperCase()}]` : '';
                      const modeStr = c.mode ? ` (Mode ${c.mode}${c.modeVar ? ' ' + c.modeVar : ''})` : '';
                      return (
                        <option key={c.id} value={c.id}>
                          {c.version || `ID ${c.id}`}{part}{modeStr}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Antiphon status */}
              {antiphonLoading && (
                <div className="text-[11px] text-[#c5a059] animate-pulse flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border border-[#c5a059] border-t-transparent animate-spin inline-block"></span>
                  Searching GregoBase...
                </div>
              )}
              {antiphonError && (
                <div className="text-[11px] text-amber-500/80 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5">
                  {antiphonError} — using tone from mode only.
                </div>
              )}
              {selectedProper && antiphonGregobaseId && !antiphonLoading && (
                <div className="text-[10px] text-green-500/70 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Found in GregoBase (ID {antiphonGregobaseId}). Tone auto-set, psalm loaded.
                </div>
              )}
              {selectedProper && (
                <button
                  type="button"
                  onClick={() => { setSelectedProper(null); setAntiphonGabc(''); setAntiphonMode(null); setAntiphonModeVar(null); setAntiphonError(''); setSelectedLiturgy(''); }}
                  className="text-[10px] text-gray-500 hover:text-red-400 underline transition-colors"
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#c5a059] font-bold pb-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <FileCode className="w-4 h-4" /> Source Configuration
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">Document Title</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#1a1a1a] border border-[#333] text-[#d4d4d8] rounded p-2 focus:border-[#c5a059] outline-none text-sm font-serif transition-colors"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="e.g. Psalm 109"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">Subtitle / Tone</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#1a1a1a] border border-[#333] text-[#d4d4d8] rounded p-2 focus:border-[#c5a059] outline-none text-sm font-serif transition-colors"
                    value={docSubtitle}
                    onChange={(e) => setDocSubtitle(e.target.value)}
                    placeholder={`e.g. Psalm Tone: ${psalmTone}`}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">Psalm Tone</label>
                <select 
                  className="w-full bg-[#1a1a1a] border border-[#333] text-[#d4d4d8] rounded p-2 focus:border-[#c5a059] outline-none text-sm font-serif transition-colors cursor-pointer"
                  value={psalmTone}
                  onChange={(e) => setPsalmTone(e.target.value)}
                >
                  {availableTones.map(t => (
                    <option key={t} value={t} className="bg-[#1a1a1a]">{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-500 block mb-1">
                  Chant Tone GABC (Gregorian)
                </label>
                <textarea 
                  className="w-full h-20 bg-[#1a1a1a] border border-[#333] text-[#a1a1aa] rounded p-3 focus:border-[#c5a059] outline-none font-mono text-xs leading-relaxed resize-y transition-colors"
                  value={chantGabc}
                  onChange={(e) => setChantGabc(e.target.value)}
                  placeholder="Gregorian chant tone formula..."
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-gray-500 block">Polyphonic Tone GABC (Falsobordone)</label>
                  <div className="flex gap-2 items-center">
                    <select
                      className="bg-[#1a1a1a] border border-[#333] text-gray-300 rounded px-2 py-1 text-[11px] focus:border-[#c5a059] outline-none transition-colors max-w-[180px]"
                      value={selectedPolyToneName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedPolyToneName(val);
                        const found = polyTones.find(t => t.name === val);
                        if (found) {
                          setPolyphonyGabc(found.gabc);
                        }
                      }}
                    >
                      <option value="">Custom / Select Tone...</option>
                      {polyTones.map(t => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        const name = prompt("Enter a name for this polyphonic tone:");
                        if (!name) return;
                        if (polyTones.some(t => t.name.toLowerCase() === name.toLowerCase())) {
                          alert("A tone with that name already exists. Please choose a different name.");
                          return;
                        }
                        try {
                          const res = await fetch("/api/polyphonic-tones", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name, gabc: polyphonyGabc })
                          });
                          if (res.ok) {
                            alert("Tone saved successfully!");
                            setSelectedPolyToneName(name);
                            await fetchPolyTones();
                          } else {
                            const data = await res.json();
                            alert("Error: " + (data.error || "Failed to save tone"));
                          }
                        } catch (err: any) {
                          alert("Failed to save tone: " + err.message);
                        }
                      }}
                      className="px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] hover:border-[#c5a059] text-[#c5a059] rounded text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      Save Tone
                    </button>
                  </div>
                </div>
                <textarea 
                  className="w-full h-32 bg-[#1a1a1a] border border-[#333] text-[#a1a1aa] rounded p-3 focus:border-[#c5a059] outline-none font-mono text-xs leading-relaxed resize-none transition-colors"
                  value={polyphonyGabc}
                  onChange={(e) => {
                    setPolyphonyGabc(e.target.value);
                    setSelectedPolyToneName("");
                  }}
                  placeholder="e.g. [{j<}{f>}h {j<}{f>}gh ... ]"
                />
              </div>

              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="text-[10px] uppercase tracking-widest text-gray-500 block">Psalm Text (Latin)</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox"
                          className="peer appearance-none w-3.5 h-3.5 rounded bg-[#1a1a1a] border border-[#333] checked:bg-[#c5a059] checked:border-[#c5a059] focus:outline-none transition-colors cursor-pointer"
                          checked={includeGloriaPatri}
                          onChange={(e) => setIncludeGloriaPatri(e.target.checked)}
                        />
                        <CheckCircle2 className="w-[10px] h-[10px] text-black absolute opacity-0 peer-checked:opacity-100 pointer-events-none stroke-[3]" />
                      </div>
                      <span className="text-[10px] text-gray-400 group-hover:text-[#c5a059] transition-colors">Include Gloria Patri</span>
                    </label>
                    <select 
                      className="bg-[#1a1a1a] border border-[#333] text-[#d4d4d8] rounded px-2 py-1 outline-none focus:border-[#c5a059] text-[10px] uppercase tracking-widest transition-colors cursor-pointer"
                      onChange={async (e) => {
                        const key = e.target.value;
                        if (!key) return;
                        const path = `./lib/jgabc/psalms/${key}.txt`;
                        if (psalmModules[path]) {
                          try {
                            const rawText = await psalmModules[path]();
                            const text = typeof rawText === 'string' ? rawText : (rawText as any)?.default || String(rawText);
                            let cleaned = text
                              .split('\n')
                              .filter((l: string) => !l.startsWith('v.') && !l.startsWith('ps.') && l.trim().length > 0)
                              .map((l: string) => l.replace(/^\d+\.\s*/, '').replace(/<[^>]+>/g, '').trim())
                              .join('\n');
                            
                            if (includeGloriaPatri) {
                              cleaned += '\nGlória Patri, et Fílio, * et Spirítui Sancto.\nSicut erat in princípio, et nunc, et semper, * et in sǽcula sæculórum. Amen.';
                            }
                              
                            setPsalmText(cleaned);
                            setDocTitle(key.match(/^\d+$/) ? `Psalm ${parseInt(key, 10)}` : key);
                          } catch (err) {
                            console.error("Failed to load psalm", err);
                          }
                        }
                      }}
                    >
                      <option value="">Load Psalm / Canticle...</option>
                      {psalmKeys.map(k => (
                        <option key={k} value={k}>
                           {k.match(/^\d+$/) ? `Psalm ${parseInt(k, 10)}` : k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <textarea 
                  className="w-full h-48 bg-[#1a1a1a] border border-[#333] text-[#a1a1aa] rounded p-3 focus:border-[#c5a059] outline-none font-mono text-sm leading-relaxed resize-none transition-colors"
                  value={psalmText}
                  onChange={(e) => setPsalmText(e.target.value)}
                  placeholder="Enter psalm text here. One verse per line. Use asterisks * for mediants."
                />
              </div>
            </div>

            <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#c5a059] font-bold pb-2 border-b border-[#2a2a2a]">
                Polyphony Settings
              </h2>
              
              <div className="space-y-4 pt-2">
                <div>
                   <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 flex justify-between">
                     Global Transposition
                     <span className="text-[#c5a059]/70">(LilyPond)</span>
                   </label>
                   <select 
                     className="w-full bg-[#1a1a1a] border border-[#333] text-[#d4d4d8] rounded p-2 outline-none focus:border-[#c5a059] text-xs transition-colors"
                     value={options.transposeVal}
                     onChange={(e) => setOptions({...options, transposeVal: e.target.value})}
                   >
                     <option value="c c">Literal Pitch (From Clef)</option>
                     <option value="c d">Up M2</option>
                     <option value="c f">Up P4</option>
                     <option value="c bes,">Down M2</option>
                     <option value="c a,">Down m3</option>
                     <option value="c g,">Down P4</option>
                   </select>
                </div>

                <div className="space-y-3 pt-4 border-t border-[#2a2a2a]">
                  {[
                    { key: 'compressReciting', label: 'Compress Reciting Tones' },
                    { key: 'compressStrophic', label: 'Code Compression (Variables)' },
                    { key: 'forceBreak', label: 'Break Lines per Verse' },
                    { key: 'showBarlines', label: 'Show Barlines' },
                    { key: 'hideStems', label: 'Hide Note Stems' }
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox"
                          className="peer appearance-none w-4 h-4 rounded bg-[#1a1a1a] border border-[#333] checked:bg-[#c5a059] checked:border-[#c5a059] focus:outline-none transition-colors cursor-pointer"
                          checked={options[key as keyof ConvertOptions] as boolean}
                          onChange={(e) => setOptions({...options, [key]: e.target.checked})}
                        />
                        <CheckCircle2 className="w-3 h-3 text-black absolute opacity-0 peer-checked:opacity-100 pointer-events-none stroke-[3]" />
                      </div>
                      <span className="text-xs text-gray-400 group-hover:text-[#c5a059] transition-colors">{label}</span>
                    </label>
                  ))}
                </div>

                {/* Verse Alternation */}
                <div className="pt-4 border-t border-[#2a2a2a] space-y-3">
                  <span className="text-[10px] uppercase tracking-widest text-gray-500 block">Verse Alternation (Chant : Polyphony)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">Chant verses per cycle</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min={0} max={5} step={1}
                          value={chantVersesPerCycle}
                          onChange={(e) => setChantVersesPerCycle(parseInt(e.target.value))}
                          className="flex-1 accent-[#c5a059]"
                        />
                        <span className="text-xs text-[#c5a059] w-4 text-right font-mono">{chantVersesPerCycle}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">Poly verses per cycle</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min={0} max={5} step={1}
                          value={polyVersesPerCycle}
                          onChange={(e) => setPolyVersesPerCycle(parseInt(e.target.value))}
                          className="flex-1 accent-[#c5a059]"
                        />
                        <span className="text-xs text-[#c5a059] w-4 text-right font-mono">{polyVersesPerCycle}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-600 italic">
                    Pattern: {chantVersesPerCycle === 0 ? 'All polyphony' : polyVersesPerCycle === 0 ? 'All chant' : `${chantVersesPerCycle} chant, ${polyVersesPerCycle} poly, repeat`}
                  </div>
                </div>

                {/* Total Verses in PDF */}
                <div className="pt-3 border-t border-[#2a2a2a]">
                  <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 flex justify-between">
                    Total Verses to Include
                    <span className="text-[#c5a059]/70 font-mono">{pdfTotalVerses} {pdfTotalVerses === 1 ? 'verse' : 'verses'}</span>
                  </label>
                  <input
                    type="range" min={1} max={15} step={1}
                    value={pdfTotalVerses}
                    onChange={(e) => setPdfTotalVerses(parseInt(e.target.value))}
                    className="w-full accent-[#c5a059]"
                  />
                  <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                    <span>1 (Doxology only)</span><span>15</span>
                  </div>
                </div>

                {/* LilyPond Staff Size */}
                <div className="pt-3 border-t border-[#2a2a2a]">
                  <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 flex justify-between">
                    LilyPond Staff Size
                    <span className="text-[#c5a059]/70 font-mono">{lilyStaffSize}pt</span>
                  </label>
                  <input
                    type="range" min={10} max={24} step={1}
                    value={lilyStaffSize}
                    onChange={(e) => setLilyStaffSize(parseInt(e.target.value))}
                    className="w-full accent-[#c5a059]"
                  />
                  <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                    <span>Smaller</span><span>Larger</span>
                  </div>
                </div>

                {/* Gregorio Staff Size */}
                <div className="pt-3 border-t border-[#2a2a2a]">
                  <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 flex justify-between">
                    Gregorio Staff Size
                    <span className="text-[#c5a059]/70 font-mono">{gregorioStaffSize}</span>
                  </label>
                  <input
                    type="range" min={9} max={30} step={1}
                    value={gregorioStaffSize}
                    onChange={(e) => setGregorioStaffSize(parseInt(e.target.value))}
                    className="w-full accent-[#c5a059]"
                  />
                  <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                    <span>Smaller</span><span>Larger</span>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={generateOutput}
              disabled={!jgabcLoaded || isCompiling}
              className="w-full bg-[#c5a059] hover:bg-[#d4b16a] text-black font-semibold py-3 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {!jgabcLoaded ? 'Loading jgabc Engine...' : isCompiling ? 'Compiling PDF (this may take a minute)...' : 'Generate PDF'}
            </button>

          </div>

          <div className="lg:col-span-8 flex flex-col gap-6">

            <div className="flex flex-col h-[500px] border border-[#2a2a2a] rounded-xl bg-[#0e0e0e] overflow-hidden">
              <div className="bg-[#161616] border-b border-[#222] px-4 py-2 flex items-center justify-between text-gray-400">
                <span className="text-[10px] uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#c5a059] inline-block"></span>
                  Visual Preview (Verse 1)
                </span>
                <span className="text-[10px] uppercase text-[#c5a059] hidden sm:block">Chant & Polyphony</span>
              </div>
              <div className="flex-1 overflow-auto bg-white p-4 space-y-6 flex flex-col">
                {/* Antiphon Preview */}
                {antiphonGabc && (
                  <div className="border-b-2 border-amber-300 pb-4">
                    <h4 className="text-[10px] uppercase tracking-wider text-amber-700 mb-2 font-bold flex items-center gap-1.5">
                      <Music className="w-3 h-3" />
                      Antiphon: {selectedProper?.incipit}
                    </h4>
                    <div className="overflow-x-auto">
                      <ExsurgePreview gabc={antiphonGabc} />
                    </div>
                  </div>
                )}
                {preview.gabc ? (
                  <div className="border-b border-gray-100 pb-4">
                    <h4 className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-semibold">Chant (Gregorian)</h4>
                    <div className="overflow-x-auto">
                      <ExsurgePreview gabc={preview.gabc} />
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-400 text-xs italic text-center p-4">No chant text available</div>
                )}

                {preview.lilypond ? (
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2">
                      <h4 className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                        Polyphony ({polyPreviewFormat === 'lilypond' ? 'LilyPond SATB' : 'Gregorio Chant'})
                      </h4>
                      <div className="flex gap-1 border border-[#333] bg-[#1a1a1a] rounded overflow-hidden p-0.5">
                        <button
                          type="button"
                          onClick={() => setPolyPreviewFormat('lilypond')}
                          className={`px-2 py-0.5 text-[9px] uppercase tracking-widest transition-colors font-bold rounded ${polyPreviewFormat === 'lilypond' ? 'bg-[#c5a059] text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                          LilyPond
                        </button>
                        <button
                          type="button"
                          onClick={() => setPolyPreviewFormat('gregorio')}
                          className={`px-2 py-0.5 text-[9px] uppercase tracking-widest transition-colors font-bold rounded ${polyPreviewFormat === 'gregorio' ? 'bg-[#c5a059] text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                          Gregorio
                        </button>
                      </div>
                    </div>
                    {polyPreviewFormat === 'lilypond' ? (
                      <LilyPondPreview code={preview.lilypond} />
                    ) : (
                      <div className="overflow-x-auto">
                        <ExsurgePreview gabc={preview.polyGabc} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 text-xs italic text-center p-4">No polyphony text available</div>
                )}
              </div>
            </div>

            <div className="flex flex-col min-h-[500px] flex-1 border border-[#2a2a2a] rounded-xl bg-[#0e0e0e] overflow-hidden">
            <div className="bg-[#161616] border-b border-[#222] px-4 py-3 flex justify-between items-center text-gray-400 flex-wrap gap-3">
               <div className="flex items-center gap-4">
                 <span className="text-[10px] uppercase tracking-widest flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-[#c5a059] inline-block"></span>
                   Output
                 </span>
                 
                 <div className="flex gap-1 border border-[#333] rounded overflow-hidden">
                    <button 
                      onClick={() => setActiveOutputTab('pdf')}
                      className={`px-3 py-1 text-[10px] uppercase tracking-widest transition-colors ${activeOutputTab === 'pdf' ? 'bg-[#333] text-white' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'}`}
                    >
                      PDF Preview
                    </button>
                    <button 
                      onClick={() => setActiveOutputTab('source')}
                      className={`px-3 py-1 text-[10px] uppercase tracking-widest transition-colors ${activeOutputTab === 'source' ? 'bg-[#333] text-white' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'}`}
                    >
                      LaTeX Source
                    </button>
                 </div>
               </div>

               <div className="flex gap-2">
                 <button 
                  onClick={downloadPdf}
                  disabled={!pdfBase64}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] hover:border-[#c5a059] text-[#c5a059] rounded text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <Download className="w-4 h-4" /> Download PDF
                 </button>
                 <button 
                  onClick={downloadFile}
                  disabled={!lualatexOutput}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] hover:border-[#c5a059] text-[#c5a059] rounded text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <FileCode className="w-4 h-4" /> Download TeX Zip
                 </button>
                 <button 
                  onClick={copyToClipboard}
                  disabled={!lualatexOutput}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] hover:border-[#c5a059] text-[#c5a059] rounded text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                   {copied ? 'Copied' : 'Copy'}
                 </button>
               </div>
            </div>
            
            {activeOutputTab === 'pdf' ? (
              <div className="flex-1 bg-[#1a1a1a] flex flex-col justify-center items-center relative">
                {isCompiling ? (
                  <div className="text-gray-400 text-sm animate-pulse flex flex-col items-center gap-2">
                    <span className="w-8 h-8 rounded-full border-t-2 border-[#c5a059] animate-spin mb-2"></span>
                    Compiling Gregorio & LuaLaTeX...
                  </div>
                ) : pdfBase64 ? (
                  <object 
                    data={`data:application/pdf;base64,${pdfBase64}`} 
                    type="application/pdf" 
                    className="w-full h-full min-h-[500px]"
                  >
                    <p className="p-4 text-center text-gray-400">Your browser does not support inline PDFs. <br/><br/>
                       <button onClick={downloadPdf} className="text-[#c5a059] underline">Click here to download the PDF</button>
                    </p>
                  </object>
                ) : (
                  <div className="text-gray-500 text-xs italic text-center p-4">
                    Click "Generate PDF" to compile your chant and polyphony.
                  </div>
                )}
              </div>
            ) : (
              <>
                {lualatexOutput && (
                  <div className="bg-[#c5a059]/10 border-b border-[#c5a059]/30 px-4 py-3 text-red-400 text-[11px] font-mono leading-relaxed">
                    <strong>CRITICAL:</strong> You must compile this file with the <code className="bg-red-500/20 px-1 py-0.5 rounded">--shell-escape</code> flag!
                    <br />
                    <span className="text-gray-400 mt-1 block">Example: <code>lualatex --shell-escape main.tex</code></span>
                  </div>
                )}
                <textarea 
                  readOnly 
                  className="w-full h-full min-h-[500px] p-4 bg-black text-[#8b8b8b] font-mono text-[11px] leading-relaxed resize-none focus:outline-none flex-1 selection:bg-[#c5a059] selection:text-black"
                  value={lualatexOutput}
                  placeholder="% Your generated LuaLaTeX output, alternating between Gregorian chant verses and LilyPond falsobordone, will render here..."
                />
              </>
            )}
          </div>
          </div>

        </div>

      </div>
    </div>
  );
}
