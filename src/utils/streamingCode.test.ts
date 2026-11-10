import { describe, it, expect } from 'vitest';
import { stripStreamingFences } from './streamingCode';

describe('stripStreamingFences', () => {
  it('앞쪽 코드펜스 줄(언어 태그 포함)을 제거한다', () => {
    expect(stripStreamingFences('```jsx\nconst A = 1;')).toBe('const A = 1;');
  });

  it('아직 개행이 오지 않은 불완전한 여는 펜스는 빈 문자열로 숨긴다', () => {
    expect(stripStreamingFences('```js')).toBe('');
  });

  it('뒤쪽 닫는 코드펜스를 제거한다', () => {
    expect(stripStreamingFences('const A = 1;\n```')).toBe('const A = 1;');
  });

  it('펜스가 없으면 그대로 반환한다', () => {
    expect(stripStreamingFences('const A = 1;\nconst B = 2;')).toBe('const A = 1;\nconst B = 2;');
  });
});
