'use client';

import { useId, useState } from 'react';
import { MODEL_OPTIONS, type Provider } from '@/lib/agent-providers';

type Props = {
  provider: Provider;
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  name?: string;
  disabled?: boolean;
};

// provider 또는 비서가 바뀌면 부모의 key로 직접 입력 상태도 초기화한다.
export function ModelSelect({ provider, value, onChange, onCommit, name, disabled }: Props) {
  const id = useId();
  const [custom, setCustom] = useState(false);
  const options = MODEL_OPTIONS[provider];
  // 목록에 없는 기존 모델을 기본값으로 바꾸지 않고 그대로 보여준다.
  const showCustom = custom || (value !== '' && !options.some(option => option.value === value));

  function select(next: string) {
    if (next === '__custom__') {
      setCustom(true);
      return;
    }
    setCustom(false);
    onChange(next);
    onCommit?.(next);
  }

  return <div style={{ minWidth: 0 }}>
    <label htmlFor={id}><span>모델</span>
    <select id={id} value={showCustom ? '__custom__' : value} onChange={event => select(event.target.value)} disabled={disabled} style={{ width: '100%' }}>
      <option value="">기본 모델 (CLI 설정)</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      <option value="__custom__">직접 입력…</option>
    </select>
    </label>
    {showCustom && <div>
      <label htmlFor={`${id}-custom`}>
      <span>직접 입력 모델 ID</span>
      <input type="text" id={`${id}-custom`} value={value} onChange={event => onChange(event.target.value)} maxLength={200} disabled={disabled} placeholder="사용할 모델 ID" autoComplete="off" spellCheck={false} style={{ minWidth: 0, width: '100%' }} />
      </label>
      {onCommit && <button type="button" onClick={() => onCommit(value)} disabled={disabled}>모델 적용</button>}
    </div>}
    {name && <input type="hidden" name={name} value={value} />}
  </div>;
}
