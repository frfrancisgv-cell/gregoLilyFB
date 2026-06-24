import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

export function LilyPondPreview({ code }: { code: string }) {
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch('/api/lilypond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code })
    })
    .then(res => res.json())
    .then(data => {
      if (!isMounted) return;
      if (data.error) {
        setError(data.error);
        setSvgUrl(null);
      } else if (data.pngBase64) {
        setSvgUrl(`data:image/png;base64,${data.pngBase64}`);
        setError(null);
      } else if (data.svg) {
        // Fallback for svg just in case
        const blob = new Blob([data.svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        setSvgUrl(url);
        setError(null);
      }
    })
    .catch(err => {
      if (!isMounted) return;
      setError("Network or server error.");
    })
    .finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [code]);

  if (loading) {
    return (
      <div className="flex-1 bg-[#fdfaf6] flex flex-col items-center justify-center p-6 gap-3">
         <Loader2 className="w-8 h-8 text-[#c5a059] animate-spin" />
         <p className="text-[#888] text-xs uppercase tracking-widest">Compiling LilyPond...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 bg-[#1a1a1a] p-6 flex flex-col items-center justify-center text-center gap-3">
         <AlertCircle className="w-8 h-8 text-red-500/80" />
         <p className="text-red-400 text-[10px] max-w-[250px] leading-relaxed break-words font-mono">
           {error}
         </p>
         <p className="text-[#666] text-[10px] max-w-[200px] mt-2 leading-relaxed">
           Make sure lilypond is installed on the host system.
         </p>
         <a 
           href="https://www.hacklily.org/" 
           target="_blank" 
           rel="noopener noreferrer"
           className="text-[#c5a059] hover:underline text-[10px] uppercase tracking-widest mt-2"
         >
           Preview via HackLily
         </a>
      </div>
    );
  }

  if (svgUrl) {
    return (
      <div className="flex-1 bg-[#fdfaf6] overflow-auto p-4 flex justify-center items-start">
         <img src={svgUrl} alt="LilyPond Render" className="max-w-full h-auto max-h-none" />
      </div>
    );
  }

  return null;
}
