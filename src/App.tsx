import { useState, useEffect } from 'react';
import { PromptInput } from './components/PromptInput';
import { ComponentCard } from './components/ComponentCard';
import { useComponentGenerator } from './hooks/useComponentGenerator';
import type { Provider } from './types';
import './App.css';

const PROVIDER_CONFIG = {
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...' },
  google: { label: 'Google', placeholder: 'AIza...' },
} as const;

function App() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState<Provider>('google');
  const [envKeys, setEnvKeys] = useState<Record<Provider, boolean>>({
    anthropic: false,
    google: false,
  });
  const { components, isLoading, error, generate, removeComponent, clearAll } =
    useComponentGenerator();

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setEnvKeys(data.envKeys))
      .catch(() => {});
  }, []);

  const hasEnvKey = envKeys[provider];

  const handleGenerate = (prompt: string) => {
    if (!apiKey.trim() && !hasEnvKey) {
      alert(`${PROVIDER_CONFIG[provider].label} API 키를 입력하거나 .env에 설정해주세요.`);
      return;
    }
    generate(prompt, apiKey || undefined, provider);
  };

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    setApiKey('');
  };

  const activeProvider = PROVIDER_CONFIG[provider].label;

  return (
    <div className="app">
      <header className="menubar">
        <h1 className="menubar-brand">
          <span className="brand-mark" aria-hidden="true">RC</span>
          컴포넌트 생성기
        </h1>
        <p className="menubar-status" aria-label="현재 작업 상태">
          <span>모델: {activeProvider}</span>
          <span>컴포넌트: {components.length}개</span>
        </p>
      </header>

      <main className="workspace">
        <section className="win win--prompt" aria-label="컴포넌트 생성">
          <div className="win-title">
            <span className="win-title-text">새 컴포넌트</span>
          </div>
          <div className="win-body">
            <PromptInput onGenerate={handleGenerate} isLoading={isLoading} />
          </div>
        </section>

        <aside className="win win--settings" aria-label="실행 설정">
          <div className="win-title">
            <span className="win-title-text">실행 설정</span>
          </div>
          <div className="win-body">
          <div className="provider-select">
            <label htmlFor="provider">Provider</label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as Provider)}
            >
              {Object.entries(PROVIDER_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="api-key-input">
            <label htmlFor="api-key">
              API Key
            </label>
            <div className="api-key-field">
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  hasEnvKey
                    ? '서버 키 사용 중'
                    : PROVIDER_CONFIG[provider].placeholder
                }
              />
              <button
                className="btn btn-toggle-key"
                onClick={() => setShowKey(!showKey)}
                type="button"
              >
                {showKey ? '숨기기' : '보기'}
              </button>
            </div>
            <p className={`key-status ${hasEnvKey ? 'key-status--ready' : ''}`}>
              {hasEnvKey ? '.env 키가 연결되어 있습니다.' : '직접 입력하거나 서버 환경변수를 설정하세요.'}
            </p>
          </div>
          </div>
        </aside>
      </main>

      {error && (
        <div className="error-banner" role="alert">
          <span className="error-banner-icon" aria-hidden="true">!</span>
          <p>{error}</p>
        </div>
      )}

      <section className="results-section" aria-label="생성된 컴포넌트">
        {components.length > 0 && (
          <div className="results-header">
            <h2>생성된 컴포넌트 {components.length}개</h2>
            <button className="btn" onClick={clearAll}>
              전체 삭제
            </button>
          </div>
        )}

        {components.length === 0 && !isLoading && (
          <div className="win win--empty">
            <div className="win-title">
              <span className="win-title-text">비어 있음</span>
            </div>
            <div className="win-body empty-body">
              <div className="empty-icon" aria-hidden="true" />
              <div>
                <h2>아직 만든 컴포넌트가 없어요</h2>
                <p>위 입력창에 만들고 싶은 UI를 적고 &lsquo;컴포넌트 생성&rsquo;을 누르세요. 예시를 눌러 바로 시작해도 됩니다.</p>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="win win--loading" role="status">
            <div className="win-title">
              <span className="win-title-text">작업 중</span>
            </div>
            <div className="win-body loading-body">
              <div className="loading-bar" aria-hidden="true">
                <span />
              </div>
              <p>컴포넌트를 생성하고 있습니다...</p>
            </div>
          </div>
        )}

        <div className="results-grid">
          {components.map((component) => (
            <ComponentCard
              key={component.id}
              component={component}
              onRemove={removeComponent}
              onRegenerate={handleGenerate}
              isLoading={isLoading}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;
