import type { GeneratedComponent, Provider } from '../types';

export const MAX_HISTORY = 20;

const PROVIDERS: Provider[] = ['anthropic', 'google'];

export function parseProvider(raw: unknown): Provider {
  if (PROVIDERS.includes(raw as Provider)) return raw as Provider;
  throw new Error('invalid provider');
}

export function parseApiKeys(raw: unknown): Record<Provider, string> {
  if (typeof raw !== 'object' || raw === null) throw new Error('invalid api keys');
  const obj = raw as Record<string, unknown>;
  return {
    anthropic: typeof obj.anthropic === 'string' ? obj.anthropic : '',
    google: typeof obj.google === 'string' ? obj.google : '',
  };
}

export function parseHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new Error('invalid history');
  return raw.filter((item): item is string => typeof item === 'string');
}

/** JSON으로 직렬화되어 문자열이 된 createdAt을 Date로 복원하고, 형식이 틀린 항목은 버린다. */
export function parseComponents(raw: unknown): GeneratedComponent[] {
  if (!Array.isArray(raw)) throw new Error('invalid components');
  const result: GeneratedComponent[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, prompt, code, createdAt } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof prompt !== 'string' || typeof code !== 'string') continue;
    if (typeof createdAt !== 'string') continue;
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) continue;
    result.push({ id, prompt, code, createdAt: date });
  }
  return result;
}

/** 새 프롬프트를 맨 앞에 넣고 중복은 제거하며 MAX_HISTORY개까지만 유지한다. */
export function addToHistory(history: string[], prompt: string): string[] {
  return [prompt, ...history.filter((item) => item !== prompt)].slice(0, MAX_HISTORY);
}
