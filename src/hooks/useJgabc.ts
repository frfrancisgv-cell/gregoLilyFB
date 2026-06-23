import { useState, useEffect } from 'react';

export function useJgabc() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.hasOwnProperty('applyPsalmTone')) {
      setLoaded(true);
      return;
    }

    const init = async () => {
      try {
        (window as any).__mockLocalStorage = {};
        
        try {
            await import('../lib/psalmtone.js');
        } catch (e) {
            console.error("Failed to import psalmtone.js:", e);
        }
        
        setLoaded(true);
      } catch (err) {
        console.error('Failed to load jgabc dependencies', err);
      }
    };
    init();
  }, []);

  return loaded;
}

declare global {
  interface Window {
    __mockLocalStorage: any;
    applyPsalmTone: (options: any) => any;
    getPsalmTones: () => any;
  }
}
