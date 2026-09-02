'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseQuestions, type ParsedQuestion } from '@/lib/parse-questions';
import { saveParsedQuestions } from './actions';

type EditableRow = ParsedQuestion & { key: string };

let rowSeq = 0;
function nextKey() {
  rowSeq += 1;
  return `row-${rowSeq}`;
}

export function QuestionImportButton({ jobPostId, existingCount }: { jobPostId: string; existingCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [saving, setSaving] = useState(false);

  function close() {
    setOpen(false);
    setPasted('');
    setRows([]);
  }

  function recognize() {
    setRows(parseQuestions(pasted).map((q) => ({ ...q, key: nextKey() })));
  }

  function updateRow(key: string, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: nextKey(), order_no: prev.length + 1, question: '', char_limit: null, char_min: null, char_limit_basis: 'unspecified', raw: '' },
    ]);
  }

  async function save() {
    if (rows.length === 0) return;
    setSaving(true);
    try {
      await saveParsedQuestions(
        jobPostId,
        rows.map((r) => ({
          question: r.question.trim(),
          char_limit: r.char_limit,
          char_min: r.char_min,
          char_limit_basis: r.char_limit_basis,
          raw: r.raw || null,
        })),
      );
      router.refresh();
      close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className="secondary-button" onClick={() => setOpen(true)}>
        문항 붙여넣기{existingCount > 0 ? ` · ${existingCount}개 저장됨` : ''}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop"
          onClick={close}
        >
          <div
            className="card card-pad"
            style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface-1)', boxShadow: 'var(--shadow-modal)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="eyebrow">문항 붙여넣기</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
              자소설닷컴에서 문항 영역을 복사해 붙여넣으세요.
            </p>

            <textarea
              autoFocus
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={6}
              className="field-input"
              style={{ marginTop: 10, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder={'1. 지원 동기를 기술해 주십시오. (1000자 이내)\n2. ...'}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="secondary-button" onClick={recognize} disabled={!pasted.trim()}>
                문항 인식
              </button>
            </div>

            {rows.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 16 }}>
                  <p className="eyebrow">인식 결과 · {rows.length}개 (전부 수정 가능)</p>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {rows.map((row, idx) => (
                      <li key={row.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 11, width: 16, textAlign: 'right' }}>{idx + 1}</span>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <input
                            type="text"
                            className="field-input"
                            value={row.question}
                            onChange={(e) => updateRow(row.key, { question: e.target.value })}
                            placeholder="문항 내용"
                          />
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              type="number"
                              className="field-input"
                              style={{ width: 96 }}
                              value={row.char_limit ?? ''}
                              onChange={(e) => updateRow(row.key, { char_limit: e.target.value ? Number(e.target.value) : null })}
                              placeholder="최대 자수"
                            />
                            <input
                              type="number"
                              className="field-input"
                              style={{ width: 96 }}
                              value={row.char_min ?? ''}
                              onChange={(e) => updateRow(row.key, { char_min: e.target.value ? Number(e.target.value) : null })}
                              placeholder="최소 자수"
                            />
                            <select
                              className="field-input"
                              style={{ width: 150 }}
                              value={row.char_limit_basis}
                              onChange={(e) => updateRow(row.key, { char_limit_basis: e.target.value as ParsedQuestion['char_limit_basis'] })}
                            >
                              <option value="unspecified">공백 기준: 미지정</option>
                              <option value="with_spaces">공백 기준: 포함</option>
                              <option value="without_spaces">공백 기준: 제외</option>
                            </select>
                            {row.char_limit_basis === 'unspecified' && (
                              <span className="status-pill dirty">
                                <i />
                                기준 미지정
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => removeRow(row.key)}
                          aria-label="이 문항 삭제"
                          style={{ padding: '0 10px' }}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="secondary-button" onClick={addRow} style={{ marginTop: 10 }}>
                    + 문항 추가
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                  <button type="button" className="secondary-button" onClick={close}>
                    취소
                  </button>
                  <button type="button" className="run-button" onClick={save} disabled={saving || rows.some((r) => !r.question.trim())}>
                    {saving ? '저장 중…' : `${rows.length}개 저장`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
