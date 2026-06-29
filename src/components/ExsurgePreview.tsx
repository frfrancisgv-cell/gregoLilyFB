import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import * as exsurge from 'exsurge';

export function ExsurgePreview({ gabc }: { gabc: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !gabc) return;
    try {
      let cleanedGabc = gabc.replace(/<\/?(?:v|b|i)[^>]*>/gi, '');

      // Strip <v> and </v> tags which are used by Gregorio for spacing but not supported/needed in Exsurge
      cleanedGabc = cleanedGabc.replace(/<\/?v>/gi, '');

      const ctxt = new exsurge.ChantContext();
      const mappings = exsurge.Gabc.createMappingsFromSource(ctxt, cleanedGabc);
      const score = new exsurge.ChantScore(ctxt, mappings, true);
      
      score.performLayoutAsync(ctxt, () => {
        score.layoutChantLines(ctxt, containerRef.current!.clientWidth || 800, () => {
          if (containerRef.current) {
            let svgStr = score.createSvg(ctxt);
            svgStr = svgStr.replace(/width="-Infinity"/g, 'width="100%"').replace(/height="-Infinity"/g, 'height="100%"');
            containerRef.current.innerHTML = svgStr;
          }
        });
      });
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, [gabc]);

  return (
    <div className="exsurge-container w-full h-full flex items-center justify-center">
      {error && <div className="text-red-500 text-xs text-center">{error}</div>}
      <div ref={containerRef} />
    </div>
  );
}
