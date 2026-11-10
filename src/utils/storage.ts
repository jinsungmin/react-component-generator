/** localStorage에서 값을 읽는다. 없거나 깨졌거나 parse가 실패하면 fallback을 반환한다. */
export function readStorage<T>(key: string, parse: (raw: unknown) => T, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return parse(JSON.parse(stored));
  } catch {
    return fallback;
  }
}

/** localStorage에 JSON으로 저장한다. 용량 초과 등 실패는 무시한다. */
export function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패가 앱 동작을 막지 않도록 무시한다.
  }
}
