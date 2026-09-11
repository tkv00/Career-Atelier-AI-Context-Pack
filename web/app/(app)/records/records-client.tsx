'use client';

import { uploadPrivateAttachment } from '@/lib/upload-attachment';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteAttachment,
  deleteCourse,
  deleteRecord,
  deleteRecords,
  getAttachmentUrl,
  saveCourse,
  saveRecord,
  uploadAttachment,
} from './actions';
import { UNIVERSITY_ONLY_FIELDS, type FieldSpec, type SectionSpec } from './schema';

export type RecordRow = Record<string, unknown> & { id: string };
export type AttachmentRow = {
  id: string;
  record_type: string;
  record_id: string;
  kind: string | null;
  file_name: string;
  size_bytes: number | null;
};
export type CourseRow = {
  id: string;
  education_id: string;
  course_name: string;
  credits: number | null;
  grade: string | null;
  term: string | null;
  detail: string | null;
};
export type TranscriptJobRow = { id: string; status: string; payload: unknown };

const TRANSCRIPT_STATES: Record<string, string> = {
  queued: '과목 정리 대기',
  running: '과목 정리 중',
  completed: '과목 정리 완료',
  failed: '과목 정리 실패',
  blocked_auth: 'AI 로그인 확인 필요',
  blocked_paid_overage: '구독 한도 확인 필요',
};

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// 목록 한 줄에 붙는 기간 표기. 둘 다 없으면 아무것도 안 쓴다.
function periodOf(row: RecordRow): string {
  const start = text(row.started_on);
  const end = text(row.ended_on);
  const single = text(row.acquired_on) || text(row.awarded_on);
  if (single) return single;
  if (!start && !end) return '';
  return `${start || '?'} ~ ${end || '현재'}`;
}

