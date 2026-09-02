'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/supabase/database.types';
import { formatDateTime } from '@/lib/datetime';
import { restorePromptVersion, savePromptVersion, setAgentProvider } from './actions';
import { PROVIDERS, PROVIDER_META, isProvider } from '@/lib/agent-providers';

type Template = Database['public']['Tables']['prompt_templates']['Row'];
type Version = Database['public']['Tables']['prompt_versions']['Row'];

// 6번째 비서(소제목)까지 포함해 실제 agent_id 순서를 사람이 읽는 흐름으로
// 정렬한다 — DB의 agent_id 알파벳 순(company, interview, jobs...)은 임무
// 순서와 무관해서 그대로 쓰면 탭이 뒤죽박죽으로 보인다.
const AGENT_ORDER = ['news', 'jobs', 'company', 'writer', 'review', 'subtitle', 'interview'];
const AGENT_META: Record<string, { name: string; role: string }> = {
  news: { name: '루미', role: '뉴스 조사' },
  jobs: { name: '모카', role: '채용 탐색' },
  company: { name: '솔', role: '기업 조사' },
  writer: { name: '뮤즈', role: '자소서 작성' },
  review: { name: '렌즈', role: '검수' },
  subtitle: { name: '소제목', role: '헤드라인' },
  interview: { name: '에코', role: '면접 코치' },
};

export function PromptLabClient({ templates, versions }: { templates: Template[]; versions: Version[] }) {
  const router = useRouter();
  const ordered = useMemo(
    () => [...templates].sort((a, b) => AGENT_ORDER.indexOf(a.agent_id) - AGENT_ORDER.indexOf(b.agent_id)),
    [templates],
  );
  const [selectedId, setSelectedId] = useState(ordered[0]?.id ?? '');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selected = ordered.find((item) => item.id === selectedId) ?? null;
  const body = selected ? (drafts[selected.id] ?? selected.body) : '';
  const dirty = selected ? body !== selected.body : false;
  const selectedVersions = selected ? versions.filter((item) => item.template_id === selected.id) : [];

  function selectAgent(id: string) {
    setSelectedId(id);
    setMessage('');
  }

  function setBody(next: string) {
    if (!selected) return;
    setDrafts((prev) => ({ ...prev, [selected.id]: next }));
  }

  async function handleSave() {
    if (!selected || !dirty) return;
    setSaving(true);
    setMessage('');
    try {
      await savePromptVersion(selected.id, body);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[selected.id];
        return next;
      });
      setMessage(`v${selected.version + 1}로 저장했습니다.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleProviderChange(next: string) {
    if (!selected) return;
    setSaving(true);
    setMessage('');
    try {
      await setAgentProvider(selected.id, next);
      setMessage(`${isProvider(next) ? PROVIDER_META[next].label : next}(으)로 바꿨습니다. 다음 실행부터 적용됩니다.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'LLM을 바꾸지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(versionId: string) {
    if (!selected) return;
    setSaving(true);
    setMessage('');
    try {
      await restorePromptVersion(selected.id, versionId);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[selected.id];
        return next;
      });
      setMessage('이전 버전으로 되돌렸습니다.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '되돌리기에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (!selected) {
    return (
      <section className="card card-pad">
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>아직 시드된 프롬프트가 없습니다.</p>
      </section>
    );
  }

  return (
    <div className="prompt-lab-layout">
      <aside className="prompt-lab-agents">
        {ordered.map((item) => {
          const meta = AGENT_META[item.agent_id] ?? { name: item.agent_id, role: '' };
          const hasDraft = item.id in drafts && drafts[item.id] !== item.body;
          return (
            <button
              key={item.id}
              type="button"
              className={item.id === selectedId ? 'active' : ''}
              onClick={() => selectAgent(item.id)}
            >
              <span>
                <b>{meta.name}</b>
                <small>{meta.role}</small>
              </span>
              <em>v{item.version}{hasDraft ? ' ·' : ''}</em>
              {hasDraft && <i aria-label="저장 안 된 수정 있음" title="저장 안 된 수정 있음" />}
            </button>
          );
        })}
      </aside>

      <section className="prompt-lab-editor card card-pad">
        <div className="prompt-lab-editor-head">
          <div>
            <p className="eyebrow">SYSTEM PROMPT</p>
            <h3>{selected.name}</h3>
          </div>
          <button type="button" className="run-button" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? '저장 중…' : '새 버전 저장'}
          </button>
        </div>

        <div className="prompt-lab-provider">
          <label>
            <span>실행할 LLM</span>
            <select value={selected.provider} onChange={(event) => handleProviderChange(event.target.value)} disabled={saving}>
              {PROVIDERS.map((item) => (
                <option key={item} value={item}>
                  {PROVIDER_META[item]?.label ?? item}
                </option>
              ))}
            </select>
          </label>
          <small>{isProvider(selected.provider) ? PROVIDER_META[selected.provider].requires : ''}</small>
        </div>

        <textarea
          className="prompt-lab-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          spellCheck={false}
        />

        <div className="prompt-lab-variables">
          <span>사용 변수</span>
          {(selected.variables as string[]).map((variable) => (
            <code key={variable}>{`{{${variable}}}`}</code>
          ))}
        </div>

        {message && <p className="prompt-lab-message">{message}</p>}
      </section>

      <aside className="prompt-lab-history card card-pad">
        <p className="eyebrow">VERSION HISTORY</p>
        <h3 style={{ fontSize: 'var(--fs-lg)', margin: '0 0 4px' }}>현재 v{selected.version}</h3>
        {selectedVersions.length > 0 ? (
          <ul>
            {selectedVersions.map((version) => (
              <li key={version.id}>
                <div>
                  <b>v{version.version}</b>
                  <small>{formatDateTime(version.created_at)}</small>
                </div>
                <p>{version.body.slice(0, 80)}{version.body.length > 80 ? '…' : ''}</p>
                <button type="button" onClick={() => handleRestore(version.id)} disabled={saving}>
                  이 버전으로 되돌리기
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="prompt-lab-history-empty">아직 이전 버전이 없습니다. 저장하면 여기 쌓입니다.</p>
        )}
      </aside>
    </div>
  );
}
