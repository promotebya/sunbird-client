import { useEffect, useState } from 'react';

// Web shim: default export so you can `import useColorScheme from './hooks/useColorScheme'`
export default function useColorScheme(): 'light' | 'dark' {
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Guard for SSR / older browsers
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setScheme(mql.matches ? 'dark' : 'light');

    update(); // set initial value after mount

    // Add/remove listener (supports old and new APIs)
    if (mql.addEventListener) mql.addEventListener('change', update);
    else mql.addListener(update);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', update);
      else mql.removeListener(update);
    };
  }, []);

  return scheme;
}
