import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';

const STORAGE_KEY = 'rcg:components';

afterEach(() => {
  vi.unstubAllGlobals();
});

function ndjsonResponse(events: object[], chunkSize = 7): Response {
  const encoded = new TextEncoder().encode(events.map((e) => JSON.stringify(e) + '\n').join(''));
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < encoded.length; i += chunkSize) {
        controller.enqueue(encoded.slice(i, i + chunkSize));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe('useComponentGenerator 스트리밍', () => {
  it('delta 이벤트가 오는 동안 streaming 상태에 코드가 누적된다', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode('{"type":"delta","text":"const A"}\n'));
        await gate;
        controller.enqueue(encoder.encode('{"type":"done","code":"const A = 1;"}\n'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const { result } = renderHook(() => useComponentGenerator());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.generate('카드', undefined, 'google');
    });

    await waitFor(() => expect(result.current.streaming).toEqual({ prompt: '카드', code: 'const A' }));

    release();
    await act(() => pending);
  });

  it('done 이벤트의 최종 코드로 컴포넌트를 추가하고 streaming을 비운다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ndjsonResponse([
          { type: 'delta', text: 'const A' },
          { type: 'done', code: 'const A = 1;\nrender(<A />);' },
        ]),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('카드', undefined, 'google'));

    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0]).toMatchObject({
      prompt: '카드',
      code: 'const A = 1;\nrender(<A />);',
    });
    expect(result.current.streaming).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('스트림 중 error 이벤트가 오면 에러를 설정하고 컴포넌트는 추가하지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ndjsonResponse([
          { type: 'delta', text: 'const A' },
          { type: 'error', error: '생성된 코드가 너무 길어 잘렸습니다.' },
        ]),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('카드', undefined, 'google'));

    expect(result.current.error).toBe('생성된 코드가 너무 길어 잘렸습니다.');
    expect(result.current.components).toHaveLength(0);
    expect(result.current.streaming).toBeNull();
  });

  it('스트림 시작 전 HTTP 에러는 응답 본문의 error 메시지를 보여준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'API key is required.' }), { status: 400 }),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('카드', undefined, 'google'));

    expect(result.current.error).toBe('API key is required.');
    expect(result.current.streaming).toBeNull();
  });

  it('이미 생성 중이면 새 generate 호출을 무시한다', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        await gate;
        controller.enqueue(encoder.encode('{"type":"done","code":"const A = 1;"}\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useComponentGenerator());

    let first!: Promise<void>;
    act(() => {
      first = result.current.generate('하나', undefined, 'google');
    });
    await act(() => result.current.generate('둘', undefined, 'google'));

    expect(fetchMock).toHaveBeenCalledTimes(1);

    release();
    await act(() => first);
    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0].prompt).toBe('하나');
  });

  it('done의 코드가 비어 있으면 컴포넌트를 추가하지 않고 에러로 처리한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(ndjsonResponse([{ type: 'done', code: '  ' }])),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('카드', undefined, 'google'));

    expect(result.current.components).toHaveLength(0);
    expect(result.current.error).toContain('비어');
  });

  it('JSON이 아닌 줄이 오면 한국어 에러로 처리한다', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('<html>Bad Gateway</html>\n'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('카드', undefined, 'google'));

    expect(result.current.error).toBe('서버 응답을 해석하지 못했습니다. 다시 시도해주세요.');
    expect(result.current.streaming).toBeNull();
  });

  it('done 없이 스트림이 끝나면 에러로 처리한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(ndjsonResponse([{ type: 'delta', text: 'const A' }])),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('카드', undefined, 'google'));

    expect(result.current.error).not.toBeNull();
    expect(result.current.components).toHaveLength(0);
  });
});

describe('useComponentGenerator 영속성', () => {
  it('저장된 컴포넌트 목록을 복원하고 createdAt을 Date로 만든다', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: '1', prompt: 'p', code: 'c', createdAt: '2026-01-01T00:00:00.000Z' }]),
    );
    const { result } = renderHook(() => useComponentGenerator());
    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0].createdAt).toBeInstanceOf(Date);
  });

  it('생성된 컴포넌트가 localStorage에 저장된다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(ndjsonResponse([{ type: 'done', code: 'const A = 1;' }])),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('카드', undefined, 'google'));

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ prompt: '카드', code: 'const A = 1;' });
    });
  });

  it('삭제와 전체 삭제도 저장소에 반영된다', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: '1', prompt: 'p', code: 'c', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: '2', prompt: 'q', code: 'd', createdAt: '2026-01-01T00:00:00.000Z' },
      ]),
    );
    const { result } = renderHook(() => useComponentGenerator());

    act(() => result.current.removeComponent('1'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveLength(1);

    act(() => result.current.clearAll());
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([]);
  });
});
