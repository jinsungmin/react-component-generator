import { describe, it, expect } from 'vitest';
import { describeError, UserFacingError } from './errors';

describe('describeError', () => {
  it('메시지에 503이 있으면 과부하 안내와 503을 돌려준다', () => {
    expect(describeError(new Error('Claude API error: 503'))).toEqual({
      status: 503,
      message: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('메시지에 429가 있으면 요청 과다 안내와 429를 돌려준다', () => {
    expect(describeError(new Error('Gemini API error: 429'))).toEqual({
      status: 429,
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('UserFacingError는 메시지를 그대로 노출한다', () => {
    expect(describeError(new UserFacingError('코드가 너무 길어 잘렸습니다.'))).toEqual({
      status: 500,
      message: '코드가 너무 길어 잘렸습니다.',
    });
  });

  it('알 수 없는 에러는 원문 대신 고정 문구를 돌려준다', () => {
    const err = new Error('fetch failed: https://example.com/v1?key=SECRET-KEY');
    const { status, message } = describeError(err);

    expect(status).toBe(500);
    expect(message).toBe('요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    expect(message).not.toContain('SECRET-KEY');
  });

  it('Error가 아닌 값도 고정 문구를 돌려준다', () => {
    expect(describeError('boom')).toEqual({
      status: 500,
      message: '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('타임아웃 에러는 504와 시간 초과 안내를 돌려준다', () => {
    const err = new DOMException('The operation timed out.', 'TimeoutError');

    expect(describeError(err)).toEqual({
      status: 504,
      message: '응답 시간이 초과되었습니다. 다시 시도해주세요.',
    });
  });
});
