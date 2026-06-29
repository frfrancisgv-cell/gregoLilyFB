import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3003", 10);

  app.use(express.json());

  // API route for LilyPond
  app.post("/api/lilypond", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Missing LilyPond code." });
      }

      // We need to wrap the snippet so it generates a proper SVG/PNG without huge margins
      // The user wants visual rendering.
      const wrappedCode = `
#(ly:set-option 'crop #t)
\\version "2.24.1"
\\paper {
  indent = 0\\mm
  short-indent = 0\\mm
  ragged-right = ##t
  print-page-number = ##f
  system-system-spacing.basic-distance = #8
}
${code}
`;

      const tmpDir = os.tmpdir();
      const uniqueId = `lily_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const lyPath = path.join(tmpDir, `${uniqueId}.ly`);
      
      await fs.promises.writeFile(lyPath, wrappedCode, "utf8");

      try {
        // Run LilyPond with PNG and explicit crop flag
        await execAsync(`lilypond -fpng -dcrop -dresolution=300 -o ${path.join(tmpDir, uniqueId)} ${lyPath}`);
        
        // Read the resulting PNG (preferring the cropped png)
        const croppedPath = path.join(tmpDir, `${uniqueId}.cropped.png`);
        const pngPath = path.join(tmpDir, `${uniqueId}.png`);
        
        if (fs.existsSync(croppedPath)) {
          const pngContent = await fs.promises.readFile(croppedPath);
          res.json({ pngBase64: pngContent.toString("base64") });
          // Cleanup all files
          fs.unlinkSync(croppedPath);
          if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
        } else if (fs.existsSync(pngPath)) {
          const pngContent = await fs.promises.readFile(pngPath);
          res.json({ pngBase64: pngContent.toString("base64") });
          fs.unlinkSync(pngPath);
        } else {
            // Might have generated multiple PNGs if there are multiple pages
            const firstPagePath = path.join(tmpDir, `${uniqueId}-1.png`);
            if (fs.existsSync(firstPagePath)) {
                const pngContent = await fs.promises.readFile(firstPagePath);
                res.json({ pngBase64: pngContent.toString("base64") });
                fs.unlinkSync(firstPagePath);
            } else {
                throw new Error("PNG file not generated.");
            }
        }
      } catch (err: any) {
        console.error("LilyPond execution error:", err);
        // It could be that lilypond is not installed in the current environment
        res.status(500).json({ error: "Failed to compile LilyPond. " + (err.stderr || err.message) });
      } finally {
        if (fs.existsSync(lyPath)) fs.unlinkSync(lyPath);
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Internal server error." });
    }
  });

  const tonesFilePath = path.join(process.cwd(), "gabc-polyphonic-tones.txt");

  app.get("/api/polyphonic-tones", async (req, res) => {
    try {
      if (!fs.existsSync(tonesFilePath)) {
        return res.json([]);
      }
      const content = await fs.promises.readFile(tonesFilePath, "utf8");
      
      const blocks = content.split(/\n\s*\n/);
      const tones = [];
      for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0 && l !== '.');
        if (lines.length === 0) continue;
        
        const firstLine = lines[0];
        const colonIndex = firstLine.indexOf(':');
        if (colonIndex !== -1) {
          const name = firstLine.substring(0, colonIndex).trim();
          const firstGabc = firstLine.substring(colonIndex + 1).trim();
          const restGabc = lines.slice(1).join('\n');
          tones.push({
            name,
            gabc: firstGabc + (restGabc ? '\n' + restGabc : '')
          });
        }
      }
      res.json(tones);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to read polyphonic tones file." });
    }
  });

  app.post("/api/polyphonic-tones", async (req, res) => {
    try {
      const { name, gabc } = req.body;
      if (!name || !gabc) {
        return res.status(400).json({ error: "Missing name or gabc." });
      }

      let currentContent = "";
      if (fs.existsSync(tonesFilePath)) {
        currentContent = await fs.promises.readFile(tonesFilePath, "utf8");
      }

      const cleanGabc = gabc.trim();
      const formattedEntry = `\n\n${name}: ${cleanGabc}`;
      
      let newContent = currentContent;
      const trimmed = newContent.trim();
      if (trimmed.endsWith('.')) {
        const lastDotIdx = newContent.lastIndexOf('.');
        newContent = newContent.substring(0, lastDotIdx) + formattedEntry + '\n\n.\n';
      } else {
        newContent = newContent + formattedEntry + '\n';
      }

      await fs.promises.writeFile(tonesFilePath, newContent, "utf8");
      res.json({ success: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to save polyphonic tone." });
    }
  });

  // Mutex queue to prevent concurrent LuaLaTeX runs from conflicting and ensure cache reuse
  let compileQueue = Promise.resolve();

  // API route for LuaLaTeX compilation
  app.post("/api/lualatex-preview", async (req, res) => {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Missing LaTeX code." });
    }

    compileQueue = compileQueue.then(async () => {
      const buildDir = "/tmp/gregolily-build";
      const pdfPath = path.join(buildDir, "document.pdf");
      try {
        await fs.promises.mkdir(buildDir, { recursive: true });

        // Delete any existing PDF to prevent returning stale files from previous failed runs
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }

        // Extract \begin{gabccode}...\end{gabccode} and save to stable .gabc files
        let gabcIndex = 0;
        let finalCode = code;
        const gabcRegex = /\\begin{gabccode}\s*([\s\S]*?)\s*\\end{gabccode}/g;
        
        let match;
        const gabcFilesToCompile = [];
        while ((match = gabcRegex.exec(code)) !== null) {
          gabcIndex++;
          const cleanGabc = match[1];
          // Prepend snippet name header correctly
          let gabcContent = "";
          if (cleanGabc.includes('%%')) {
            gabcContent = `name: snippet-${gabcIndex};\n${cleanGabc}`;
          } else {
            gabcContent = `name: snippet-${gabcIndex};\n%%\n${cleanGabc}`;
          }
          const gabcBaseName = `snippet-${gabcIndex}`;
          const gabcFileName = `${gabcBaseName}.gabc`;
          const gabcPath = path.join(buildDir, gabcFileName);
          
          await fs.promises.writeFile(gabcPath, gabcContent, "utf8");
          gabcFilesToCompile.push(gabcFileName);
          // Replace this block with \gregorioscore using the stable .gtex file (or no extension)
          finalCode = finalCode.replace(match[0], `\\gregorioscore{${gabcBaseName}.gtex}`);
        }

        const texFileName = "document.tex";
        const texPath = path.join(buildDir, texFileName);
        await fs.promises.writeFile(texPath, finalCode, "utf8");

        // Compile GABC files first
        for (const gabcFile of gabcFilesToCompile) {
          await execAsync(`gregorio ${gabcFile}`, { cwd: buildDir });
        }

        // Run lualatex with shell-escape using relative path in stable build cwd
        try {
          await execAsync(`lualatex --shell-escape -interaction=nonstopmode ${texFileName}`, { cwd: buildDir });
        } catch (lualatexError: any) {
          // LuaLaTeX often returns a non-zero exit code due to warnings
          // If the PDF exists, we can ignore the error.
          if (!fs.existsSync(pdfPath)) {
            throw lualatexError;
          }
        }
        
        if (fs.existsSync(pdfPath)) {
          const pdfContent = await fs.promises.readFile(pdfPath);
          res.json({ pdfBase64: pdfContent.toString("base64") });
        } else {
          throw new Error("PDF file not generated.");
        }
      } catch (error: any) {
        console.error("LaTeX Compilation Error:");
        console.error(error.stdout || error.message);
        console.error(error.stderr);
        if (!res.headersSent) {
          res.status(500).json({ 
            error: `Failed to compile LaTeX. Command failed: ${error.message}\nSTDOUT:\n${error.stdout}\nSTDERR:\n${error.stderr}` 
          });
        }
      }
    }).catch(err => {
      console.error("Queue execution error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Internal server error." });
      }
    });
  });

  // GregoBase chant lookup endpoint
  // Lazily parsed from gregobase_online.sql and cached in memory
  let gregobaseCache: Array<{id: number, incipit: string, officePart: string, mode: string, modeVar: string, gabc: string, version: string}> | null = null;

  async function loadGregobase() {
    if (gregobaseCache) return gregobaseCache;
    const sqlPath = path.join(process.cwd(), 'gregobase_online.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error('gregobase_online.sql not found');
    }
    const sql = await fs.promises.readFile(sqlPath, 'utf8');
    const results: typeof gregobaseCache = [];

    const insertIdx = sql.indexOf("INSERT INTO `gregobase_chants`");
    if (insertIdx === -1) { gregobaseCache = results; return results; }

    // Helper to unescape SQL escape sequences (used for all SQL string fields)
    function unesc(s: string): string {
      return s
        .replace(/\\'/g, "'").replace(/\\\\/g, '\\').replace(/\\"/g, '"');
    }

    // Helper: read a single-quoted SQL string starting at `pos` (the quote char position)
    // Returns { text, nextPos } where nextPos is the char after the closing quote
    function readStr(pos: number): { text: string, nextPos: number } | null {
      if (sql[pos] !== "'") return null;
      let i = pos + 1, out = '';
      while (i < sql.length) {
        const c = sql[i];
        if (c === '\\') { out += c + (sql[i+1] || ''); i += 2; }
        else if (c === "'") {
          if (sql[i+1] === "'") { out += "''"; i += 2; }
          else return { text: unesc(out), nextPos: i + 1 };
        } else { out += c; i++; }
      }
      return null;
    }

    // Advance past N comma-separated SQL values starting at `pos`
    // Returns new position after skipping N values
    function skipFields(pos: number, n: number): number {
      for (let i = 0; i < n && pos < sql.length; i++) {
        // skip whitespace / newlines
        while (pos < sql.length && /[ \t\r\n]/.test(sql[pos])) pos++;
        if (sql[pos] === ',') pos++; // skip comma from previous field
        while (pos < sql.length && /[ \t\r\n]/.test(sql[pos])) pos++;

        if (sql[pos] === ')') return pos; // end of row

        if (sql.slice(pos, pos + 4) === 'NULL') {
          pos += 4;
        } else if (sql[pos] === "'") {
          const r = readStr(pos);
          if (r) pos = r.nextPos;
          else { // skip broken string
            while (pos < sql.length && sql[pos] !== ',' && sql[pos] !== ')') pos++;
          }
        } else {
          // numeric
          while (pos < sql.length && sql[pos] !== ',' && sql[pos] !== ')' && sql[pos] !== '\n') pos++;
        }
      }
      return pos;
    }

    // Regex to match the first 8 fields of each row (the ones we know work):
    // (id, cantus_id, version, incipit, initial, office_part, mode, mode_var, ...)
    // Fields are 0-based. We capture: 0=id, 3=incipit, 5=office_part, 6=mode, 7=mode_var
    const rowRegex = /^\((\d+),\s*(NULL|'(?:[^'\\]|\\.)*'),\s*('(?:[^'\\]|\\.)*'|NULL),\s*('(?:[^'\\]|\\.)*'|NULL),\s*\d+,\s*('(?:[^'\\]|\\.)*'|NULL),\s*('(?:[^'\\]|\\.)*'|NULL),\s*('(?:[^'\\]|\\.)*'|NULL)/gm;
    rowRegex.lastIndex = insertIdx;

    let m: RegExpExecArray | null;
    while ((m = rowRegex.exec(sql)) !== null) {
      const id = parseInt(m[1], 10);
      const version = m[3] === 'NULL' ? '' : unesc(m[3].slice(1, -1)).trim();
      const incipit = m[4] === 'NULL' ? '' : unesc(m[4].slice(1, -1)).trim();
      const officePart = m[5] === 'NULL' ? '' : unesc(m[5].slice(1, -1)).toLowerCase().trim();
      const mode = m[6] === 'NULL' ? '' : unesc(m[6].slice(1, -1)).trim();
      const modeVar = m[7] === 'NULL' ? '' : unesc(m[7].slice(1, -1)).trim();

      if (!incipit) continue;

      // Now find the GABC field (field 11 = index 11)
      // We are after 8 fields (0-7). Skip fields 8, 9, 10 (author, created, updated)
      // Field 8 starts right after m[0] ends
      let pos = m.index + m[0].length;
      // Skip 3 more commas+fields (8=author, 9=created, 10=updated) to reach field 11
      pos = skipFields(pos, 3);
      
      // Now read the GABC field (field 11)
      // skip whitespace, then comma
      while (pos < sql.length && /[ \t\r\n]/.test(sql[pos])) pos++;
      if (sql[pos] === ',') pos++;
      while (pos < sql.length && /[ \t\r\n]/.test(sql[pos])) pos++;

      let gabc = '';
      if (sql[pos] === "'") {
        const r = readStr(pos);
        if (r) gabc = r.text;
      }
      
      // The GABC may be wrapped in double-quotes: "(c4)..."
      gabc = gabc.trim();
      
      if (gabc.startsWith('[')) {
        try {
          // Unescape inner quotes that might have been escaped in SQL
          let cleanJson = gabc;
          if (cleanJson.startsWith('"[') && cleanJson.endsWith(']"')) {
             cleanJson = cleanJson.slice(1, -1);
          }
          // Some records have escaped backslashes or quotes inside the JSON string
          const parsed = JSON.parse(cleanJson);
          if (Array.isArray(parsed)) {
            const gabcItem = parsed.find((item: any) => Array.isArray(item) && item[0] === 'gabc');
            if (gabcItem && gabcItem[1]) {
              gabc = gabcItem[1];
            }
          }
        } catch (e) {
          // If JSON parsing fails, we'll try to extract it via regex
          const match = gabc.match(/"gabc"\s*,\s*"((?:[^"\\]|\\.)*)"/);
          if (match) {
            gabc = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          } else {
            // fallback to stripping outer quotes
            gabc = gabc.replace(/^"+|"+$/g, '').trim();
          }
        }
      } else {
        gabc = gabc.replace(/^"+|"+$/g, '').trim();
      }

      // Unescape any leftover Unicode sequences (e.g. \u00e9) in plain strings or fallback regex
      gabc = gabc.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

      results!.push({ id, incipit, officePart, mode, modeVar, gabc, version });
    }

    gregobaseCache = results;
    console.log(`GregoBase loaded: ${results.length} chants`);
    return results;
  }


  app.get('/api/gregobase-chant', async (req, res) => {
    try {
      const db = await loadGregobase();
      const { id, incipit, type } = req.query as Record<string, string>;

      let match: typeof db[0] | undefined;
      let candidates: typeof db | undefined;

      if (id) {
        match = db.find(c => c.id === parseInt(id));
      } else if (incipit) {
        // Normalize: remove parenthesized metadata, remove diacritics, lowercase, strip punctuation
        const norm = (s: string) => s.replace(/\([^)]+\)/g, '').toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z\s]/g, '').trim();
        const needle = norm(incipit);
        // First try to match by office-part (in=Introit, of=Offertory, co=Communion)
        const partMap: Record<string, string> = { 'Introit': 'in', 'Offertory': 'of', 'Communion': 'co', 'Gradual': 'gr', 'Alleluia': 'al', 'Tract': 'tr' };
        const targetPart = type ? partMap[type] || '' : '';

        // Gather all candidates (exact matches and prefix matches in both directions)
        const exactMatches = db.filter(c => norm(c.incipit) === needle);
        const prefixMatches = db.filter(c => {
          const incNorm = norm(c.incipit);
          return incNorm !== '' && (incNorm.startsWith(needle) || needle.startsWith(incNorm));
        });

        // Combine and deduplicate candidates by ID, filtering for compatibility
        const candidatesMap = new Map<number, typeof db[0]>();
        for (const c of [...exactMatches, ...prefixMatches]) {
          const op = c.officePart.toLowerCase();
          const isCompatible = !targetPart || op === targetPart || op === 'an';
          if (isCompatible) {
            candidatesMap.set(c.id, c);
          }
        }
        candidates = Array.from(candidatesMap.values());

        // If still no candidates, fallback to word match (with compatibility check)
        if (candidates.length === 0) {
          const words = needle.split(/\s+/).slice(0, 2);
          candidates = db.filter(c => {
            const incNorm = norm(c.incipit);
            const op = c.officePart.toLowerCase();
            const isCompatible = !targetPart || op === targetPart || op === 'an';
            return isCompatible && words.every(w => incNorm.includes(w));
          });
        }

        // Score and sort candidates
        if (candidates.length > 0) {
          candidates.sort((a, b) => {
            const getScore = (c: typeof db[0]) => {
              let score = 0;
              const ver = c.version.toLowerCase();
              const op = c.officePart.toLowerCase();

              // Prioritize correct office part (high priority as requested by user)
              if (targetPart && op === targetPart) {
                score += 25;
              }

              // Prioritize Solesmes versions
              if (ver.includes('solesmes')) {
                score += 10;
              }
              
              // Heavily penalize 'salmodia' simplified versions to avoid psalm tones
              if (ver.includes('salmodia')) {
                score -= 30;
              }
              
              // Penalize Palmer & Burgess (English) versions
              if (ver.includes('palmer')) {
                score -= 10;
              }
              
              // Slight penalization for Simplex
              if (ver.includes('simplex')) {
                score -= 2;
              }

              return score;
            };

            return getScore(b) - getScore(a);
          });

          match = candidates[0];
        }
      }

      if (!match) {
        return res.status(404).json({ error: 'Chant not found', id, incipit, type });
      }

      res.json({
        match: {
          id: match.id,
          incipit: match.incipit,
          officePart: match.officePart,
          mode: match.mode,
          modeVar: match.modeVar,
          gabc: match.gabc,
          version: match.version
        },
        candidates: (typeof candidates !== 'undefined' && candidates) ? candidates.map(c => ({
          id: c.id,
          incipit: c.incipit,
          officePart: c.officePart,
          mode: c.mode,
          modeVar: c.modeVar,
          version: c.version
        })) : []
      });
    } catch (err: any) {
      console.error('GregoBase lookup error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
