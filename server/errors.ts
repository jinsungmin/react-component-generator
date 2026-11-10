// 업스트림 에러를 클라이언트용 상태 코드와 한국어 메시지로 바꾼다.
// 알 수 없는 에러의 원문(URL, 키가 섞일 수 있음)은 응답에 싣지 않는다.

/** 메시지를 그대로 사용자에게 보여줘도 안전한 에러. */
export class UserFacingError extends Error {}

const UNKNOWN_MESSAGE = '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

export function describeError(err: unknown): { status: number; message: string } {
  if (err instanceof UserFacingError) {
    return { status: 500, message: err.message };
  }
  if (err instanceof Error || err instanceof DOMException) {
    if (err.name === 'TimeoutError') {
      return { status: 504, message: '응답 시간이 초과되었습니다. 다시 시도해주세요.' };
    }
    if (err.message.includes('503')) {
      return { status: 503, message: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.' };
    }
    if (err.message.includes('429')) {
      return { status: 429, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' };
    }
  }
  return { status: 500, message: UNKNOWN_MESSAGE };
}
