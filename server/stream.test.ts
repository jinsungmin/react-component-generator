import { describe, it, expect } from 'vitest';
import { UserFacingError } from './errors';
import {
  parseSseChunk,
  extractAnthropicDelta,
  extractGeminiDelta,
  readDeltas,
  createNdjsonBody,
} from './stream';

describe('parseSseChunk', () => {
  it('완결된 이벤트의 data 페이로드를 추출한다', () => {
    const { payloads, rest } = parseSseChunk('', 'data: {"a":1}\n\ndata: {"a":2}\n\n');
    expect(payloads).toEqual(['{"a":1}', '{"a":2}']);
    expect(rest).toBe('');
  });

  it('끝나지 않은 이벤트는 rest로 남기고 다음 청크와 이어 붙인다', () => {
    const first = parseSseChunk('', 'data: {"a":');
    expect(first.payloads).toEqual([]);

    const second = parseSseChunk(first.rest, '1}\n\n');
    expect(second.payloads).toEqual(['{"a":1}']);
  });

  it('event: 줄은 무시하고 data만 가져온다', () => {
    const { payloads } = parseSseChunk('', 'event: content_block_delta\ndata: {"x":1}\n\n');
    expect(payloads).toEqual(['{"x":1}']);
  });

  it('CRLF 구분자도 처리한다', () => {
    const { payloads } = parseSseChunk('', 'data: {"a":1}\r\n\r\n');
    expect(payloads).toEqual(['{"a":1}']);
  });
});

describe('extractAnthropicDelta', () => {
  it('content_block_delta의 text를 반환한다', () => {
    const payload = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'const A' },
    });
    expect(extractAnthropicDelta(payload)).toBe('const A');
  });

  it('텍스트 델타가 아닌 이벤트는 빈 문자열을 반환한다', () => {
    expect(extractAnthropicDelta(JSON.stringify({ type: 'message_start' }))).toBe('');
  });

  it('max_tokens로 끝나면 잘림 에러를 던진다', () => {
    const payload = JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'max_tokens' },
    });
    expect(() => extractAnthropicDelta(payload)).toThrow('너무 길어');
  });

  it('error 이벤트는 업스트림 에러로 던진다', () => {
    const payload = JSON.stringify({ type: 'error', error: { type: 'overloaded_error' } });
    expect(() => extractAnthropicDelta(payload)).toThrow('Claude API error');
  });
});

describe('extractGeminiDelta', () => {
  it('candidates의 parts 텍스트를 이어 붙여 반환한다', () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'const ' }, { text: 'B' }] } }],
    });
    expect(extractGeminiDelta(payload)).toBe('const B');
  });

  it('텍스트가 없으면 빈 문자열을 반환한다', () => {
    expect(extractGeminiDelta(JSON.stringify({ candidates: [{}] }))).toBe('');
  });

  it('finishReason이 MAX_TOKENS면 잘림 에러를 던진다', () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }],
    });
    expect(() => extractGeminiDelta(payload)).toThrow('너무 길어');
  });

  it('잘림 에러는 사용자에게 그대로 보여줄 수 있는 UserFacingError다', () => {
    const anthropic = JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'max_tokens' } });
    const gemini = JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] });

    expect(() => extractAnthropicDelta(anthropic)).toThrow(UserFacingError);
    expect(() => extractGeminiDelta(gemini)).toThrow(UserFacingError);
  });
});

describe('extractAnthropicDelta 스트림 중 에러 매핑', () => {
  it('overloaded_error는 503 분기를 탈 수 있는 메시지로 던진다', () => {
    const payload = JSON.stringify({ type: 'error', error: { type: 'overloaded_error' } });
    expect(() => extractAnthropicDelta(payload)).toThrow('503');
  });

  it('rate_limit_error는 429 분기를 탈 수 있는 메시지로 던진다', () => {
    const payload = JSON.stringify({ type: 'error', error: { type: 'rate_limit_error' } });
    expect(() => extractAnthropicDelta(payload)).toThrow('429');
  });
});

function bodyOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    },
  });
}

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

const echo = (payload: string) => payload;

describe('readDeltas', () => {
  it('마지막 이벤트가 빈 줄 없이 끝나도 버리지 않는다', async () => {
    const body = bodyOf([new TextEncoder().encode('data: a\n\ndata: b')]);
    expect(await collect(readDeltas(body, echo))).toEqual(['a', 'b']);
  });

  it('청크 경계에서 쪼개진 멀티바이트 문자를 온전히 복원한다', async () => {
    const bytes = new TextEncoder().encode('data: 한글\n\n');
    const body = bodyOf([bytes.slice(0, 8), bytes.slice(8)]);
    expect(await collect(readDeltas(body, echo))).toEqual(['한글']);
  });

  it('extract가 빈 문자열을 돌려주는 이벤트는 건너뛴다', async () => {
    const body = bodyOf([new TextEncoder().encode('data: a\n\ndata: skip\n\n')]);
    const extract = (payload: string) => (payload === 'skip' ? '' : payload);
    expect(await collect(readDeltas(body, extract))).toEqual(['a']);
  });
});

async function readNdjson(body: ReadableStream<Uint8Array>): Promise<object[]> {
  const text = await new Response(body).text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function* fromArray(items: string[], failWith?: Error): AsyncGenerator<string> {
  for (const item of items) yield item;
  if (failWith) throw failWith;
}

const finalize = (raw: string) => `F:${raw}`;
const toMessage = (err: unknown) => `M:${(err as Error).message}`;

describe('createNdjsonBody', () => {
  it('delta를 순서대로 보내고 마지막에 정규화된 done을 보낸다', async () => {
    const events = await readNdjson(createNdjsonBody(fromArray(['a', 'b']), finalize, toMessage));
    expect(events).toEqual([
      { type: 'delta', text: 'a' },
      { type: 'delta', text: 'b' },
      { type: 'done', code: 'F:ab' },
    ]);
  });

  it('델타 없이 끝나면 done 대신 error를 보낸다', async () => {
    const events = await readNdjson(createNdjsonBody(fromArray([]), finalize, toMessage));
    expect(events).toEqual([{ type: 'error', error: expect.stringContaining('비어') }]);
  });

  it('스트림 중 예외는 변환된 메시지로 error 이벤트를 보낸다', async () => {
    const events = await readNdjson(
      createNdjsonBody(fromArray(['a'], new Error('boom')), finalize, toMessage),
    );
    expect(events).toEqual([
      { type: 'delta', text: 'a' },
      { type: 'error', error: 'M:boom' },
    ]);
  });

  it('클라이언트가 취소하면 업스트림 제너레이터를 정리한다', async () => {
    let cleaned = false;
    async function* source(): AsyncGenerator<string> {
      try {
        yield 'a';
        await new Promise((resolve) => setTimeout(resolve, 10));
        yield 'b';
      } finally {
        cleaned = true;
      }
    }
    const body = createNdjsonBody(source(), finalize, toMessage);
    const reader = body.getReader();
    await reader.read();
    await reader.cancel();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(cleaned).toBe(true);
  });
});
