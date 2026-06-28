export interface ConvertOptions {
    compressReciting?: boolean;
    compressStrophic?: boolean;
    forceBreak?: boolean;
    showBarlines?: boolean;
    hideStems?: boolean;
    transposeVal?: string;
    melodyVoice?: 'tenor' | 'alto';
    noHeader?: boolean;
}

const diatonicPitches = [
    "c,,", "d,,", "e,,", "f,,", "g,,", "a,,", "b,,",
    "c,", "d,", "e,", "f,", "g,", "a,", "b,",
    "c", "d", "e", "f", "g", "a", "b",
    "c'", "d'", "e'", "f'", "g'", "a'", "b'",
    "c''", "d''", "e''", "f''", "g''", "a''", "b''",
    "c'''", "d'''", "e'''", "f'''", "g'''", "a'''", "b'''"
];

function applyAccidentalToLilypond(pitchStr: string, accToken: string, force: boolean = false) {
    let match = pitchStr.match(/^([a-g])([\,\']*)$/);
    if (!match) return pitchStr;
    let n = match[1];
    let oct = match[2];
    let mod = "";
    if (accToken === 'is') mod = 'is';
    else if (accToken === 'es') {
        if (n === 'a' || n === 'e') mod = 's';
        else mod = 'es';
    }
    const forceChar = force ? "!" : "";
    return n + mod + oct + forceChar;
}

function charToNumericPos(char: string) {
    if (char >= 'a' && char <= 'm') return char.charCodeAt(0) - 97; 
    if (char >= '0' && char <= '9') return -1 - parseInt(char);
    return null;
}

function setLastNoteToHalf(voiceStr: string): string {
    if (!voiceStr) return "";
    let parts = voiceStr.trim().split(/\s+/);
    if (parts.length === 0) return "";
    let lastToken = parts[parts.length - 1];
    // Match pitch (a-g, accidentals, octaves), optional duration, and any trailing chars (like slurs/parens)
    const match = lastToken.match(/^([a-g](?:is|es|s)?[\',]*)((?:\d+\.?|\\breve)?)(.*)$/);
    if (match) {
        parts[parts.length - 1] = match[1] + "2" + match[3];
    }
    return parts.join(' ');
}

export function convertGabcToLilypond(text: string, options: ConvertOptions = {}) {
    const {
        compressReciting = true,
        compressStrophic = true,
        forceBreak = true,
        showBarlines = true,
        hideStems = false,
        transposeVal = 'c c',
        melodyVoice = 'tenor',
        noHeader = false
    } = options;

    let headerText = "", bodyText = text;
    if (text.includes('%%')) {
        let parts = text.split('%%');
        headerText = parts[0]; bodyText = parts[1];
    }

    // Ensure the GABC body ends with a finalis (::) if it doesn't already
    let trimmedBody = bodyText.trim();
    if (!trimmedBody.endsWith('(::)') && !trimmedBody.endsWith('::)')) {
        bodyText = bodyText + ' (::)';
    }

    let currentClef = 'c4'; 
    let clefMatch = bodyText.match(/\(([cf][1-4])\)/i);
    if (clefMatch) currentClef = clefMatch[1].toLowerCase();

    let type = currentClef.charAt(0);
    let line = parseInt(currentClef.charAt(1));
    let anchorPos = (line * 2) + 1; 
    let anchorPitchIndex = (type === 'c') ? 28 : 24; 

    let sopranoRecitingPitches: number[] = [];
    let altoRecitingPitches: number[] = [];

    // Pre-scan to check for transpositions
    let prePattern = /(?:([^()]+?))?\(([^)]+)\)/g;
    let preMatch;
    while ((preMatch = prePattern.exec(bodyText)) !== null) {
        let notation = preMatch[2].trim();
        let notationParts = notation.split(/\s+/);
        for (let partNotation of notationParts) {
            if ([':', '::', ';', ',', '+'].includes(partNotation) || partNotation.includes('z')) continue;
            if (/^[cf]b?[1-4]$/i.test(partNotation)) continue;

            let bracketMatches = [...partNotation.matchAll(/\{([^}]+)\}/g)];
            let mStr = partNotation.replace(/([a-zA-Z0-9][#xy]?)(?=\{)/gi, ''); 
            mStr = mStr.replace(/\{([^}]+)\}/g, '').trim(); 
            
            let sStr = "", aStr = "";
            if (bracketMatches.length === 0) { 
                sStr = aStr = mStr; 
            } else if (bracketMatches.length === 1) { 
                sStr = bracketMatches[0][1]; 
                aStr = mStr; 
            } else if (bracketMatches.length === 2) { 
                sStr = bracketMatches[0][1]; 
                aStr = mStr; 
            } else if (bracketMatches.length >= 3) {
                if (melodyVoice === 'alto') { 
                    sStr = bracketMatches[0][1]; 
                    aStr = mStr; 
                } else { 
                    sStr = bracketMatches[0][1]; 
                    aStr = bracketMatches[1][1]; 
                }
            }

            let checkReciting = (str: string, targetArray: number[]) => {
                if (str.toLowerCase().includes('r')) {
                    let s = str.replace(/[<>\.#xy!]/gi, '');
                    for (let char of s) {
                        let cLow = char.toLowerCase();
                        let posNum = charToNumericPos(cLow);
                        if (posNum === null) continue;
                        let pitchIdx = anchorPitchIndex + (posNum - anchorPos);
                        targetArray.push(pitchIdx);
                    }
                }
            };

            checkReciting(sStr, sopranoRecitingPitches);
            checkReciting(aStr, altoRecitingPitches);
        }
    }

    let transposeSopranoDownOctave = sopranoRecitingPitches.some(idx => idx > 31);
    let transposeAltoDownOctave = altoRecitingPitches.some(idx => idx > 28);

    let lilyTitle = "", lilySubtitle = "", lilyPiece = "";
    if (headerText) {
        let lines = headerText.split('\n');
        let meta: Record<string, string> = {};
        for (let line of lines) {
            let match = line.match(/^([\w-]+)\s*:\s*([^;]+)/);
            if (match) meta[match[1].toLowerCase()] = match[2].trim();
        }
        if (meta['user-notes']) lilyTitle = meta['user-notes'].replace(/\.$/, '');
        else if (meta['name']) lilyTitle = meta['name'];
        if (meta['name'] && meta['user-notes']) lilySubtitle = meta['name'];
        if (meta['annotation']) lilyPiece = "Tone " + meta['annotation'];
    }

    let events: any[] = [];
    const pattern = /(?:([^()]+?))?\(([^)]+)\)/g;
    let match;
    let firstNoteFound = false;
    let newWordForced = true;
    let activeAccidentals: Record<string, string> = {}; 

    while ((match = pattern.exec(bodyText)) !== null) {
        let rawWord = match[1] || "";
        let cleanWordWithSpaces = rawWord.replace(/<[^>]+>/g, '').replace(/\\greheightstar/g, '').replace(/[†\*]/g, '');
        let cleanWordTrimmed = cleanWordWithSpaces.trim();
        let notation = match[2].trim();

        // Split notation by whitespace to handle space-separated note groups on a single syllable
        let notationParts = notation.split(/\s+/);
        for (let idx = 0; idx < notationParts.length; idx++) {
            let partNotation = notationParts[idx];
            let partWord = idx === 0 ? cleanWordWithSpaces : "";
            let partWordTrimmed = idx === 0 ? cleanWordTrimmed : "";

            let accPattern = /([a-m0-9])([#xy])/gi;
            let accMatch;
            while ((accMatch = accPattern.exec(partNotation)) !== null) {
                let pos = accMatch[1].toLowerCase();
                activeAccidentals[pos] = accMatch[2].toLowerCase();
            }

            if (!partWordTrimmed && partNotation.includes('r')) continue; 

            if ([':', '::', ';', ',', '+'].includes(partNotation) || partNotation.includes('z')) {
                if (partWordTrimmed) {
                    for (let i = events.length - 1; i >= 0; i--) {
                        if (events[i].type === 'note') { events[i].text += partWord; break; }
                    }
                }
                events.push({ type: 'bar', notation: partNotation, text: partWordTrimmed });
                newWordForced = true; 
                activeAccidentals = {}; 
                continue;
            }

            if (/^[cf]b?[1-4]$/i.test(partNotation)) continue;

            let lowNot = partNotation.toLowerCase();
            let explicitG = lowNot.includes('g#');
            let explicitI = lowNot.includes('ix');
            let explicitF = lowNot.includes('f#');
            let explicitE = lowNot.includes('ex');

            if (explicitG) activeAccidentals.g = '#'; else if (lowNot.includes('g0')) delete activeAccidentals.g;
            if (explicitI) activeAccidentals.i = 'x'; else if (lowNot.includes('i0')) delete activeAccidentals.i; // Flat
            if (explicitF) activeAccidentals.f = '#'; else if (lowNot.includes('f0')) delete activeAccidentals.f;
            if (explicitE) activeAccidentals.e = 'x'; else if (lowNot.includes('e0')) delete activeAccidentals.e; // Flat

            let bracketMatches = [...partNotation.matchAll(/\{([^}]+)\}/g)];
            let mStr = partNotation.replace(/([a-zA-Z0-9][#xy]?)(?=\{)/gi, ''); 
            mStr = mStr.replace(/\{([^}]+)\}/g, '').trim(); 
            
            let sStr = "", aStr = "", tStr = "", bStr = "";
            
            if (bracketMatches.length === 0) { 
                sStr = aStr = tStr = bStr = mStr; 
            } else if (bracketMatches.length === 1) { 
                sStr = bracketMatches[0][1]; 
                aStr = tStr = bStr = mStr; 
            } else if (bracketMatches.length === 2) { 
                sStr = bracketMatches[0][1]; 
                bStr = bracketMatches[1][1]; 
                aStr = mStr; 
                tStr = mStr; 
            } else if (bracketMatches.length >= 3) {
                if (melodyVoice === 'alto') { 
                    sStr = bracketMatches[0][1]; 
                    tStr = bracketMatches[1][1]; 
                    bStr = bracketMatches[2][1]; 
                    aStr = mStr; 
                } else { 
                    sStr = bracketMatches[0][1]; 
                    aStr = bracketMatches[1][1]; 
                    bStr = bracketMatches[2][1]; 
                    tStr = mStr; 
                }
            }

            let applyClefPitch = (str: string, voiceType: string) => {
                let s = str.replace(/[<>\.#xy!]/gi, '');
                let res = [];
                for (let char of s) {
                    let cLow = char.toLowerCase();
                    let posNum = charToNumericPos(cLow);
                    if (posNum === null) continue;
                    
                    let pitchIdx = anchorPitchIndex + (posNum - anchorPos);

                    if (voiceType === 'S' && transposeSopranoDownOctave) {
                        pitchIdx -= 7;
                    } else if (voiceType === 'A' && transposeAltoDownOctave) {
                        pitchIdx -= 7;
                    }

                    if (voiceType === 'T' || voiceType === 'B') {
                        pitchIdx -= 7;
                    }

                    if (pitchIdx < 0) pitchIdx = 0;
                    if (pitchIdx >= diatonicPitches.length) pitchIdx = diatonicPitches.length - 1;
                    let p = diatonicPitches[pitchIdx];

                    let explicitRegex = new RegExp(char + "([#xy])", "i");
                    let expMatch = partNotation.match(explicitRegex);
                    
                    let accToApply = null;
                    let isExplicit = false;
                    if (expMatch) { 
                        accToApply = expMatch[1].toLowerCase(); 
                        isExplicit = true;
                    }
                    else if (activeAccidentals[cLow]) { 
                        accToApply = activeAccidentals[cLow]; 
                    }
                    
                    if (accToApply === '#') { p = applyAccidentalToLilypond(p, 'is', isExplicit); }
                    else if (accToApply === 'x') { p = applyAccidentalToLilypond(p, 'es', isExplicit); }
                    
                    res.push(p);
                }
                return res;
            };

            if (sStr || aStr || tStr || bStr) {
                let isSyl = false;
                if (partWord !== "" && !/^\s/.test(partWord) && !newWordForced) { if (firstNoteFound) isSyl = true; }
                firstNoteFound = true; newWordForced = false;

                let sArr = applyClefPitch(sStr, 'S'), aArr = applyClefPitch(aStr, 'A'), tArr = applyClefPitch(tStr, 'T'), bArr = applyClefPitch(bStr, 'B');
                let maxLen = Math.max(sArr.length, aArr.length, tArr.length, bArr.length);
                
                let applyDurAndSlur = (arr: any[]) => {
                    if (arr.length === 0) return "";
                    if (arr.length === 1) {
                        let dur = maxLen === 2 ? '2' : (maxLen === 3 ? '2.' : (maxLen === 4 ? '1' : '4'));
                        return arr[0] + dur;
                    } else {
                        let out = []; let extraBeats = maxLen - arr.length;
                        let firstDur = extraBeats === 1 ? '2' : (extraBeats === 2 ? '2.' : '4');
                        
                        for (let i = 0; i < arr.length; i++) {
                            let dur = (i === 0 && arr.length < maxLen) ? firstDur : '4';
                            let note = arr[i] + dur;
                            if (arr.length > 1) { if (i === 0) note += '('; if (i === arr.length - 1) note += ')'; }
                            out.push(note);
                        }
                        return out.join(' ');
                    }
                };

                events.push({
                    type: 'note', text: partWord, textTrimmed: partWordTrimmed, isSyllable: isSyl,
                    s: applyDurAndSlur(sArr), a: applyDurAndSlur(aArr), t: applyDurAndSlur(tArr), b: applyDurAndSlur(bArr)
                });
            }
        }
    }

    let groupedEvents = [];
    let currentGroup = [];

    for (let ev of events) {
        if (ev.type === 'bar') {
            if (currentGroup.length > 0) { groupedEvents.push({ type: 'note_group', notes: currentGroup }); currentGroup = []; }
            groupedEvents.push(ev);
        } else if (ev.type === 'note') {
            let hasSlur = ev.s.includes('(') || ev.a.includes('(') || ev.t.includes('(') || ev.b.includes('(');
            
            if (compressReciting && currentGroup.length > 0) {
                let first = currentGroup[0];
                let isIdentical = (ev.s === first.s && ev.a === first.a && ev.t === first.t && ev.b === first.b);
                let firstHasSlur = first.s.includes('(') || first.a.includes('(') || first.t.includes('(') || first.b.includes('(');
                
                if (isIdentical && !hasSlur && !firstHasSlur) { 
                    currentGroup.push(ev); 
                }
                else { 
                    groupedEvents.push({ type: 'note_group', notes: currentGroup }); 
                    currentGroup = [ev]; 
                }
            } else {
                if (currentGroup.length > 0) { groupedEvents.push({ type: 'note_group', notes: currentGroup }); }
                currentGroup = [ev];
            }
        }
    }
    if (currentGroup.length > 0) groupedEvents.push({ type: 'note_group', notes: currentGroup });

    let verses: any[] = [];
    let curVerse: any = { s: [], a: [], t: [], b: [], l: [] };

    for (let grp of groupedEvents) {
        let isVerseEnd = false;
        if (grp.type === 'bar') {
            if (grp.notation === ':' || grp.notation === '::') {
                if (curVerse.s.length > 0) {
                    let lastIdx = curVerse.s.length - 1;
                    if (lastIdx >= 0 && !curVerse.s[lastIdx].startsWith('\\bar')) {
                        curVerse.s[lastIdx] = setLastNoteToHalf(curVerse.s[lastIdx]);
                        curVerse.a[lastIdx] = setLastNoteToHalf(curVerse.a[lastIdx]);
                        curVerse.t[lastIdx] = setLastNoteToHalf(curVerse.t[lastIdx]);
                        curVerse.b[lastIdx] = setLastNoteToHalf(curVerse.b[lastIdx]);
                    }
                }
            }

            let bar = '';
            if (grp.notation === ':') {
                bar = '\\bar "|"';
                if (!forceBreak) bar += ''; // lineBreaks logic from user's implementation
                else bar += ' \\break';
            } else if (grp.notation === '::') {
                bar = '\\bar "||"';
                if (forceBreak) bar += ' \\break';
            } else if (grp.notation === ';') {
                bar = '\\bar "!"';
            } else if (grp.notation === '+' || grp.notation === ',') {
                bar = '\\bar "\'"';
            }
            
            if (grp.notation.includes('z')) { 
                if (!bar) bar = '\\bar ""'; 
                if (!bar.includes('\\break')) bar += ' \\break'; 
            }
            
            if (bar.trim()) { curVerse.s.push(bar.trim()); curVerse.a.push(bar.trim()); curVerse.t.push(bar.trim()); curVerse.b.push(bar.trim()); }
            if (grp.notation.includes('::')) isVerseEnd = true;
        } else if (grp.type === 'note_group') {
            let notes = grp.notes;
            let shouldCompress = compressReciting && notes.length >= 3;

            if (!shouldCompress) {
                for (let n of notes) {
                    if (n.s) curVerse.s.push(n.s); if (n.a) curVerse.a.push(n.a); if (n.t) curVerse.t.push(n.t); if (n.b) curVerse.b.push(n.b);
                    if (n.textTrimmed) {
                        if (n.isSyllable) curVerse.l.push('--');
                        let tokens = n.textTrimmed.split(/\s+/);
                        for (let t of tokens) { if (/^\d+\.$/.test(t)) curVerse.l.push(`\\set stanza = "${t}"`); else curVerse.l.push(`"${t}"`); }
                    } else { curVerse.l.push(`_`); }
                }
            } else {
                let n = notes[0];
                let sBase = n.s.replace(/\d+\.?/g, '').replace(/[\(\)]/g, '').replace(/!/g, '').trim();
                let aBase = n.a.replace(/\d+\.?/g, '').replace(/[\(\)]/g, '').replace(/!/g, '').trim();
                let tBase = n.t.replace(/\d+\.?/g, '').replace(/[\(\)]/g, '').replace(/!/g, '').trim();
                let bBase = n.b.replace(/\d+\.?/g, '').replace(/[\(\)]/g, '').replace(/!/g, '').trim();
                
                if (sBase) curVerse.s.push(`${sBase}\\breve`); if (aBase) curVerse.a.push(`${aBase}\\breve`);
                if (tBase) curVerse.t.push(`${tBase}\\breve`); if (bBase) curVerse.b.push(`${bBase}\\breve`);
                
                let combinedText = notes.map((x: any) => x.text).join('').replace(/"/g, '\\"').trim();
                if (combinedText) {
                    if (n.isSyllable) curVerse.l.push('--');
                    let m = combinedText.match(/^(\d+\.)\s+(.*)$/);
                    if (m) curVerse.l.push(`\\set stanza = "${m[1]}" \\once \\override LyricText.self-alignment-X = #LEFT "${m[2]}"`);
                    else curVerse.l.push(`\\once \\override LyricText.self-alignment-X = #LEFT "${combinedText}"`);
                } else curVerse.l.push(`_`);
            }
        }

        if (isVerseEnd) { verses.push(curVerse); curVerse = { s: [], a: [], t: [], b: [], l: [] }; }
    }
    if (curVerse.s.length > 0 || curVerse.l.length > 0) verses.push(curVerse);

    let formatCodeBlock = (lines: string[]) => lines.map((l, i) => `  % Segment ${i + 1}\n  ${l}`).join('\n\n');

    let layoutConfig = `\\context {\n      \\Staff\n      \\remove "Time_signature_engraver"\n    }`;
    if (hideStems) layoutConfig = `\\context {\n      \\Voice\n      \\omit Stem\n    }\n    ` + layoutConfig;
    if (!showBarlines) layoutConfig += `\n    \\context {\n      \\Score\n      \\override BarLine.transparent = ##t\n      \\override SpanBar.transparent = ##t\n    }`;
    else layoutConfig += `\n    \\context {\n      \\Score\n      \\override SpanBar.transparent = ##t\n    }`;

    let headerCode = "";
    if (!noHeader) {
        headerCode = `\\header {`;
        if (lilyTitle) headerCode += `\n  title = "${lilyTitle}"`;
        if (lilySubtitle) headerCode += `\n  subtitle = "${lilySubtitle}"`;
        if (lilyPiece) headerCode += `\n  piece = "${lilyPiece}"`;
        headerCode += `\n  tagline = ##f\n}\n\n`;
    }

    let tPrefix = transposeVal !== "c c" ? `\\transpose ${transposeVal} ` : "";

    let finalOutput = `\\version "2.24.0"\n\n${headerCode}global = {\n  \\key c \\major\n  \\cadenzaOn\n  \\accidentalStyle default\n}\n`;

    if (compressStrophic && verses.length > 0) {
        let uniqueMusic: any[] = [];
        let verseSequence: any[] = [];
        let allLyrics: string[] = [];

        verses.forEach((v) => {
            let sMusic = v.s.join(' ').trim();
            let aMusic = v.a.join(' ').trim();
            let tMusic = v.t.join(' ').trim();
            let bMusic = v.b.join(' ').trim();
            let lyric = v.l.join(' ').trim();

            if (!sMusic && !lyric) return;
            if (lyric) { allLyrics.push("% Verse\n  " + lyric); }

            if (sMusic) {
                let signature = sMusic + "|" + aMusic + "|" + tMusic + "|" + bMusic;
                let existing = uniqueMusic.find(u => u.signature === signature);
                if (existing) { verseSequence.push(existing.id); } 
                else {
                    let newId = String.fromCharCode(65 + (uniqueMusic.length % 26)).repeat(Math.floor(uniqueMusic.length / 26) + 1);
                    uniqueMusic.push({ id: newId, signature, s: sMusic, a: aMusic, t: tMusic, b: bMusic });
                    verseSequence.push(newId);
                }
            }
        });

        let segmentVars = "";
        uniqueMusic.forEach(sec => {
            segmentVars += `% --- MUSICAL SEGMENT ${sec.id} ---\n`;
            segmentVars += `soprano${sec.id} = { ${sec.s} }\n`;
            segmentVars += `alto${sec.id} = { ${sec.a} }\n`;
            segmentVars += `tenor${sec.id} = { ${sec.t} }\n`;
            segmentVars += `bass${sec.id} = { ${sec.b} }\n\n`;
        });

        let seqS = verseSequence.map(id => `\\soprano${id}`).join('\n  ');
        let seqA = verseSequence.map(id => `\\alto${id}`).join('\n  ');
        let seqT = verseSequence.map(id => `\\tenor${id}`).join('\n  ');
        let seqB = verseSequence.map(id => `\\bass${id}`).join('\n  ');

        finalOutput += `
${segmentVars}
soprano = \\absolute {
  \\global
  ${seqS}
}

alto = \\absolute {
  \\global
  ${seqA}
}

tenor = \\absolute {
  \\global
  \\clef "treble_8"
  ${seqT}
}

bass = \\absolute {
  \\global
  \\clef "bass"
  ${seqB}
}

verse = \\lyricmode {
  ${allLyrics.join('\n\n  ')}
}

\\score {
  \\new ChoirStaff <<
    \\new Staff \\with { instrumentName = "S" } <<
      \\new Voice = "soprano" { ${tPrefix}\\soprano }
    >>
    \\new Lyrics \\lyricsto "soprano" \\verse
    
    \\new Staff \\with { instrumentName = "A" } <<
      \\new Voice = "alto" { ${tPrefix}\\alto }
    >>
    \\new Lyrics \\lyricsto "alto" \\verse
    
    \\new Staff \\with { instrumentName = "T" } <<
      \\new Voice = "tenor" { ${tPrefix}\\tenor }
    >>
    \\new Lyrics \\lyricsto "tenor" \\verse
    
    \\new Staff \\with { instrumentName = "B" } <<
      \\new Voice = "bass" { ${tPrefix}\\bass }
    >>
    \\new Lyrics \\lyricsto "bass" \\verse
  >>
  \\layout {
    ${layoutConfig}
  }
}`;
    } else {
        let sLines: string[] = [], aLines: string[] = [], tLines: string[] = [], bLines: string[] = [], lLines: string[] = [];
        verses.forEach(v => {
            if (v.s.length > 0) { sLines.push(v.s.join(' ')); aLines.push(v.a.join(' ')); tLines.push(v.t.join(' ')); bLines.push(v.b.join(' ')); }
            if (v.l.length > 0) lLines.push(v.l.join(' '));
        });

        finalOutput += `
soprano = \\absolute {
  \\global
${formatCodeBlock(sLines)}
}

alto = \\absolute {
  \\global
${formatCodeBlock(aLines)}
}

tenor = \\absolute {
  \\global
  \\clef "treble_8"
${formatCodeBlock(tLines)}
}

bass = \\absolute {
  \\global
  \\clef "bass"
${formatCodeBlock(bLines)}
}

verse = \\lyricmode {
${formatCodeBlock(lLines)}
}

\\score {
  \\new ChoirStaff <<
    \\new Staff \\with { instrumentName = "S" } <<
      \\new Voice = "soprano" { ${tPrefix}\\soprano }
    >>
    \\new Lyrics \\lyricsto "soprano" \\verse
    
    \\new Staff \\with { instrumentName = "A" } <<
      \\new Voice = "alto" { ${tPrefix}\\alto }
    >>
    \\new Lyrics \\lyricsto "alto" \\verse
    
    \\new Staff \\with { instrumentName = "T" } <<
      \\new Voice = "tenor" { ${tPrefix}\\tenor }
    >>
    \\new Lyrics \\lyricsto "tenor" \\verse
    
    \\new Staff \\with { instrumentName = "B" } <<
      \\new Voice = "bass" { ${tPrefix}\\bass }
    >>
    \\new Lyrics \\lyricsto "bass" \\verse
  >>
  \\layout {
    ${layoutConfig}
  }
}`;
    }

    return finalOutput.trim();
}
