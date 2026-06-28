import React, { useState, useMemo, useEffect } from 'react';
import { Download, FileCode, CheckCircle2, Copy, Eye, Image as ImageIcon } from 'lucide-react';
import { useJgabc } from './hooks/useJgabc';
import { convertGabcToLilypond, ConvertOptions } from './lib/gabcToLilypond';
import JSZip from 'jszip';
import { ExsurgePreview } from './components/ExsurgePreview';
import { LilyPondPreview } from './components/LilyPondPreview';


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
    let gabcPreview = `(${clef}) `;
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
    try {
        const polyParts = polyphonyGabc.trim().split('\n').filter(p => p.trim());
        const textParts = polyVerse.split('*');

        if (textParts.length > 0 && polyParts.length > 0) {
            let polyInput: any = polyParts[0].trim();
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
    const lilypondPreview = convertGabcToLilypond(hasClef ? polyPreview : `(${clef}) ${polyPreview}`, { ...options, forceBreak: false });
    return { gabc: gabcPreview, polyGabc: hasClef ? polyPreview : `(${clef}) ${polyPreview}`, lilypond: lilypondPreview };
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
    if (!docSubtitle || docSubtitle.startsWith("Psalm Tone:")) {
      setDocSubtitle(`Psalm Tone: ${psalmTone}`);
    }
  }, [psalmTone]);

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

  const generateOutput = async () => {
    if (!window.applyPsalmTone) {
      alert("jgabc library is still loading or failed to load. Please try again in a few seconds.");
      return;
    }

    try {
      const verses = psalmText.split('\n').filter(line => line.trim().length > 0);
      
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

% Color the mediant star red
\\let\\oldgreheightstar\\greheightstar
\\renewcommand{\\greheightstar}{\\textcolor{gregoriocolor}{\\oldgreheightstar}}

\\begin{document}

\\begin{center}
  \\textbf{\\Large ${docTitle || "Psalm"}}\\\\[1ex]
  \\textit{\\large ${docSubtitle || `Psalm Tone: ${psalmTone}`}}
\\end{center}

`;

      verses.forEach((verseText, index) => {
        const isOdd = (index + 1) % 2 !== 0; // 1-based: 1, 3, 5 are odd
        
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

            // Manually split by * so jgabc applies the mediant and termination separately.
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
                // Add the star
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
            // Graceful fallback for GABC format so script doesn't crash LilyPond converter
            gabcRaw = `(c4) ${verseText} (::)`;
        }

        if (isOdd) {
          // Chant verse (Gregorio)
          latexString += `% Verse ${index + 1} (Chant)\n\\begin{gabccode}\n${gabcRaw}\n\\end{gabccode}\n\n`;
        } else {
          // Falsobordone Polyphony verse (LilyPond)
          let polyGabcRaw = "";
          try {
              const polyParts = polyphonyGabc.trim().split('\n').filter(p => p.trim());
              const textParts = verseText.split('*');

              if (textParts.length > 0 && polyParts.length > 0) {
                  let polyInput: any = polyParts[0].trim();
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
          const lilypondStr = convertGabcToLilypond(hasClef ? polyGabcRaw : `(${clef}) ${polyGabcRaw}`, { ...options, noHeader: true });
          latexString += `% Verse ${index + 1} (Falsobordone)\n\\noindent\\begin{lilypond}[fragment=false]\n\\paper {\n  indent = 0\\mm\n  short-indent = 0\\mm\n}\n\n${lilypondStr}\n\\end{lilypond}\n\n`;
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
    a.download = `psalm_${psalmTone}.zip`;
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
    a.download = `psalm_${psalmTone}.pdf`;
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
