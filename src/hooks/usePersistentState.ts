import { useState, useEffect } from 'react';
import { readStorage, writeStorage } from '../utils/storage';

/** useState와 같지만 값을 localStorage에 저장하고, 마운트 시 parse로 검증해 복원한다. */
export function usePersistentState<T>(key: string, initial: T, parse: (raw: unknown) => T) {
  const [value, setValue] = useState<T>(() => readStorage(key, parse, initial));

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
