import React, { useState, useMemo } from 'react';
import { Download, FileCode, CheckCircle2, Copy, Eye } from 'lucide-react';
import { useJgabc } from './hooks/useJgabc';
import { convertGabcToLilypond, ConvertOptions } from './lib/gabcToLilypond';

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

export default function App() {
  const jgabcLoaded = useJgabc();
  const [psalmText, setPsalmText] = useState("Dixit Dóminus Dómino meo: * Sede a dextris meis:\nDonec ponam inimícos tuos, * scabéllum pedum tuórum.");
  const [psalmTone, setPsalmTone] = useState("8.G");
  const [polyphonyGabc, setPolyphonyGabc] = useState("[{j<}{f>}h {j<}{f>}gh {j<}{f>}hr {i<}{d>}g {h<}{a>}h 'g#{g<}{e>}i {h<}{a>}hr {h<}{a>}h.\n{j<}{a>}hr {i<}{e>}g {h<}{a>}h {HJ}{HF}jh '{JI}{CD}hg g#{g<}{e>}er {g.<}{e.>}e.]");
  
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
    
    // Preview Verse 1 (Chant)
    const verse1 = verses[0];
    let gabcRawTone = "";
    if ((window as any).g_tones) {
        const g_tones = (window as any).g_tones;
        let toneStr = psalmTone.trim();
        let toneKey = Object.keys(g_tones).find(k => toneStr.startsWith(k)) || "";
        const toneData = g_tones[toneKey];
        if (toneData) {
            let ending = toneStr.substring(toneKey.length).trim();
            gabcRawTone = toneData.mediant + "\n";
            if (ending && toneData.terminations && toneData.terminations[ending]) {
                gabcRawTone += toneData.terminations[ending];
            } else if (toneData.termination) {
                gabcRawTone += toneData.termination;
            } else if (toneData.mediant) {
                gabcRawTone += toneData.mediant;
            }
        }
    }
    
    let gabcPreview = "";
    try {
        const result1 = window.applyPsalmTone({ 
            text: verse1.trim(), 
            gabc: gabcRawTone || psalmTone,
            useBoldItalic: true,
            firstPrefix: false
        });
        gabcPreview = typeof result1 === 'string' ? result1 : (result1?.gabc || String(result1));
    } catch (e) {
        console.error("Verse 1 error:", e);
        gabcPreview = "(c4)"; 
    }

    // Preview Verse 2 (Polyphony) - or Verse 1 if there's only one verse
    const verse2 = verses.length > 1 ? verses[1] : verses[0];
    let polyPreview = "";
    try {
        const result2 = window.applyPsalmTone({
            text: verse2.trim(),
            gabc: polyphonyGabc.trim(),
            useBoldItalic: false,
            firstPrefix: false
        });
        polyPreview = typeof result2 === 'string' ? result2 : (result2?.gabc || String(result2));
    } catch (e) {
        console.error("Verse 2 error:", e);
        polyPreview = "(c4)"; 
    }

    const lilypondPreview = convertGabcToLilypond(`(c4) ${polyPreview}`, options);
    
    return { gabc: gabcPreview, lilypond: lilypondPreview };
  }, [psalmText, psalmTone, polyphonyGabc, options, jgabcLoaded]);

  const generateOutput = () => {
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

\\begin{document}

\\begin{center}
  \\textbf{\\Large Psalm Tone: ${psalmTone}}
\\end{center}

`;

      verses.forEach((verseText, index) => {
        const isOdd = (index + 1) % 2 !== 0; // 1-based: 1, 3, 5 are odd
        
        let gabcRaw = "";
        try {
            let medGabc = "";
            let termGabc = "";
            let clef = 'c4';

            if ((window as any).g_tones) {
                const g_tones = (window as any).g_tones;
                let toneStr = psalmTone.trim();
                const keys = Object.keys(g_tones);
                let toneKey = keys.find(k => toneStr.startsWith(k)) || "";
                
                const toneData = g_tones[toneKey];
                if (toneData) {
                    if (toneData.clef) clef = toneData.clef;
                    let ending = toneStr.substring(toneKey.length).trim();
                    medGabc = toneData.mediant || "";
                    if (ending && toneData.terminations && toneData.terminations[ending]) {
                        termGabc = toneData.terminations[ending];
                    } else if (toneData.termination) {
                        termGabc = toneData.termination;
                    } else if (toneData.mediant) {
                        termGabc = toneData.mediant;
                    }
                }
            }

            gabcRaw = `(${clef}) `;

            // Manually split by * so jgabc applies the mediant and termination separately.
            const parts = verseText.split('*');
            if (parts.length > 0) {
                const medResult = (window as any).applyPsalmTone({ 
                    text: parts[0].trim(), 
                    gabc: medGabc || psalmTone, 
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
          latexString += `% Verse ${index + 1} (Chant)\n\\gabcsnippet{${gabcRaw}}\n\n`;
        } else {
          // Falsobordone Polyphony verse (LilyPond)
          let polyGabcRaw = "";
          try {
              const polyParts = polyphonyGabc.trim().split('\n').filter(p => p.trim());
              const textParts = verseText.split('*');

              if (textParts.length > 0 && polyParts.length > 0) {
                  const medPoly = window.applyPsalmTone({
                      text: textParts[0].trim(),
                      gabc: polyParts[0].trim(),
                      useBoldItalic: false,
                      firstPrefix: false
                  });
                  polyGabcRaw += typeof medPoly === 'string' ? medPoly : (medPoly.gabc || String(medPoly));
              }

              if (textParts.length > 1 && polyParts.length > 1) {
                  polyGabcRaw += " *(:) ";
                  const termPoly = window.applyPsalmTone({
                      text: textParts[1].trim(),
                      gabc: (polyParts.length > 1 ? polyParts.slice(1).join('\n') : polyParts[0]).trim(),
                      useBoldItalic: false,
                      firstPrefix: false
                  });
                  polyGabcRaw += typeof termPoly === 'string' ? termPoly : (termPoly.gabc || String(termPoly));
              } else if (textParts.length > 1 && polyParts.length === 1) {
                  // Fallback if polyphony gabc wasn't multiline
                  polyGabcRaw += " *(:) ";
                  const termPoly = window.applyPsalmTone({
                      text: textParts[1].trim(),
                      gabc: polyParts[0].trim(),
                      useBoldItalic: false,
                      firstPrefix: false
                  });
                  polyGabcRaw += typeof termPoly === 'string' ? termPoly : (termPoly.gabc || String(termPoly));
              }
              
          } catch (err) {
              polyGabcRaw = `(c4) ${verseText} (::)`;
          }
          const lilypondStr = convertGabcToLilypond(`(c4) ${polyGabcRaw}`, options);
          latexString += `% Verse ${index + 1} (Falsobordone)\n\\begin{lilypond}[fragment=false]\n${lilypondStr}\n\\end{lilypond}\n\n`;
        }
      });

      latexString += `\\end{document}`;
      setLualatexOutput(latexString);
    } catch (err) {
      console.error(err);
      alert("An error occurred during generation. Check the console.");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(lualatexOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = () => {
    const blob = new Blob([lualatexOutput], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `psalm_${psalmTone}.tex`;
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
              
              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">Psalm Tone</label>
                <input 
                  type="text" 
                  list="tones-list"
                  className="w-full bg-[#1a1a1a] border border-[#333] text-[#d4d4d8] rounded p-2 focus:border-[#c5a059] outline-none text-sm font-serif transition-colors"
                  value={psalmTone}
                  onChange={(e) => setPsalmTone(e.target.value)}
                  placeholder="e.g. 8.G, 1.D"
                />
                <datalist id="tones-list">
                  {availableTones.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">Polyphonic Tone GABC (Falsobordone)</label>
                <textarea 
                  className="w-full h-32 bg-[#1a1a1a] border border-[#333] text-[#a1a1aa] rounded p-3 focus:border-[#c5a059] outline-none font-mono text-xs leading-relaxed resize-none transition-colors"
                  value={polyphonyGabc}
                  onChange={(e) => setPolyphonyGabc(e.target.value)}
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
              disabled={!jgabcLoaded}
              className="w-full bg-[#c5a059] hover:bg-[#d4b16a] text-black font-semibold py-3 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {jgabcLoaded ? 'Generate LuaLaTeX' : 'Loading jgabc Engine...'}
            </button>

          </div>

          <div className="lg:col-span-8 flex flex-col gap-6">

            <div className="flex flex-col h-64 border border-[#2a2a2a] rounded-xl bg-[#0e0e0e] overflow-hidden">
              <div className="bg-[#161616] border-b border-[#222] px-4 py-2 flex items-center justify-between text-gray-400">
                 <span className="text-[10px] uppercase tracking-widest flex items-center gap-2">
                   <Eye className="w-3 h-3 text-[#c5a059]" /> Note Source Preview
                 </span>
                 <span className="text-[10px] uppercase text-[#c5a059]">Verse 1 (Chant) & Verse 2 (Polyphony)</span>
              </div>
              <div className="flex-1 grid grid-cols-2 divide-x divide-[#2a2a2a]">
                <div className="flex flex-col">
                  <div className="bg-[#111111] px-3 py-1 text-[9px] uppercase tracking-widest text-gray-500 border-b border-[#222]">Chant GABC</div>
                  <textarea 
                    readOnly 
                    className="w-full h-full p-4 bg-[#0a0a0a] text-[#8b8b8b] font-mono text-[10px] leading-relaxed resize-none focus:outline-none selection:bg-[#c5a059] selection:text-black"
                    value={preview.gabc}
                    placeholder="Chant GABC preview..."
                  />
                </div>
                <div className="flex flex-col">
                  <div className="bg-[#111111] px-3 py-1 text-[9px] uppercase tracking-widest text-[#c5a059]/70 border-b border-[#222]">LilyPond Falsobordone</div>
                  <textarea 
                    readOnly 
                    className="w-full h-full p-4 bg-[#0a0a0a] text-[#8b8b8b] font-mono text-[10px] leading-relaxed resize-none focus:outline-none selection:bg-[#c5a059] selection:text-black"
                    value={preview.lilypond}
                    placeholder="LilyPond preview..."
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col min-h-[500px] flex-1 border border-[#2a2a2a] rounded-xl bg-[#0e0e0e] overflow-hidden">
            <div className="bg-[#161616] border-b border-[#222] px-4 py-3 flex justify-between items-center text-gray-400">
               <span className="text-[10px] uppercase tracking-widest flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-[#c5a059] inline-block"></span>
                 Output: LuaLaTeX
               </span>
               <div className="flex gap-2">
                 <button 
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] hover:border-[#c5a059] text-[#c5a059] rounded text-[10px] font-bold uppercase tracking-widest transition-all"
                 >
                   {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                   {copied ? 'Copied' : 'Copy'}
                 </button>
                 <button 
                  onClick={downloadFile}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] hover:border-[#c5a059] text-[#c5a059] rounded text-[10px] font-bold uppercase tracking-widest transition-all"
                 >
                   <Download className="w-3 h-3" /> Download
                 </button>
               </div>
            </div>
            {lualatexOutput && (
              <div className="bg-[#c5a059]/10 border-b border-[#c5a059]/30 px-4 py-3 text-red-400 text-[11px] font-mono leading-relaxed">
                <strong>CRITICAL:</strong> You must compile this file with the <code className="bg-red-500/20 px-1 py-0.5 rounded">--shell-escape</code> flag!
                <br />
                <span className="text-gray-400 mt-1 block">Example: <code>lualatex --shell-escape my_psalm.tex</code></span>
              </div>
            )}
            <textarea 
              readOnly 
              className="w-full h-full p-4 bg-black text-[#8b8b8b] font-mono text-[11px] leading-relaxed resize-none focus:outline-none flex-1 selection:bg-[#c5a059] selection:text-black"
              value={lualatexOutput}
              placeholder="% Your generated LuaLaTeX output, alternating between Gregorian chant verses and LilyPond falsobordone, will render here..."
            />
          </div>
          </div>

        </div>

      </div>
    </div>
  );
}
