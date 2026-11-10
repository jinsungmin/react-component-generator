// 업스트림 스트리밍(SSE) 응답을 해석하는 순수 함수들.
// 부수효과가 없어 단위 테스트가 가능하다.

const TRUNCATED_MESSAGE = '생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.';

const ANTHROPIC_ERROR_CODES: Record<string, string> = {
  overloaded_error: '503',
  rate_limit_error: '429',
};

/**
 * SSE 청크를 이전 버퍼에 이어 붙여 완결된 이벤트의 data 페이로드만 추출한다.
 * 끝나지 않은 마지막 이벤트는 rest로 돌려줘 다음 호출에서 이어 붙인다.
 */
export function parseSseChunk(buffer: string, chunk: string): { payloads: string[]; rest: string } {
  const events = (buffer + chunk).replace(/\r\n/g, '\n').split('\n\n');
  const rest = events.pop() ?? '';

  const payloads = events
    .map((event) =>
      event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n'),
    )
    .filter((payload) => payload !== '');

  return { payloads, rest };
}

/** Anthropic 스트림 이벤트에서 텍스트 델타를 꺼낸다. 잘림/에러 이벤트는 예외로 던진다. */
export function extractAnthropicDelta(payload: string): string {
  const event = JSON.parse(payload) as {
    type: string;
    delta?: { type?: string; text?: string; stop_reason?: string };
    error?: { type?: string };
  };

  if (event.type === 'error') {
    // 서버의 503/429 문자열 분기가 한국어 안내로 바꿔주도록 상태 코드를 메시지에 싣는다.
    const code = ANTHROPIC_ERROR_CODES[event.error?.type ?? ''] ?? event.error?.type ?? 'unknown';
    throw new Error(`Claude API error: ${code}`);
  }
  if (event.type === 'message_delta' && event.delta?.stop_reason === 'max_tokens') {
    throw new Error(TRUNCATED_MESSAGE);
  }
  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return event.delta.text ?? '';
  }
  return '';
}

/** 업스트림 SSE 본문을 읽어 extract가 꺼낸 텍스트 델타를 하나씩 내보낸다. */
export async function* readDeltas(
  body: ReadableStream<Uint8Array>,
  extract: (payload: string) => string,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const parsed = parseSseChunk(buffer, decoder.decode(value, { stream: true }));
      buffer = parsed.rest;
      for (const payload of parsed.payloads) {
        const text = extract(payload);
        if (text) yield text;
      }
    }

    // 마지막 이벤트가 빈 줄 없이 끝나도 버리지 않도록 남은 버퍼를 비운다.
    const tail = parseSseChunk(buffer, `${decoder.decode()}\n\n`);
    for (const payload of tail.payloads) {
      const text = extract(payload);
      if (text) yield text;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

const EMPTY_MESSAGE = '생성된 코드가 비어 있습니다. 다시 시도해주세요.';

/**
 * 델타를 NDJSON(delta → done | error) 스트림으로 바꾼다.
 * 클라이언트가 취소하면 다음 델타 시점에 업스트림 제너레이터를 정리한다.
 */
export function createNdjsonBody(
  deltas: AsyncIterable<string>,
  finalize: (raw: string) => string,
  toMessage: (err: unknown) => string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = deltas[Symbol.asyncIterator]();
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let raw = '';

      try {
        for (;;) {
          const result = await iterator.next();
          if (cancelled) {
            await iterator.return?.();
            return;
          }
          if (result.done) break;
          raw += result.value;
          send({ type: 'delta', text: result.value });
        }
        send(raw.trim() ? { type: 'done', code: finalize(raw) } : { type: 'error', error: EMPTY_MESSAGE });
      } catch (err) {
        if (!cancelled) send({ type: 'error', error: toMessage(err) });
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });
}

/** Gemini 스트림 청크에서 텍스트를 꺼낸다. MAX_TOKENS로 잘리면 예외로 던진다. */
export function extractGeminiDelta(payload: string): string {
  const data = JSON.parse(payload) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error(TRUNCATED_MESSAGE);
  }
  return candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
}
