import { describe, it, expect, vi, afterEach } from 'vitest';
import { withTimeout } from './abort';

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('원본 시그널이 abort되면 결과 시그널도 abort된다', () => {
    const source = new AbortController();
    const signal = withTimeout(source.signal, 1000);

    source.abort();

    expect(signal.aborted).toBe(true);
  });

  it('제한 시간이 지나면 TimeoutError로 abort된다', () => {
    vi.useFakeTimers();
    const signal = withTimeout(new AbortController().signal, 1000);

    vi.advanceTimersByTime(1000);

    expect(signal.aborted).toBe(true);
    expect((signal.reason as DOMException).name).toBe('TimeoutError');
  });

  it('제한 시간 전에는 abort되지 않는다', () => {
    vi.useFakeTimers();
    const signal = withTimeout(new AbortController().signal, 1000);

    vi.advanceTimersByTime(999);

    expect(signal.aborted).toBe(false);
  });
});
