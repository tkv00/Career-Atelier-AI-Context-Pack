'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { deleteExperience, saveExperience } from './actions';
import type { Database } from '@/lib/supabase/database.types';
import { experienceTags, normalizeExperienceTag } from '@/lib/experience-tags';
import { ExperienceUniverse } from './experience-universe';
import styles from './universe.module.css';

type Experience = Database['public']['Tables']['experience_cards']['Row'];
type ExperienceField = 'context' | 'problem' | 'role_scope' | 'judgment' | 'action' | 'result' | 'trial_error' | 'reflection';
type ExperienceForm = Record<ExperienceField, string> & { id: string; title: string; metrics: string; tags: string[] };

const EMPTY_FORM: ExperienceForm = {
  id: '', title: '', context: '', problem: '', role_scope: '', judgment: '', action: '', result: '', trial_error: '', reflection: '', metrics: '', tags: [],
};
const TAG_OPTIONS = ['문제해결', '협업', '주도성', '성능개선', '갈등', '실패', '도전', '데이터분석', '고객중심', '의사결정', '리더십', '커뮤니케이션'];
const SECTIONS: { field: ExperienceField; number: string; label: string; guide: string }[] = [
  { field: 'context', number: '01', label: '상황 / 맥락', guide: '어떤 프로젝트였는가? 목표는 무엇이었는가? 누구에게 중요한 문제였는가?' },
  { field: 'problem', number: '02', label: '문제', guide: '실제 문제는 무엇이었고, 문제라고 판단한 근거는 무엇이었는가?' },
  { field: 'role_scope', number: '03', label: '내 역할', guide: '팀 전체가 아니라 내가 맡은 범위는 어디까지였는가?' },
  { field: 'judgment', number: '04', label: '판단', guide: '어떤 대안을 고려했고, 왜 이 방법을 선택했는가?' },
  { field: 'action', number: '05', label: '행동', guide: '내가 실제로 한 행동을 구체적으로 적어 주세요.' },
  { field: 'result', number: '06', label: '결과', guide: 'Before / After와 수치 또는 객관적 변화는 무엇인가?' },
  { field: 'trial_error', number: '07', label: '시행착오', guide: '실패한 접근과 예상과 달랐던 점은 무엇인가?' },
  { field: 'reflection', number: '08', label: '회고', guide: '다시 한다면 무엇을 바꾸며, 이후 생긴 나의 업무 기준은 무엇인가?' },
];

function toFormState(experience: Experience): ExperienceForm {
  return {
    id: experience.id,
    title: experience.title,
    context: experience.context || experience.situation || '',
    problem: experience.problem || experience.task || '',
    role_scope: experience.role_scope || '',
    judgment: experience.judgment || '',
    action: experience.action || '',
    result: experience.result || '',
    trial_error: experience.trial_error || '',
    reflection: experience.reflection || '',
    metrics: (Array.isArray(experience.metrics) ? experience.metrics.filter(item => typeof item === 'string') : []).join(', '),
    tags: experienceTags(experience.tags),
  };
}

function ExperienceModal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      // 조건부 렌더링으로 dialog가 제거된 뒤에도 원래 카드를 키보드로 이어서 탐색한다.
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-label={label}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>{children}</dialog>;
}

