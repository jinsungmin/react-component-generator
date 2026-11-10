import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

function stubFetch(envKeys = { anthropic: false, google: true }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/config') return { ok: true, json: async () => ({ envKeys }) };
      return { ok: true, json: async () => ({ code: 'render(<div>결과</div>)' }) };
    }),
  );
}

beforeEach(() => stubFetch());
afterEach(() => vi.unstubAllGlobals());

describe('App 영속성', () => {
  it('저장된 provider를 복원한다', () => {
    localStorage.setItem('rcg:provider', JSON.stringify('anthropic'));
    render(<App />);
    expect(screen.getByLabelText('Provider')).toHaveValue('anthropic');
  });

  it('저장된 API 키를 복원한다', () => {
    localStorage.setItem('rcg:provider', JSON.stringify('google'));
    localStorage.setItem('rcg:apiKeys', JSON.stringify({ anthropic: '', google: 'AIza-saved' }));
    render(<App />);
    expect(screen.getByLabelText('API Key')).toHaveValue('AIza-saved');
  });

  it('입력한 API 키와 provider 선택이 저장된다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText('Provider'), 'anthropic');
    await user.type(screen.getByLabelText('API Key'), 'sk-ant-1');

    expect(JSON.parse(localStorage.getItem('rcg:provider')!)).toBe('anthropic');
    expect(JSON.parse(localStorage.getItem('rcg:apiKeys')!).anthropic).toBe('sk-ant-1');
  });

  it('provider를 바꿔도 다른 provider의 키가 유지된다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('API Key'), 'g-key');
    await user.selectOptions(screen.getByLabelText('Provider'), 'anthropic');
    expect(screen.getByLabelText('API Key')).toHaveValue('');

    await user.selectOptions(screen.getByLabelText('Provider'), 'google');
    expect(screen.getByLabelText('API Key')).toHaveValue('g-key');
  });

  it('생성한 프롬프트가 히스토리에 저장되고 화면에 표시된다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole('textbox', { name: '무엇을 만들까요?' }), '로그인 폼');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('rcg:promptHistory')!)).toEqual(['로그인 폼']);
    });
    expect(screen.getByText('최근 프롬프트')).toBeInTheDocument();
  });

  it('새로고침 후에도 생성된 컴포넌트 목록이 남아 있다', () => {
    localStorage.setItem(
      'rcg:components',
      JSON.stringify([{ id: '1', prompt: '저장된 카드', code: 'render(<div>x</div>)', createdAt: '2026-01-01T00:00:00.000Z' }]),
    );
    render(<App />);
    expect(screen.getByText('생성된 컴포넌트 1개')).toBeInTheDocument();
  });
});