function Field({
  field,
  value,
  schoolType,
  onSchoolTypeChange,
}: {
  field: FieldSpec;
  value: string;
  schoolType: string;
  onSchoolTypeChange: (next: string) => void;
}) {
  // 고등학교에는 전공·학점 칸이 의미가 없다.
  if (UNIVERSITY_ONLY_FIELDS.has(field.name) && schoolType === '고등학교') return null;

  // 학교 구분만 제어 컴포넌트로 둔다 — 이 값에 따라 위 칸들이 나타났다 사라진다.
  const isSchoolType = field.name === 'school_type';

  return (
    <label className={field.wide ? 'wide' : undefined}>
      <span>{field.label}</span>
      {field.type === 'textarea' ? (
        <textarea name={field.name} defaultValue={value} rows={3} placeholder={field.placeholder} />
      ) : field.type === 'select' ? (
        isSchoolType ? (
          <select name={field.name} value={schoolType} onChange={(event) => onSchoolTypeChange(event.target.value)}>
            {field.options?.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        ) : (
          <select name={field.name} defaultValue={value || field.options?.[0]}>
            {field.options?.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        )
      ) : (
        <input
          name={field.name}
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
          step={field.type === 'number' ? '0.01' : undefined}
          defaultValue={value}
          placeholder={field.placeholder}
        />
      )}
    </label>
  );
}

export function RecordsClient({
  sections,
  rowsBySection,
  attachments,
  courses,
  transcriptJobs,
  total,
}: {
  sections: SectionSpec[];
  rowsBySection: Record<string, RecordRow[]>;
  attachments: AttachmentRow[];
  courses: CourseRow[];
  transcriptJobs: TranscriptJobRow[];
  total: number;
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(sections[0]!.id);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [schoolType, setSchoolType] = useState('대학교');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const transcriptActive = transcriptJobs.some(job => ['queued', 'running'].includes(job.status));
  useEffect(() => {
    if (!transcriptActive) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [router, transcriptActive]);

  const section = sections.find((item) => item.id === activeId)!;
  const rows = rowsBySection[activeId] ?? [];
  const formOpen = adding || editing !== null;
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  function closeForm() {
    setAdding(false);
    setEditing(null);
    setSchoolType('대학교');
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : rows.map((row) => row.id));
  }

  function removeSelected() {
    if (selectedIds.length === 0) return;
    const ids = selectedIds;
    run(
      () => deleteRecords(section.id, ids),
      `${ids.length}건을 삭제했습니다.`,
      '선택한 항목을 삭제하지 못했습니다.',
      () => {
        if (editing && ids.includes(editing.id)) closeForm();
        setSelectedIds([]);
      },
    );
  }

  function openEdit(row: RecordRow) {
    setEditing(row);
    setAdding(false);
    setSchoolType(text(row.school_type) || '대학교');
    setMessage('');
  }

  // 서버 액션은 실패할 수 있다(필수값 누락, RLS, 네트워크). 던져진 오류를 잡지
  // 않으면 transition 안에서 조용히 사라져 사용자는 아무 반응도 못 본다 —
  // 모든 호출이 이걸 거치게 해서 그런 경로가 안 생기게 한다.
  function run(action: () => Promise<unknown>, onSuccess: string, onFailure: string, after?: () => void) {
    startTransition(async () => {
      try {
        await action();
        setMessage(onSuccess);
        after?.();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : onFailure);
      }
    });
  }

  function submit(formData: FormData) {
    run(() => saveRecord(section.id, formData), '저장했습니다.', '저장하지 못했습니다.', closeForm);
  }

  function remove(row: RecordRow) {
    run(() => deleteRecord(section.id, row.id), '삭제했습니다.', '삭제하지 못했습니다.', () => {
      if (editing?.id === row.id) closeForm();
    });
  }

  async function openAttachment(id: string) {
    try {
      const url = await getAttachmentUrl(id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '파일을 열지 못했습니다.');
    }
  }

  return (
    <div className="records-layout">
      <nav className="records-tabs" aria-label="정보 항목">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === activeId ? 'active' : undefined}
            onClick={() => {
              setActiveId(item.id);
              closeForm();
              setMessage('');
              setSelectedIds([]);
            }}
          >
            <b>{item.title}</b>
            <span>{(rowsBySection[item.id] ?? []).length}</span>
          </button>
        ))}
        <p className="records-total">전체 {total}건</p>
      </nav>

      <section className="records-main">
        <header className="records-head">
          <div>
            <h3>{section.title}</h3>
            <p>{section.hint}</p>
          </div>
          <button
            type="button"
            className="run-button"
            onClick={() => {
              setAdding(true);
              setEditing(null);
              setSchoolType('대학교');
              setMessage('');
            }}
          >
            + 추가
          </button>
        </header>

        {message && <p className="records-message">{message}</p>}

        {rows.length > 0 && (
          <div className="records-bulk-bar">
            <label className="records-select-all">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="전체 선택" />
              전체 선택
            </label>
            <span className="records-bulk-count">{selectedIds.length > 0 ? `${selectedIds.length}건 선택됨` : ''}</span>
            <button type="button" className="danger" onClick={removeSelected} disabled={pending || selectedIds.length === 0}>
              선택 삭제
            </button>
          </div>
        )}

        {formOpen && (
          <form action={submit} className="records-form" key={editing?.id ?? 'new'}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="records-form-grid">
              {section.fields.map((field) => (
                <Field
                  key={field.name}
                  field={field}
                  value={editing ? text(editing[field.name]) : ''}
                  schoolType={schoolType}
                  onSchoolTypeChange={setSchoolType}
                />
              ))}
            </div>
            <div className="records-form-actions">
              <button type="button" onClick={closeForm} disabled={pending}>
                취소
              </button>
              <button type="submit" className="run-button" disabled={pending}>
                {pending ? '저장 중…' : '저장'}
              </button>
            </div>
          </form>
        )}

        {rows.length === 0 && !formOpen ? (
          <p className="records-empty">아직 등록한 {section.title} 정보가 없습니다.</p>
        ) : (
          <ul className="records-list">
            {rows.map((row) => {
              const files = attachments.filter((file) => file.record_type === section.id && file.record_id === row.id);
              const rowCourses = section.id === 'education' ? courses.filter((c) => c.education_id === row.id) : [];
              const period = periodOf(row);

              return (
                <li key={row.id} className="records-item">
                  <div className="records-item-head">
                    <div className="records-item-title">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        aria-label={`${text(row[section.titleField]) || '이 항목'} 선택`}
                      />
                      <div>
                        <b>{text(row[section.titleField]) || '(이름 없음)'}</b>
                        {period && <time>{period}</time>}
                      </div>
                    </div>
                    <div className="records-item-actions">
                      <button type="button" onClick={() => openEdit(row)} disabled={pending}>
                        수정
                      </button>
                      <button type="button" className="danger" onClick={() => remove(row)} disabled={pending}>
                        삭제
                      </button>
                    </div>
                  </div>

                  <dl className="records-item-fields">
                    {section.fields
                      .filter((field) => field.name !== section.titleField)
                      .filter((field) => text(row[field.name]))
                      .filter((field) => !(UNIVERSITY_ONLY_FIELDS.has(field.name) && text(row.school_type) === '고등학교'))
                      .map((field) => (
                        <div key={field.name}>
                          <dt>{field.label}</dt>
                          <dd>
                            {field.type === 'url' ? (
                              <a href={text(row[field.name])} target="_blank" rel="noreferrer">
                                {text(row[field.name])}
                              </a>
                            ) : (
                              text(row[field.name])
                            )}
                          </dd>
                        </div>
                      ))}
                  </dl>

                  {section.id === 'education' && (
                    <div className="records-courses">
                      <p className="records-sub-label">들은 전공과목</p>
                      {rowCourses.length > 0 && (
                        <ul>
                          {rowCourses.map((course) => (
                            <li key={course.id}>
                              <b>{course.course_name}</b>
                              <span>
                                {[course.term, course.credits ? `${course.credits}학점` : '', course.grade]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                              {course.detail && <small>{course.detail}</small>}
                              <button
                                type="button"
                                onClick={() => run(() => deleteCourse(course.id), '과목을 지웠습니다.', '과목을 지우지 못했습니다.')}
                                disabled={pending}
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <form
                        action={(formData) => run(() => saveCourse(row.id, formData), '과목을 추가했습니다.', '과목을 추가하지 못했습니다.')}
                        className="records-course-form"
                      >
                        <input name="course_name" placeholder="과목명" required />
                        <input name="term" placeholder="2024-1학기" />
                        <input name="credits" type="number" step="0.5" placeholder="학점" />
                        <input name="grade" placeholder="A+" />
                        <input name="detail" placeholder="세부설명" />
                        <button type="submit" disabled={pending}>
                          추가
                        </button>
                      </form>
                    </div>
                  )}

                  {section.attachments && (
                    <div className="records-files">
                      <p className="records-sub-label">첨부</p>
                      {files.length > 0 && (
                        <ul>
                          {files.map((file) => (
                            <li key={file.id}>
                              <button type="button" className="records-file-open" onClick={() => openAttachment(file.id)}>
                                {file.kind ? `[${file.kind}] ` : ''}
                                {file.file_name}
                              </button>
                              <small>{formatBytes(file.size_bytes)}</small>
                              {file.kind === '성적증명서' && (() => {
                                const job = transcriptJobs.find(candidate => {
                                  const payload = candidate.payload;
                                  return Boolean(payload && typeof payload === 'object' && !Array.isArray(payload) && 'attachmentId' in payload && payload.attachmentId === file.id);
                                });
                                return job ? <small className="records-transcript-status">{TRANSCRIPT_STATES[job.status] ?? job.status}</small> : null;
                              })()}
                              <button
                                type="button"
                                onClick={() => run(() => deleteAttachment(file.id), '첨부를 지웠습니다.', '첨부를 지우지 못했습니다.')}
                                disabled={pending}
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <form
                        action={(formData) => {
                          const selectedFile = formData.get('file');
                          const isTranscript = section.id === 'education' && String(formData.get('kind') ?? '') === '성적증명서' && selectedFile instanceof File && selectedFile.type === 'application/pdf';
                          return run(
                            async () => {
                              if (!(selectedFile instanceof File)) throw new Error('파일을 선택하세요.');
                              await uploadPrivateAttachment('records', `${section.id}/${row.id}`, selectedFile, 10 * 1024 * 1024, uploaded => uploadAttachment(section.id, row.id, uploaded, String(formData.get('kind') ?? '')));
                            },
                            isTranscript
                              ? '성적증명서를 올렸습니다. 로컬 러너가 과목을 자동 정리합니다.'
                              : '파일을 올렸습니다.',
                            '업로드하지 못했습니다.',
                          );
                        }}
                        className="records-file-form"
                      >
                        <select name="kind">
                          {section.attachments.map((kind) => (
                            <option key={kind}>{kind}</option>
                          ))}
                        </select>
                        <input name="file" type="file" accept=".pdf,image/*" required />
                        <button type="submit" disabled={pending}>
                          업로드
                        </button>
                      </form>
                      {section.id === 'education' && <p className="records-file-hint">PDF 성적증명서는 MarkItDown으로 변환한 뒤 과목명·학기·학점·성적을 자동으로 추가합니다. 완료 후 새로고침하면 확인할 수 있습니다.</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
