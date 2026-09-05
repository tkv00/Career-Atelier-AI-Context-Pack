'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteExperience, saveExperience } from './actions';
import type { Database } from '@/lib/supabase/database.types';

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
    metrics: ((experience.metrics as string[] | null) ?? []).join(', '),
    tags: (experience.tags as string[] | null) ?? [],
  };
}

export function ExperienceVault({ initialExperiences }: { initialExperiences: Experience[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [form, setForm] = useState<ExperienceForm>({ ...EMPTY_FORM, tags: [] });
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving] = useState(false);
  const tagOptions = useMemo(() => Array.from(new Set([
    ...TAG_OPTIONS,
    ...initialExperiences.flatMap((experience) => (experience.tags as string[] | null) ?? []),
  ])), [initialExperiences]);
  const previewExperience = useMemo(() => initialExperiences.find((experience) => experience.id === previewId) ?? null, [initialExperiences, previewId]);
  const previewForm = useMemo(() => (previewExperience ? toFormState(previewExperience) : null), [previewExperience]);

  function startNew() {
    setForm({ ...EMPTY_FORM, tags: [] });
    setCustomTag('');
    setEditingId('new');
  }

  function startEdit(experience: Experience) {
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
    const value = customTag.trim();
    if (!value) return;
    if (!form.tags.includes(value)) setForm((current) => ({ ...current, tags: [...current.tags, value] }));
    setCustomTag('');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveExperience(new FormData(event.currentTarget));
      cancelEdit();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteExperience(id);
    if (editingId === id) cancelEdit();
    if (previewId === id) closePreview();
    router.refresh();
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>경험 카드</h1>
          <p>맥락과 문제, 나의 판단부터 시행착오와 회고까지 자소서 근거로 구조화합니다.</p>
        </div>
        <div className="experience-muse-agent">
          <div className="cloud-space-agent frame-4" aria-label="경험을 정리하는 우주 에이전트"/>
          <button type="button" className="run-button" onClick={startNew}>+ 새 경험 정리</button>
        </div>
      </div>
      <div className="web-experience-layout">
        {editingId && (
          <section className="card card-pad web-experience-editor">
            <div className="web-experience-heading">
              <div><h3>{editingId === 'new' ? '새 경험 정리' : '경험 카드 편집'}</h3></div>
              <button type="button" className="secondary-button" onClick={cancelEdit}>닫기</button>
            </div>
            <p className="web-experience-hint">모든 칸을 다 채우지 않아도 저장됩니다. 생각나는 것부터 적고, 나머지는 나중에 다시 돌아와 채우세요.</p>
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
                <div className="web-custom-tag"><input value={customTag} onChange={(event) => setCustomTag(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomTag(); } }} placeholder="직접 태그 입력" className="field-input"/><button type="button" onClick={addCustomTag}>태그 추가</button></div>
                {form.tags.length > 0 && <div className="web-selected-tags"><span>선택됨</span>{form.tags.map((item) => <button type="button" key={item} onClick={() => toggleTag(item)}>{item} ×</button>)}</div>}
              </section>
              <div className="web-experience-actions"><button type="submit" className="run-button" disabled={saving}>{saving ? '저장 중…' : '경험 카드 저장'}</button><button type="button" className="secondary-button" onClick={cancelEdit}>취소</button></div>
            </form>
          </section>
        )}
        <section className="card card-pad web-experience-list">
          <div className="web-experience-heading"><div><h3>정리된 경험</h3></div><b>{initialExperiences.length}</b></div>
          {initialExperiences.length === 0 ? <p className="web-experience-empty">아직 정리된 경험이 없습니다. 프로젝트 하나를 골라 상황과 문제부터 회고까지 기록해 보세요.</p> : (
            <div className="web-experience-cards">{initialExperiences.map((experience) => {
              const tags = (experience.tags as string[] | null) ?? [];
              const metrics = (experience.metrics as string[] | null) ?? [];
              return <article key={experience.id}>
                <button type="button" className="web-experience-open" onClick={() => openPreview(experience)}><span>{experience.title.slice(0, 1)}</span><div><h4>{experience.title}</h4><p>{experience.result || experience.action || experience.context || experience.situation || '내용을 더 채워 주세요.'}</p></div></button>
                <div className="web-experience-tags">{tags.map((item) => <span key={item}>{item}</span>)}{metrics.slice(0, 2).map((item) => <em key={item}>{item}</em>)}</div>
                <div className="web-experience-card-actions"><button type="button" className="edit" onClick={() => startEdit(experience)}>9단계 편집</button><button type="button" className="delete" onClick={() => handleDelete(experience.id)}>삭제</button></div>
              </article>;
            })}</div>
          )}
        </section>
      </div>

      {previewForm && previewExperience && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="경험 카드 미리보기" onClick={closePreview}>
          <section className="card card-pad web-experience-preview" onClick={(event) => event.stopPropagation()}>
            <div className="web-experience-heading">
              <div><h3>{previewForm.title}</h3></div>
              <button type="button" className="secondary-button" onClick={closePreview}>닫기</button>
            </div>
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
              <button type="button" className="delete" onClick={() => handleDelete(previewExperience.id)}>삭제</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
