import { useState, useCallback, useRef } from 'react';
import { usePersistentState } from './usePersistentState';
import { parseComponents } from '../utils/persisted';
import { splitLines } from '../utils/ndjson';
import { stripStreamingFences } from '../utils/streamingCode';
import type { GeneratedComponent, Provider, StreamEvent, StreamingState } from '../types';

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  isLoading: boolean;
  streaming: StreamingState | null;
  error: string | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = usePersistentState<GeneratedComponent[]>(
    'rcg:components',
    [],
    parseComponents,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const inFlight = useRef(false);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    // 진행 중인 생성이 있으면 상태가 서로 덮어쓰이지 않도록 새 요청을 무시한다.
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    setError(null);
    setStreaming({ prompt, code: '' });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate component');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let raw = '';
      // handleLine 클로저에서 대입되므로 TS가 null로 좁히지 않도록 단언한다.
      let finalCode = null as string | null;

      const handleLine = (line: string) => {
        let event: StreamEvent;
        try {
          event = JSON.parse(line) as StreamEvent;
        } catch {
          throw new Error('서버 응답을 해석하지 못했습니다. 다시 시도해주세요.');
        }
        if (event.type === 'delta') {
          raw += event.text;
          setStreaming({ prompt, code: stripStreamingFences(raw) });
        } else if (event.type === 'done') {
          finalCode = event.code;
        } else if (event.type === 'error') {
          throw new Error(event.error);
        }
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const { lines, rest } = splitLines(buffer, decoder.decode(value, { stream: true }));
          buffer = rest;
          lines.forEach(handleLine);
        }
        if (buffer.trim()) handleLine(buffer);
      } finally {
        await reader.cancel().catch(() => {});
      }

      if (finalCode === null) {
        throw new Error('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
      }
      if (!finalCode.trim()) {
        throw new Error('생성된 코드가 비어 있습니다. 다시 시도해주세요.');
      }

      const newComponent: GeneratedComponent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        prompt,
        code: finalCode,
        createdAt: new Date(),
      };

      setComponents((prev) => [newComponent, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      inFlight.current = false;
      setStreaming(null);
      setIsLoading(false);
    }
  }, [setComponents]);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, [setComponents]);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, [setComponents]);

  return { components, isLoading, streaming, error, generate, removeComponent, clearAll };
}