export function ExperienceVault({ initialExperiences }: { initialExperiences: Experience[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [form, setForm] = useState<ExperienceForm>({ ...EMPTY_FORM, tags: [] });
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const tagOptions = useMemo(() => Array.from(new Set([
    ...TAG_OPTIONS,
    ...initialExperiences.flatMap((experience) => experienceTags(experience.tags)),
  ])), [initialExperiences]);
  const previewExperience = useMemo(() => initialExperiences.find((experience) => experience.id === previewId) ?? null, [initialExperiences, previewId]);
  const previewForm = useMemo(() => (previewExperience ? toFormState(previewExperience) : null), [previewExperience]);

  function startNew() {
    setError('');
    setForm({ ...EMPTY_FORM, tags: [] });
    setCustomTag('');
    setEditingId('new');
  }

  function startEdit(experience: Experience) {
    setError('');
    setForm(toFormState(experience));
    setCustomTag('');
    setEditingId(experience.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, tags: [] });
  }

  function openPreview(experience: Experience) {
    setPreviewId(experience.id);
  }

  function closePreview() {
    setPreviewId(null);
  }

  function toggleTag(tag: string) {
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(tag) ? current.tags.filter((item) => item !== tag) : [...current.tags, tag],
    }));
  }

  function addCustomTag() {
    const value = normalizeExperienceTag(customTag);
    if (!value) return;
    if (!form.tags.includes(value)) setForm((current) => ({ ...current, tags: [...current.tags, value] }));
    setCustomTag('');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await saveExperience(new FormData(event.currentTarget));
      cancelEdit();
      router.refresh();
    } catch {
      setError('경험을 저장하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    setError('');
    try {
      await deleteExperience(id);
      if (editingId === id) cancelEdit();
      if (previewId === id) closePreview();
      router.refresh();
    } catch {
      setError('경험을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">MY CAREER UNIVERSE</p>
          <h2>나의 경험 은하계</h2>
          <p>경험은 별이 되고, 해시태그는 서로 이어집니다. 나만의 가능성을 발견해 보세요.</p>
        </div>
        <div className="experience-muse-agent">
          <div className="cloud-space-agent frame-4" aria-label="경험을 정리하는 우주 에이전트"/>
          <button type="button" className="run-button" onClick={startNew}>+ 새 경험 정리</button>
        </div>
      </div>

      <ExperienceUniverse experiences={initialExperiences} onOpen={openPreview} onEdit={startEdit} onNew={startNew}/>
      {error && !editingId && !previewId && <p role="alert" className={styles.error}>{error}</p>}
        {editingId && (
          <ExperienceModal label={editingId === 'new' ? '새 경험 정리' : '경험 카드 편집'} onClose={cancelEdit}>
          <section className="card card-pad web-experience-editor">
            <div className="web-experience-heading">
              <div><p className="eyebrow">NINE-PART FRAMEWORK</p><h3>{editingId === 'new' ? '새 경험 정리' : '경험 카드 편집'}</h3></div>
              <button type="button" className="secondary-button" onClick={cancelEdit}>닫기</button>
            </div>
            <p className="web-experience-hint">모든 칸을 다 채우지 않아도 저장됩니다. 생각나는 것부터 적고, 나머지는 나중에 다시 돌아와 채우세요.</p>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            <form onSubmit={handleSubmit}>
              {editingId !== 'new' && <input type="hidden" name="id" value={editingId} />}
              <label className="web-experience-title">경험 제목<input type="text" name="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="예: 신규 사용자 이탈 구간 개선" className="field-input"/></label>
              <div className="web-framework-grid">
                {SECTIONS.map((section) => (
                  <label key={section.field} className="web-framework-field">
                    <span><b>{section.number}</b>{section.label}</span>
                    <textarea name={section.field} value={form[section.field]} onChange={(event) => setForm({ ...form, [section.field]: event.target.value })} placeholder={section.guide} className="field-input" rows={5}/>
                  </label>
                ))}
              </div>
              <label className="web-metric-field">결과 수치 · 객관적 변화<textarea name="metrics" value={form.metrics} onChange={(event) => setForm({ ...form, metrics: event.target.value })} placeholder="쉼표 또는 줄바꿈으로 구분 · 예: 전환율 12% 개선, 처리 시간 2일 단축" className="field-input" rows={3}/></label>
              <section className="web-tag-picker-panel">
                <div className="web-tag-picker-heading"><span><b>09</b>활용 태그</span><small>자소서 문항에 맞춰 다시 찾을 수 있도록 복수 선택하세요.</small></div>
                <input type="hidden" name="tags" value={form.tags.join(', ')} />
                <div className="web-tag-picker">{tagOptions.map((item) => <button type="button" aria-pressed={form.tags.includes(item)} className={form.tags.includes(item) ? 'selected' : ''} key={item} onClick={() => toggleTag(item)}>{item}<i>{form.tags.includes(item) ? '✓' : '+'}</i></button>)}</div>
                <div className="web-custom-tag"><input aria-label="직접 태그 입력" value={customTag} onChange={(event) => setCustomTag(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomTag(); } }} placeholder="직접 태그 입력" className="field-input"/><button type="button" onClick={addCustomTag}>태그 추가</button></div>
                {form.tags.length > 0 && <div className="web-selected-tags"><span>선택됨</span>{form.tags.map((item) => <button type="button" key={item} onClick={() => toggleTag(item)}>{item} ×</button>)}</div>}
              </section>
              <div className="web-experience-actions"><button type="submit" className="run-button" disabled={saving}>{saving ? '저장 중…' : '경험 카드 저장'}</button><button type="button" className="secondary-button" onClick={cancelEdit}>취소</button></div>
            </form>
          </section>
          </ExperienceModal>
        )}

      {previewForm && previewExperience && (
        <ExperienceModal label="경험 카드 미리보기" onClose={closePreview}>
          <section className="card card-pad web-experience-preview">
            <div className="web-experience-heading">
              <div><p className="eyebrow">EXPERIENCE PREVIEW</p><h3>{previewForm.title}</h3></div>
              <button type="button" className="secondary-button" onClick={closePreview}>닫기</button>
            </div>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            {previewForm.tags.length > 0 && <div className="web-experience-tags">{previewForm.tags.map((item) => <span key={item}>{item}</span>)}</div>}
            <div className="web-experience-preview-body">
              {SECTIONS.map((section) => (
                <div key={section.field} className="web-experience-preview-field">
                  <span><b>{section.number}</b>{section.label}</span>
                  <p>{previewForm[section.field] || '아직 작성하지 않았습니다.'}</p>
                </div>
              ))}
              <div className="web-experience-preview-field">
                <span><b>09</b>결과 수치 · 객관적 변화</span>
                <p>{previewForm.metrics || '아직 작성하지 않았습니다.'}</p>
              </div>
            </div>
            <div className="web-experience-actions">
              <button type="button" className="run-button" onClick={() => { closePreview(); startEdit(previewExperience); }}>9단계 편집</button>
              <button type="button" className="delete" disabled={deleting} onClick={() => handleDelete(previewExperience.id)}>{deleting ? '삭제 중…' : '삭제'}</button>
            </div>
          </section>
        </ExperienceModal>
      )}
    </>
  );
}
