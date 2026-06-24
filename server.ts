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

  // API route for LuaLaTeX compilation
  app.post("/api/lualatex-preview", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Missing LaTeX code." });
      }

      const tmpDir = os.tmpdir();
      const uniqueId = `luatex-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // We must extract \begin{gabccode}...\end{gabccode} and save to .gabc files
      // to avoid bugs between gregoriotex snippet macros and lyluatex.
      let gabcIndex = 0;
      let finalCode = code;
      const gabcRegex = /\\begin{gabccode}\s*([\s\S]*?)\s*\\end{gabccode}/g;
      
      let match;
      const gabcFilesToCompile = [];
      while ((match = gabcRegex.exec(code)) !== null) {
        gabcIndex++;
        const cleanGabc = match[1];
        const gabcContent = `name: snippet-${gabcIndex};\n%%\n${cleanGabc}`;
        const gabcBaseName = `${uniqueId}-${gabcIndex}`;
        const gabcFileName = `${gabcBaseName}.gabc`;
        const gabcPath = path.join(tmpDir, gabcFileName);
        
        await fs.promises.writeFile(gabcPath, gabcContent, "utf8");
        gabcFilesToCompile.push(gabcFileName);
        // Replace this block with \gregorioscore using the .gtex file (or no extension)
        finalCode = finalCode.replace(match[0], `\\gregorioscore{${gabcBaseName}.gtex}`);
      }

      const texFileName = `${uniqueId}.tex`;
      const texPath = path.join(tmpDir, texFileName);
      await fs.promises.writeFile(texPath, finalCode, "utf8");

      try {
        // Compile GABC files first
        for (const gabcFile of gabcFilesToCompile) {
          await execAsync(`gregorio ${gabcFile}`, { cwd: tmpDir });
        }

        // Run lualatex with shell-escape using relative path in its cwd
        await execAsync(`lualatex --shell-escape -interaction=nonstopmode ${texFileName}`, { cwd: tmpDir });
        
        const pdfPath = path.join(tmpDir, `${uniqueId}.pdf`);
        
        if (fs.existsSync(pdfPath)) {
          const pdfContent = await fs.promises.readFile(pdfPath);
          // Return the PDF as base64 so the client can display it in an iframe
          res.json({ pdfBase64: pdfContent.toString("base64") });
          fs.unlinkSync(pdfPath);
        } else {
          throw new Error("PDF file not generated.");
        }
      } catch (error: any) {
        console.error("LaTeX Compilation Error:");
        console.error(error.stdout);
        console.error(error.stderr);
        throw new Error(`Failed to compile LaTeX. Command failed: ${error.message}\nSTDOUT:\n${error.stdout}\nSTDERR:\n${error.stderr}`);
      } finally {
        if (fs.existsSync(texPath)) fs.unlinkSync(texPath);
        // Also clean up .aux and .log files
        const auxPath = path.join(tmpDir, `${uniqueId}.aux`);
        const logPath = path.join(tmpDir, `${uniqueId}.log`);
        const gauxPath = path.join(tmpDir, `${uniqueId}.gaux`);
        if (fs.existsSync(auxPath)) fs.unlinkSync(auxPath);
        if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
        if (fs.existsSync(gauxPath)) fs.unlinkSync(gauxPath);
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "Internal server error." });
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
