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
  const PORT = 3000;

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
        // Run LilyPond
        // Use --png and -dresolution=300 for high quality
        // Or -dbackend=svg for SVG
        await execAsync(`lilypond -dbackend=svg -dresolution=300 -o ${path.join(tmpDir, uniqueId)} ${lyPath}`);
        
        // Read the resulting SVG
        const svgPath = path.join(tmpDir, `${uniqueId}.svg`);
        
        if (fs.existsSync(svgPath)) {
          const svgContent = await fs.promises.readFile(svgPath, "utf8");
          res.json({ svg: svgContent });
          // Cleanup
          fs.unlinkSync(svgPath);
        } else {
            // Might have generated multiple SVGs if there are multiple pages
            const firstPagePath = path.join(tmpDir, `${uniqueId}-1.svg`);
            if (fs.existsSync(firstPagePath)) {
                const svgContent = await fs.promises.readFile(firstPagePath, "utf8");
                res.json({ svg: svgContent });
                fs.unlinkSync(firstPagePath);
            } else {
                throw new Error("SVG file not generated.");
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
