import { useEffect, useRef } from 'react';
import type { StreamingState } from '../types';

interface StreamingCardProps {
  streaming: StreamingState;
}

// 생성 중인 코드를 실시간으로 보여주는 카드. 완료되면 ComponentCard(미리보기 탭)로 교체된다.
export function StreamingCard({ streaming }: StreamingCardProps) {
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = codeRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [streaming.code]);

  return (
    <div className="win component-card" role="status" aria-label="컴포넌트 생성 중">
      <div className="win-title">
        <span className="win-title-text" title={streaming.prompt}>
          {streaming.prompt}
        </span>
        <span className="win-title-time">생성 중...</span>
      </div>
      <div className="card-bar">
        <div className="card-tabs" role="tablist">
          <button role="tab" aria-selected={false} className="tab" disabled>
            미리보기
          </button>
          <button role="tab" aria-selected={true} className="tab tab--active">
            코드
          </button>
        </div>
      </div>
      <div className="card-content">
        <div className="loading-bar loading-bar--thin" aria-hidden="true">
          <span />
        </div>
        <pre className="code-block code-block--streaming" ref={codeRef}>
          <code>{streaming.code || '응답을 기다리는 중...'}</code>
        </pre>
      </div>
    </div>
  );
}
