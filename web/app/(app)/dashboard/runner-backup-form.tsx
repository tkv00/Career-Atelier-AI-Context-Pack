'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateRunnerBackup } from '../runners/actions';
import { formatDateTime } from '@/lib/datetime';

// 로컬 폴더 자동 백업 설정. 파일을 실제로 쓰는 건 그 기기의 러너이고, 여기서는
// "켤지 말지 + 어느 폴더인지"만 고른다. 브라우저는 임의 폴더에 쓸 수 없어서
// 폴더 선택 다이얼로그 대신 경로 입력을 받는다.
function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="secondary-button" disabled={pending || !dirty}>
      {pending ? '저장 중…' : dirty ? '저장' : '저장됨'}
    </button>
  );
}

export function RunnerBackupForm({
  runnerId,
  enabled,
  dir,
  lastBackupAt,
  lastBackupError,
}: {
  runnerId: string;
  enabled: boolean;
  dir: string | null;
  lastBackupAt: string | null;
  lastBackupError: string | null;
}) {
  const [on, setOn] = useState(enabled);
  const [path, setPath] = useState(dir ?? '');

  // React는 서버 액션이 끝나면 <form>을 리셋한다 — 그대로 두면 저장 직후 토글이
  // 잠깐 꺼진 것처럼 보였다(실제 저장값은 켜짐). 서버에서 새 값이 내려오면
  // 편집 중이던 로컬 상태를 버리고 그 값에 맞춘다.
  const [syncedFrom, setSyncedFrom] = useState({ enabled, dir });
  if (syncedFrom.enabled !== enabled || syncedFrom.dir !== dir) {
    setSyncedFrom({ enabled, dir });
    setOn(enabled);
    setPath(dir ?? '');
  }

  const dirty = on !== enabled || path !== (dir ?? '');

  return (
    <form action={updateRunnerBackup.bind(null, runnerId)} className="runner-backup">
      <label className="runner-backup-toggle">
        <input type="checkbox" name="backupEnabled" checked={on} onChange={(event) => setOn(event.target.checked)} />
        <span aria-hidden="true" />
        <b>로컬 폴더 자동 백업</b>
      </label>

      <input
        type="text"
        name="backupDir"
        value={path}
        onChange={(event) => setPath(event.target.value)}
        placeholder="~/career-atelier-backups"
        disabled={!on}
        spellCheck={false}
      />

      <SaveButton dirty={dirty} />

      <p>
        {on
          ? '이 기기의 러너가 2시간마다 전체 데이터를 이 폴더에 JSON으로 저장합니다.'
          : '켜면 이 기기의 러너가 주기적으로 전체 데이터를 지정한 폴더에 저장합니다.'}
        {lastBackupAt && <> · 마지막 백업 {formatDateTime(lastBackupAt)}</>}
      </p>

      {lastBackupError && <p className="runner-backup-error">백업 실패: {lastBackupError}</p>}
    </form>
  );
}
