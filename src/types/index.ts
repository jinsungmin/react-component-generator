export type Provider = 'anthropic' | 'google';

/** 서버가 NDJSON 한 줄씩 내려주는 스트리밍 이벤트. */
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

/** 생성 중인 컴포넌트의 실시간 코드. */
export interface StreamingState {
  prompt: string;
  code: string;
}

export interface GeneratedComponent {
  id: string;
  prompt: string;
  code: string;
  createdAt: Date;
}
