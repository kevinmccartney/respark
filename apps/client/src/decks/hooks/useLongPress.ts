import { useEffect, useState } from 'react';

export const useCoarsePointer = (): boolean => {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const sync = () => setCoarse(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return coarse;
};
