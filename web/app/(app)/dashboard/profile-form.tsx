'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveProfile } from './actions';

function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="secondary-button" disabled={pending || !dirty}>
      {pending ? '저장 중…' : dirty ? '저장' : '저장됨'}
    </button>
  );
}

// 목표 직무·관심 분야가 비어 있으면 모카(채용탐색)·루미(뉴스)가 무엇을 찾을지
// 판단할 근거가 없어 매번 빈 결과만 낸다(runner/index.mjs processJobSearchJob·
// processNewsJob). v1에 있던 프로필 편집이 v2엔 없어서 이 값을 채울 방법
// 자체가 없었다 — 여기서 채운다.
export function ProfileForm({
  displayName,
  targetRoles,
  interests,
  summary,
}: {
  displayName: string;
  targetRoles: string[];
  interests: string[];
  summary: string;
}) {
  const initialRoles = targetRoles.join(', ');
  const initialInterests = interests.join(', ');

  const [name, setName] = useState(displayName);
  const [roles, setRoles] = useState(initialRoles);
  const [interestsText, setInterestsText] = useState(initialInterests);
  const [about, setAbout] = useState(summary);

  // 서버 액션 완료 후 React가 폼을 리셋하는 걸 막기 위해(runner-backup-form.tsx와
  // 같은 이유) 서버에서 내려온 새 값과 다를 때만 로컬 상태를 그 값으로 맞춘다.
  const [syncedFrom, setSyncedFrom] = useState({ displayName, initialRoles, initialInterests, summary });
  if (
    syncedFrom.displayName !== displayName ||
    syncedFrom.initialRoles !== initialRoles ||
    syncedFrom.initialInterests !== initialInterests ||
    syncedFrom.summary !== summary
  ) {
    setSyncedFrom({ displayName, initialRoles, initialInterests, summary });
    setName(displayName);
    setRoles(initialRoles);
    setInterestsText(initialInterests);
    setAbout(summary);
  }

  const dirty = name !== displayName || roles !== initialRoles || interestsText !== initialInterests || about !== summary;

  return (
    <form action={saveProfile} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
      <label style={{ fontSize: 12, color: 'var(--text-3)' }}>
        이름
        <input
          type="text"
          name="display_name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="field-input"
          style={{ marginTop: 4 }}
        />
      </label>
      <label style={{ fontSize: 12, color: 'var(--text-3)' }}>
        목표 직무 (콤마로 구분 — 예: 백엔드 엔지니어, 플랫폼 엔지니어)
        <input
          type="text"
          name="target_roles"
          value={roles}
          onChange={(event) => setRoles(event.target.value)}
          className="field-input"
          style={{ marginTop: 4 }}
        />
      </label>
      <label style={{ fontSize: 12, color: 'var(--text-3)' }}>
        관심 분야 (콤마로 구분 — 예: 클라우드 인프라, 생성형 AI)
        <input
          type="text"
          name="interests"
          value={interestsText}
          onChange={(event) => setInterestsText(event.target.value)}
          className="field-input"
          style={{ marginTop: 4 }}
        />
      </label>
      <label style={{ fontSize: 12, color: 'var(--text-3)' }}>
        자기소개 · 선택
        <textarea
          name="summary"
          value={about}
          onChange={(event) => setAbout(event.target.value)}
          rows={2}
          className="field-input"
          style={{ marginTop: 4, resize: 'vertical' }}
        />
      </label>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
        목표 직무·관심 분야는 모카(채용탐색)·루미(뉴스)가 무엇을 찾을지 판단하는 근거입니다. 비워 두면 두 비서가 결과를 내지 못합니다.
      </p>
      <div>
        <SaveButton dirty={dirty} />
      </div>
    </form>
  );
}
