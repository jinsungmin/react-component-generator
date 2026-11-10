// 클라이언트 연결 종료(원본 시그널)와 제한 시간을 합쳐 업스트림 fetch를 중단시킨다.
export function withTimeout(source: AbortSignal, ms: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException('The operation timed out.', 'TimeoutError'));
  }, ms);

  const onSourceAbort = () => {
    clearTimeout(timer);
    controller.abort(source.reason);
  };

  if (source.aborted) onSourceAbort();
  else source.addEventListener('abort', onSourceAbort, { once: true });

  return controller.signal;
}
