'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getDeviceName } from '@/lib/device-name';
import { loadLocalDraft, saveLocalDraft } from '@/lib/local-drafts';
import { countChars } from '@/lib/chars';
import { formatDateTime } from '@/lib/datetime';
import { diffLines } from '@/lib/diff';
import { markdownToHtml } from '@/lib/markdown';
import { companyResearchToMarkdown, isCompanyResult, sanitizeFileName, type CompanyResult } from '@/lib/company-research';
import { downloadTextFile } from '@/lib/download-text';
import { downloadMarkdownAsPdf } from '@/lib/pdf';
import { cancelQueuedJob } from '@/lib/jobs-actions';
import {
  applySubtitle,
  deleteCompanyAttachment,
  forceSaveDraft,
  requestCompanyResearch,
  requestReview,
  requestSubtitle,
  requestWriterDraft,
  requestEssayRevision,
  clearRevisionRequests,
  saveDraft,
  saveQuestionSettings,
  saveVersion,
  snapshotDraft,
  uploadCompanyAttachment,
  type SaveDraftResult,
} from '../actions';
import type { Database } from '@/lib/supabase/database.types';

type Essay = Database['public']['Tables']['essay_projects']['Row'];
type EssayVersion = Database['public']['Tables']['essay_versions']['Row'];
type Artifact = Database['public']['Tables']['artifacts']['Row'];
type JobPost = Database['public']['Tables']['job_posts']['Row'];
type ResearchNote = Database['public']['Tables']['research_notes']['Row'];

type Conflict = { serverDraft: string; serverRevision: number; serverUpdatedAt: string };

type ReviewIssue = {
  category: 'fact_error' | 'overclaim' | 'job_fit' | 'suggestion';
  paragraph_excerpt: string;
  comment: string;
  suggested_revision?: string;
};
type ReviewResult = { overall_assessment: string; job_fit_score: number | null; issues: ReviewIssue[] };

type EvidenceItem = { paragraph_index: number; experience_id: string; quoted_fact: string };
type WriterResult = { draft: string; evidence: EvidenceItem[] };

type SubtitleResult = { subtitle: string; rationale: string };

type CompanyAttachment = { id: string; file_name: string; size_bytes: number | null; created_at: string };

function formatFileSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const PROVIDER_LABEL: Record<string, string> = {
  codex: 'Codex(ChatGPT 구독)',
  claude: 'Claude Code(Claude 구독)',
  gemini: 'Gemini(Google 계정)',
};

const CATEGORY_LABEL: Record<ReviewIssue['category'], string> = {
  fact_error: '사실 오류',
  overclaim: '과장',
  job_fit: '직무 적합성',
  suggestion: '제안',
};

// useSyncExternalStore용 — 컴포넌트 밖에 두어 매 렌더마다 새 함수가 생기지 않게 한다.
function subscribeToConnection(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}
const getConnectionSnapshot = () => navigator.onLine;
const getServerConnectionSnapshot = () => true;

const CLOUD_SAVE_INTERVAL_MS = 60_000;
const TYPING_QUIET_MS = 2_000;
const SNAPSHOT_INTERVAL_MS = 10 * 60_000;
const SNAPSHOT_CHAR_DELTA = 500;
const TICK_MS = 2_000;

export function EssayEditor({
  essay,
  initialVersions,
  latestReview,
  latestDraft,
  latestSubtitle,
  jobPost,
  companyResearch,
  reviewPending,
  writerPending,
  companyPending,
  subtitlePending,
  pendingJobs,
  runnerOnline,
  revisionRequests,
  companyAttachments,
}: {
  essay: Essay;
  initialVersions: EssayVersion[];
  latestReview: Artifact | null;
  latestDraft: Artifact | null;
  latestSubtitle: Artifact | null;
  jobPost: JobPost | null;
  companyResearch: ResearchNote | null;
  reviewPending: boolean;
  writerPending: boolean;
  companyPending: boolean;
  subtitlePending: boolean;
  pendingJobs: { id: string; kind: string; status: string }[];
  runnerOnline: boolean;
  revisionRequests: { id: string; instruction: string; created_at: string }[];
  companyAttachments: CompanyAttachment[];
}) {
  const router = useRouter();
  const [content, setContent] = useState(essay.draft);
  const [revisionInput, setRevisionInput] = useState('');
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [revisionMessage, setRevisionMessage] = useState('');
  const [revision, setRevision] = useState(essay.revision);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // 연결 상태는 브라우저 외부 상태라 useSyncExternalStore로 구독한다. 서버
  // 스냅샷을 true로 따로 주는 게 핵심 — 예전처럼 typeof navigator로 서버를
  // 판별하면 Node 21+에 navigator 전역이 있고 onLine만 없어서 undefined(=falsy)가
  // 되고, 서버가 늘 "오프라인 — 로컬에 저장 중"으로 렌더해 하이드레이션
  // 불일치가 났다(이 화면에서 실제로 발생한 버그).
  const online = useSyncExternalStore(subscribeToConnection, getConnectionSnapshot, getServerConnectionSnapshot);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergedText, setMergedText] = useState('');
  const [presenceOthers, setPresenceOthers] = useState<string[]>([]);
  const [versionNote, setVersionNote] = useState('');
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [question, setQuestion] = useState(essay.question);
  const [targetChars, setTargetChars] = useState(essay.target_chars);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companyName, setCompanyName] = useState(jobPost?.company ?? '');
  const [companyRole, setCompanyRole] = useState(jobPost?.role ?? '');
  const [companyJd, setCompanyJd] = useState(jobPost?.description ?? '');
  const [companyInstruction, setCompanyInstruction] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [subtitle, setSubtitle] = useState(essay.subtitle ?? '');
  const [savingSubtitle, setSavingSubtitle] = useState(false);

  const deviceNameRef = useRef('');
  const lastKeystrokeAt = useRef(0);
  const lastCloudSaveAt = useRef(0);
  const lastSnapshotAt = useRef(0);
  const contentAtLastSnapshot = useRef(essay.draft);
  const contentRef = useRef(content);
  const revisionRef = useRef(revision);
  const dirtyRef = useRef(dirty);
  const conflictRef = useRef(conflict);
  const onlineRef = useRef(online);

  // 최신 state를 ref에 동기화 — 렌더 중이 아니라 렌더 이후(effect)에서만 ref를 쓴다.
  useEffect(() => {
    contentRef.current = content;
    revisionRef.current = revision;
    dirtyRef.current = dirty;
    conflictRef.current = conflict;
    onlineRef.current = online;
  });

  const maybeSnapshot = useCallback(async (text: string) => {
    const now = Date.now();
    const elapsed = now - lastSnapshotAt.current;
    const delta = Math.abs(text.length - contentAtLastSnapshot.current.length);
    if (elapsed < SNAPSHOT_INTERVAL_MS && delta < SNAPSHOT_CHAR_DELTA) return;
    lastSnapshotAt.current = now;
    contentAtLastSnapshot.current = text;
    try {
      await snapshotDraft(essay.id, text, deviceNameRef.current);
    } catch {
      // 스냅샷 실패는 조용히 넘어간다 — 클라우드 저장 자체는 별개로 계속된다.
    }
  }, [essay.id]);

  const performCloudSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const result: SaveDraftResult = await saveDraft(essay.id, contentRef.current, revisionRef.current);
      if (result.ok) {
        setRevision(result.revision);
        setDirty(false);
        lastCloudSaveAt.current = Date.now();
        setSaveStatus('saved');
        void maybeSnapshot(contentRef.current);
      } else {
        setSaveStatus('idle');
        setConflict(result.conflict);
      }
    } catch {
      setSaveStatus('error');
    }
  }, [essay.id, maybeSnapshot]);

  // 기기 이름 + IndexedDB 복구 (오프라인 중 편집했던 내용이 있으면 우선한다 — 다음
  // 클라우드 저장 시도가 자동으로 revision 대조를 거치므로 충돌이면 정상적으로
  // 충돌 배너로 이어진다).
  useEffect(() => {
    const now = Date.now();
    lastSnapshotAt.current = now;
    deviceNameRef.current = getDeviceName();
    (async () => {
      const local = await loadLocalDraft(essay.id);
      if (local !== null && local !== essay.draft) {
        setContent(local);
        setDirty(true);
        lastKeystrokeAt.current = now - TYPING_QUIET_MS;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essay.id]);

  // 재접속하면 밀린 변경을 즉시 올린다(구독 자체는 useSyncExternalStore가 한다).
  useEffect(() => {
    if (!online) return;
    if (dirtyRef.current && !conflictRef.current) void performCloudSave();
  }, [online, performCloudSave]);

  // §7 클라우드 1분 저장: 60초 주기 + 변경 있을 때만 + 마지막 입력 후 2초 디바운스.
  useEffect(() => {
    const tick = setInterval(() => {
      if (!onlineRef.current || !dirtyRef.current || conflictRef.current) return;
      const now = Date.now();
      if (now - lastKeystrokeAt.current < TYPING_QUIET_MS) return;
      if (now - lastCloudSaveAt.current < CLOUD_SAVE_INTERVAL_MS) return;
      void performCloudSave();
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [performCloudSave]);

  // Presence — 같은 자소서를 연 다른 기기 표시 (§7 예방).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`essay:${essay.id}`, {
      config: { presence: { key: deviceNameRef.current || 'unknown' } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const others = Object.keys(state).filter((key) => key !== deviceNameRef.current);
        setPresenceOthers(others);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ online_at: new Date().toISOString() });
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [essay.id]);

  // 탭을 떠나기 전 마지막 저장 시도 (best-effort).
  useEffect(() => {
    const onBeforeUnload = () => {
      if (dirtyRef.current) void saveLocalDraft(essay.id, contentRef.current);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [essay.id]);

  // 검수/작성/기업조사 요청이 진행 중일 때만 5초마다 서버 컴포넌트를 다시 불러
  // 결과 도착 여부를 확인한다 — 완료되면 pending prop이 false로 바뀌어 자동 정지.
  useEffect(() => {
    if (!reviewPending && !writerPending && !companyPending && !subtitlePending) return;
    const poll = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(poll);
  }, [reviewPending, writerPending, companyPending, subtitlePending, router]);

  async function handleRequestReview() {
    await requestReview(essay.id);
    router.refresh();
  }

  async function handleRequestWriterDraft() {
    await requestWriterDraft(essay.id);
    router.refresh();
  }

  // 대화형 수정. 저장된 draft가 아니라 지금 에디터에 있는 content를 넘긴다 —
  // 방금 손으로 고친 문장이 아직 저장 전일 수 있고, 사용자는 화면에 보이는
  // 글이 고쳐지길 기대한다.
  async function handleRequestRevision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const instruction = revisionInput.trim();
    if (!instruction) return;
    setRevisionBusy(true);
    setRevisionMessage('');
    try {
      await requestEssayRevision(essay.id, instruction, content);
      setRevisionInput('');
      setRevisionMessage('요청을 보냈습니다. 뮤즈가 고친 초안을 오른쪽에 올려줍니다.');
      router.refresh();
    } catch (error) {
      setRevisionMessage(error instanceof Error ? error.message : '요청하지 못했습니다.');
    } finally {
      setRevisionBusy(false);
    }
  }

  async function handleClearRevisions() {
    setRevisionBusy(true);
    try {
      await clearRevisionRequests(essay.id);
      setRevisionMessage('이전 요청을 지웠습니다. 다음 수정은 새 방향으로 시작합니다.');
      router.refresh();
    } catch (error) {
      setRevisionMessage(error instanceof Error ? error.message : '지우지 못했습니다.');
    } finally {
      setRevisionBusy(false);
    }
  }

  async function handleRequestCompanyResearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCompany(true);
    try {
      await requestCompanyResearch(essay.id, companyName, companyRole, companyJd, companyInstruction);
      setShowCompanyForm(false);
      router.refresh();
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleUploadAttachment(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAttachmentError('');
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      await uploadCompanyAttachment(essay.id, formData);
      router.refresh();
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : '업로드하지 못했습니다.');
    } finally {
      setUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    await deleteCompanyAttachment(attachmentId, essay.id);
    router.refresh();
  }

  async function handleRequestSubtitle() {
    await requestSubtitle(essay.id);
    router.refresh();
  }

  // 러너가 꺼져 있어 queued로 무한 대기하는 잡만 취소 대상이다 — running은
  // 러너가 실제로 처리 중이라 여기서 지워도 로컬 프로세스는 안 멈춘다.
  function queuedJobId(kind: string) {
    return pendingJobs.find((job) => job.kind === kind && job.status === 'queued')?.id ?? null;
  }

  async function handleCancelJob(jobId: string) {
    await cancelQueuedJob(jobId, `/essays/${essay.id}`);
    router.refresh();
  }

  async function handleApplySubtitle(text: string) {
    setSubtitle(text);
    setSavingSubtitle(true);
    try {
      await applySubtitle(essay.id, text);
    } finally {
      setSavingSubtitle(false);
    }
  }

  async function handleSubtitleBlur() {
    if (subtitle === (essay.subtitle ?? '')) return;
    setSavingSubtitle(true);
    try {
      await applySubtitle(essay.id, subtitle);
    } finally {
      setSavingSubtitle(false);
    }
  }

  async function handleSaveQuestionSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingQuestion(true);
    try {
      await saveQuestionSettings(essay.id, question, targetChars);
      setShowQuestionForm(false);
      router.refresh();
    } finally {
      setSavingQuestion(false);
    }
  }

  // 초안을 에디터 본문에 얹기만 한다 — 곧바로 클라우드에 쓰지 않는다. 이미
  // 있는 저장 파이프라인(자동저장·충돌 검사)이 그대로 이어받는다(§7 원칙 유지).
  function handleApplyDraft(draftText: string) {
    setContent(draftText);
    setDirty(true);
    lastKeystrokeAt.current = Date.now() - TYPING_QUIET_MS;
    void saveLocalDraft(essay.id, draftText);
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    setContent(next);
    setDirty(true);
    lastKeystrokeAt.current = Date.now();
    void saveLocalDraft(essay.id, next);
  }

  async function handleKeepMine() {
    if (!conflict) return;
    await snapshotDraft(essay.id, conflict.serverDraft, deviceNameRef.current);
    const result = await forceSaveDraft(essay.id, content, conflict.serverRevision);
    if (result.ok) {
      setRevision(result.revision);
      setDirty(false);
      lastCloudSaveAt.current = Date.now();
      setConflict(null);
      setSaveStatus('saved');
    } else {
      setConflict(result.conflict);
    }
  }

  async function handleTakeTheirs() {
    if (!conflict) return;
    await snapshotDraft(essay.id, content, deviceNameRef.current);
    setContent(conflict.serverDraft);
    setRevision(conflict.serverRevision);
    setDirty(false);
    await saveLocalDraft(essay.id, conflict.serverDraft);
    setConflict(null);
    setSaveStatus('saved');
  }

  function openMerge() {
    if (!conflict) return;
    setMergedText(`${content}\n\n--- 상대 기기 버전 ---\n\n${conflict.serverDraft}`);
    setMergeMode(true);
  }

  async function handleSaveMerge() {
    if (!conflict) return;
    await snapshotDraft(essay.id, content, deviceNameRef.current);
    await snapshotDraft(essay.id, conflict.serverDraft, deviceNameRef.current);
    const result = await forceSaveDraft(essay.id, mergedText, conflict.serverRevision);
    if (result.ok) {
      setContent(mergedText);
      setRevision(result.revision);
      setDirty(false);
      await saveLocalDraft(essay.id, mergedText);
      setConflict(null);
      setMergeMode(false);
      setSaveStatus('saved');
    } else {
      setConflict(result.conflict);
    }
  }

  async function handleSaveVersion() {
    await saveVersion(essay.id, content, versionNote);
    setVersionNote('');
    router.refresh();
  }

  const chars = countChars(content);
  const diff = conflict ? diffLines(content, conflict.serverDraft) : [];

  const statusPillClass = !online
    ? 'offline'
    : saveStatus === 'saving'
      ? 'saving'
      : saveStatus === 'error'
        ? 'error'
        : dirty
          ? 'dirty'
          : 'saved';
  const statusText = !online
    ? '오프라인 — 로컬에 저장 중'
    : saveStatus === 'saving'
      ? '저장 중…'
      : saveStatus === 'error'
        ? '저장 실패 (재시도 대기)'
        : dirty
          ? '변경됨 (곧 자동저장)'
          : '저장됨';

  // 솔→뮤즈→렌즈→콤마 파이프라인 중 어느 단계든 돌고 있으면 "기업 조사
  // 다시 요청"을 막는다 — 안 막으면 뒷단이 도는 도중에 사용자가 새 체인을
  // 또 시작해 같은 자소서에 두 파이프라인이 동시에 도는 사고가 난다.
  const pipelinePending = companyPending || writerPending || reviewPending || subtitlePending;

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-title">
        <div>
          <p className="eyebrow">LOCAL DOCUMENT STUDIO</p>
          <h2>{essay.title}</h2>
          <p>
            <Link href="/dashboard" style={{ color: 'var(--text-3)' }}>
              ← 대시보드로
            </Link>
          </p>
        </div>
        <span className={`status-pill ${statusPillClass}`}>
          <i />
          {statusText}
        </span>
      </div>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        {showQuestionForm ? (
          <form onSubmit={handleSaveQuestionSettings} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text-3)' }}>
              문항 — 뮤즈가 이 질문에 답하는 초안을 씁니다
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="예: 지원 동기와 입사 후 포부를 서술하시오."
                className="field-input"
                rows={3}
                style={{ marginTop: 4, resize: 'vertical' }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 200 }}>
              목표 글자수 (공백 포함)
              <input
                type="number"
                min={0}
                value={targetChars}
                onChange={(event) => setTargetChars(Number(event.target.value))}
                className="field-input"
                style={{ marginTop: 4 }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="run-button" disabled={savingQuestion}>
                {savingQuestion ? '저장 중…' : '문항 저장'}
              </button>
              <button type="button" className="secondary-button" onClick={() => setShowQuestionForm(false)}>
                취소
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>문항</span>
              <p style={{ margin: '4px 0 0' }}>{essay.question || '문항이 설정되지 않았습니다.'}</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text-dim)', fontSize: 12 }}>
                목표 {essay.target_chars.toLocaleString('ko-KR')}자 (공백 포함)
              </p>
            </div>
            <button type="button" className="secondary-button" onClick={() => setShowQuestionForm(true)}>
              문항 설정
            </button>
          </div>
        )}
      </div>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        {showCompanyForm ? (
          <form onSubmit={handleRequestCompanyResearch} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text-3)' }}>
              기업명
              <input
                type="text"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                required
                className="field-input"
                style={{ marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text-3)' }}>
              직무
              <input
                type="text"
                value={companyRole}
                onChange={(event) => setCompanyRole(event.target.value)}
                className="field-input"
                style={{ marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text-3)' }}>
              채용공고(JD) · 선택
              <textarea
                value={companyJd}
                onChange={(event) => setCompanyJd(event.target.value)}
                rows={4}
                className="field-input"
                style={{ marginTop: 4, resize: 'vertical' }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text-3)' }}>
              추가로 궁금한 점 · 선택
              <textarea
                value={companyInstruction}
                onChange={(event) => setCompanyInstruction(event.target.value)}
                rows={3}
                placeholder="예: 경쟁사 대비 기술 스택 차이 위주로 알려줘 / 최근 조직개편이나 인수합병 이슈가 있는지 확인해줘"
                className="field-input"
                style={{ marginTop: 4, resize: 'vertical' }}
              />
            </label>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              첨부 자료 · 선택 (DART 공시자료 등 — PDF·MD, 20MB 이하)
              {companyAttachments.length > 0 && (
                <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {companyAttachments.map((attachment) => (
                    <li key={attachment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span>
                        {attachment.file_name}
                        {formatFileSize(attachment.size_bytes) && ` (${formatFileSize(attachment.size_bytes)})`}
                      </span>
                      <button type="button" className="inline-danger-button" onClick={() => handleDeleteAttachment(attachment.id)}>
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input
                ref={attachmentInputRef}
                type="file"
                accept=".pdf,.md,.markdown"
                onChange={handleUploadAttachment}
                disabled={uploadingAttachment}
                className="field-input"
                style={{ marginTop: 6 }}
              />
              {uploadingAttachment && <p className="essay-revision-message" style={{ margin: '4px 0 0' }}>업로드 중…</p>}
              {attachmentError && <p className="essay-revision-message" style={{ margin: '4px 0 0' }}>{attachmentError}</p>}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
              조사가 끝나면 자동으로 초안 작성(뮤즈) → 검수(렌즈) → 소제목 제안(콤마)까지 이어서 실행됩니다. 경험 카드가 하나도 없으면 뮤즈 단계에서 멈춥니다. 첨부 자료가 있으면 솔이 함께 읽습니다.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="run-button" disabled={savingCompany}>
                {savingCompany ? '요청 중…' : '기업 조사부터 소제목까지 실행 (솔)'}
              </button>
              <button type="button" className="secondary-button" onClick={() => setShowCompanyForm(false)}>
                취소
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>지원 기업</span>
              <p style={{ margin: '4px 0 0' }}>{jobPost ? `${jobPost.company} · ${jobPost.role}` : '연결된 채용공고가 없습니다.'}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowCompanyForm(true)}
                disabled={pipelinePending}
              >
                {pipelinePending
                  ? runnerOnline
                    ? companyPending
                      ? '조사 중…'
                      : writerPending
                        ? '초안 작성 중…'
                        : reviewPending
                          ? '검수 중…'
                          : '소제목 작성 중…'
                    : '대기 중 — 러너 꺼짐'
                  : jobPost
                    ? '기업 조사 다시 요청'
                    : '기업 조사 요청 (솔)'}
              </button>
              {(() => {
                const jobId = queuedJobId('company') ?? queuedJobId('writer') ?? queuedJobId('review') ?? queuedJobId('subtitle');
                return jobId && (
                  <button type="button" className="inline-danger-button" onClick={() => handleCancelJob(jobId)} title="러너가 켜질 때까지 대기 중인 요청을 취소합니다">
                    취소
                  </button>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {presenceOthers.length > 0 && (
        <div className="banner info" style={{ marginBottom: 14 }}>
          다른 기기에서도 열려 있음: {presenceOthers.join(', ')}
        </div>
      )}

      {conflict && !mergeMode && (
        <div className="banner warn" style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700 }}>다른 기기에서 수정됨</p>
          <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.85 }}>
            상대 버전 저장 시각: {formatDateTime(conflict.serverUpdatedAt)}
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={handleKeepMine} className="run-button">
              내 것 유지
            </button>
            <button type="button" onClick={handleTakeTheirs} className="secondary-button">
              상대 것 가져오기
            </button>
            <button type="button" onClick={openMerge} className="secondary-button">
              수동 병합
            </button>
          </div>
          <div style={{ fontSize: 11, marginBottom: 4 }}>
            <span className="diff-line mine" style={{ padding: '2px 6px' }}>
              내 버전에만
            </span>{' '}
            <span className="diff-line theirs" style={{ padding: '2px 6px' }}>
              상대 버전에만
            </span>
          </div>
          <div className="diff-view">
            {diff.map((line, index) => (
              <div key={index} className={`diff-line ${line.type}`}>
                {line.text || ' '}
              </div>
            ))}
          </div>
        </div>
      )}

      {conflict && mergeMode && (
        <div className="banner warn" style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700 }}>수동 병합 — 아래 내용을 정리한 뒤 저장하세요</p>
          <textarea
            value={mergedText}
            onChange={(event) => setMergedText(event.target.value)}
            rows={16}
            className="writing-area"
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={handleSaveMerge} className="run-button">
              병합 결과 저장
            </button>
            <button type="button" onClick={() => setMergeMode(false)} className="secondary-button">
              취소
            </button>
          </div>
        </div>
      )}

      <div className="card card-pad">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <input
            type="text"
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            onBlur={handleSubtitleBlur}
            disabled={!!conflict}
            className="field-input"
            placeholder="소제목 (선택 — 문항 답변 앞에 붙는 한 줄 헤드라인)"
            style={{ fontWeight: 700 }}
          />
          <button type="button" onClick={handleRequestSubtitle} disabled={subtitlePending} className="secondary-button">
            {subtitlePending ? (runnerOnline ? '짓는 중…' : '대기 중 — 러너 꺼짐') : '소제목 생성 (Gemini)'}
          </button>
          {queuedJobId('subtitle') && (
            <button type="button" className="inline-danger-button" onClick={() => handleCancelJob(queuedJobId('subtitle')!)} title="러너가 켜질 때까지 대기 중인 요청을 취소합니다">
              취소
            </button>
          )}
        </div>
        <textarea
          value={content}
          onChange={handleChange}
          disabled={!!conflict}
          className="writing-area"
          placeholder="자소서 내용을 입력하세요…"
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, flexWrap: 'wrap', gap: 10 }}>
          <div className="count-pills">
            <span>
              공백 포함 <b>{chars.withSpaces.toLocaleString('ko-KR')}</b>
            </span>
            <span>
              공백 제외 <b>{chars.withoutSpaces.toLocaleString('ko-KR')}</b>
            </span>
            {essay.target_chars ? (
              <span>
                목표 <b>{essay.target_chars.toLocaleString('ko-KR')}</b>
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={handleRequestWriterDraft} disabled={writerPending} className="secondary-button">
                {writerPending ? (runnerOnline ? '작성 중…' : '대기 중 — 러너 꺼짐') : 'AI 초안 생성 (뮤즈)'}
              </button>
              {queuedJobId('writer') && (
                <button type="button" className="inline-danger-button" onClick={() => handleCancelJob(queuedJobId('writer')!)} title="러너가 켜질 때까지 대기 중인 요청을 취소합니다">
                  취소
                </button>
              )}
              <button type="button" onClick={handleRequestReview} disabled={reviewPending} className="secondary-button">
                {reviewPending ? (runnerOnline ? '검수 진행 중…' : '대기 중 — 러너 꺼짐') : 'AI 검수 요청 (렌즈)'}
              </button>
              {queuedJobId('review') && (
                <button type="button" className="inline-danger-button" onClick={() => handleCancelJob(queuedJobId('review')!)} title="러너가 켜질 때까지 대기 중인 요청을 취소합니다">
                  취소
                </button>
              )}
            </div>
            {!runnerOnline && (
              <span style={{ fontSize: 11, color: 'var(--danger)' }}>
                노트북에서 러너(<code>npm run start</code>)가 꺼져 있습니다
                {reviewPending || writerPending ? ' — 켜면 대기 중인 요청이 처리됩니다' : ''}
              </span>
            )}
          </div>
        </div>
        <form className="essay-revision" onSubmit={handleRequestRevision}>
          <label htmlFor="revision-input">뮤즈에게 수정 요청</label>
          <div>
            <input
              id="revision-input"
              value={revisionInput}
              onChange={(event) => setRevisionInput(event.target.value)}
              placeholder="예: 2문단을 더 구체적으로, 수치를 앞에 두고 짧게"
              disabled={revisionBusy || writerPending}
            />
            <button type="submit" className="secondary-button" disabled={revisionBusy || writerPending || !revisionInput.trim()}>
              {writerPending ? '고치는 중…' : '고쳐줘'}
            </button>
          </div>
          <p>
            지금 화면의 본문을 기준으로 고칩니다. 이전 요청도 함께 기억하므로 이어서 말하듯 시켜도 됩니다.
            {revisionRequests.length > 0 && (
              <>
                {' · '}
                <button type="button" onClick={handleClearRevisions} disabled={revisionBusy}>
                  이전 요청 {revisionRequests.length}개 지우기
                </button>
              </>
            )}
          </p>
          {revisionRequests.length > 0 && (
            <ol className="essay-revision-history">
              {revisionRequests.map((item) => (
                <li key={item.id}>{item.instruction}</li>
              ))}
            </ol>
          )}
          {revisionMessage && <p className="essay-revision-message">{revisionMessage}</p>}
        </form>


        <div className="inline-form" style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <input
            type="text"
            value={versionNote}
            onChange={(event) => setVersionNote(event.target.value)}
            placeholder="버전 메모 (선택)"
            className="field-input"
          />
          <button type="button" onClick={handleSaveVersion} disabled={!!conflict} className="run-button">
            버전 저장
          </button>
        </div>
      </div>

      {companyResearch && (
        <section className="card card-pad" style={{ marginTop: 18 }}>
          <p className="eyebrow">COMPANY RESEARCH</p>
          <h2 style={{ margin: 0, fontSize: 16 }}>솔의 기업 조사</h2>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 14px' }}>
            {formatDateTime(companyResearch.created_at)} · {PROVIDER_LABEL[companyResearch.provider] ?? companyResearch.provider}
          </p>
          <CompanyResearchContent note={companyResearch} company={jobPost?.company ?? companyName} role={jobPost?.role ?? companyRole} />
        </section>
      )}

      {latestSubtitle && (
        <section className="card card-pad" style={{ marginTop: 18 }}>
          <p className="eyebrow">SUBTITLE</p>
          <h2 style={{ margin: 0, fontSize: 16 }}>소제목 제안</h2>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 14px' }}>
            {formatDateTime(latestSubtitle.created_at)} ·{' '}
            {PROVIDER_LABEL[(latestSubtitle.metadata as { provider?: string } | null)?.provider ?? ''] ?? '실행기 정보 없음'}
          </p>
          <SubtitleContent artifact={latestSubtitle} onApply={handleApplySubtitle} applyDisabled={savingSubtitle} />
        </section>
      )}

      {latestDraft && (
        <section className="card card-pad" style={{ marginTop: 18 }}>
          <p className="eyebrow">AI DRAFT</p>
          <h2 style={{ margin: 0, fontSize: 16 }}>뮤즈의 초안</h2>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 14px' }}>
            {formatDateTime(latestDraft.created_at)} ·{' '}
            {PROVIDER_LABEL[(latestDraft.metadata as { provider?: string } | null)?.provider ?? ''] ?? '실행기 정보 없음'}
          </p>
          <DraftContent artifact={latestDraft} onApply={handleApplyDraft} applyDisabled={!!conflict} />
        </section>
      )}

      {latestReview && (
        <section className="card card-pad" style={{ marginTop: 18 }}>
          <p className="eyebrow">QUALITY CHECK</p>
          <h2 style={{ margin: 0, fontSize: 16 }}>렌즈의 검수 결과</h2>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 14px' }}>
            {formatDateTime(latestReview.created_at)} ·{' '}
            {PROVIDER_LABEL[(latestReview.metadata as { provider?: string } | null)?.provider ?? ''] ?? '실행기 정보 없음'}
          </p>
          <ReviewContent artifact={latestReview} />
        </section>
      )}

      {initialVersions.length > 0 && (
        <section className="card card-pad" style={{ marginTop: 18 }}>
          <p className="eyebrow">VERSION HISTORY</p>
          <h2 style={{ margin: 0, fontSize: 16 }}>버전 기록 ({initialVersions.length})</h2>
          <ul className="version-list">
            {initialVersions.map((version) => (
              <li key={version.id}>
                v{version.version} · {formatDateTime(version.created_at)} · 공백포함{' '}
                {version.chars_with_spaces.toLocaleString('ko-KR')}자
                {version.note ? ` · ${version.note}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function isReviewResult(value: unknown): value is ReviewResult {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.overall_assessment === 'string' && Array.isArray(record.issues);
}

function isWriterResult(value: unknown): value is WriterResult {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.draft === 'string' && Array.isArray(record.evidence);
}

function isSubtitleResult(value: unknown): value is SubtitleResult {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.subtitle === 'string' && typeof record.rationale === 'string';
}

function SubtitleContent({
  artifact,
  onApply,
  applyDisabled,
}: {
  artifact: Artifact;
  onApply: (subtitle: string) => void;
  applyDisabled: boolean;
}) {
  const metadata = artifact.metadata as { parsed?: unknown } | null;
  const parsed = metadata?.parsed;

  if (!isSubtitleResult(parsed)) {
    return <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-2)' }}>{artifact.content}</pre>;
  }

  return (
    <div>
      <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 6px' }}>{parsed.subtitle}</p>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 12px' }}>{parsed.rationale}</p>
      <button type="button" className="run-button" disabled={applyDisabled} onClick={() => onApply(parsed.subtitle)}>
        이 소제목 적용
      </button>
    </div>
  );
}

// research_notes.body에는 러너가 저장한 원본 JSON 문자열이 그대로 들어있다
// (artifacts처럼 별도 metadata.parsed 컬럼이 없다). 화면에는 항상 마크다운으로
// 조립해 보여준다 — 미리보기·MD 다운로드·PDF 다운로드가 정확히 같은 내용을
// 보게 하려는 것이라, 필드별 커스텀 레이아웃과 마크다운 두 갈래로 관리하지 않는다.
function CompanyResearchContent({ note, company, role }: { note: ResearchNote; company: string; role: string }) {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(note.body);
  } catch {
    // 아래에서 원문으로 대체 표시
  }

  if (!isCompanyResult(parsed)) {
    return <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-2)' }}>{note.body}</pre>;
  }

  const markdown = companyResearchToMarkdown(parsed as CompanyResult, {
    company,
    role,
    createdAt: formatDateTime(note.created_at),
    providerLabel: PROVIDER_LABEL[note.provider] ?? note.provider,
  });

  return <CompanyResearchMarkdownView markdown={markdown} fileBaseName={`${company}-${role}-기업조사`} />;
}

function CompanyResearchMarkdownView({ markdown, fileBaseName }: { markdown: string; fileBaseName: string }) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    setPdfError('');
    try {
      await downloadMarkdownAsPdf(markdown, `${sanitizeFileName(fileBaseName)}.pdf`);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'PDF를 만들지 못했습니다.');
    } finally {
      setDownloadingPdf(false);
    }
  }

  function handleDownloadMd() {
    downloadTextFile(markdown, `${sanitizeFileName(fileBaseName)}.md`, 'text/markdown');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" className="secondary-button" onClick={handleDownloadMd}>
          MD 다운로드
        </button>
        <button type="button" className="secondary-button" onClick={handleDownloadPdf} disabled={downloadingPdf}>
          {downloadingPdf ? 'PDF 만드는 중…' : 'PDF 다운로드'}
        </button>
      </div>
      {pdfError && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '0 0 10px' }}>{pdfError}</p>}
      <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: markdownToHtml(markdown) }} />
    </div>
  );
}

// §14 3겹(사후 대조) 결과 — 러너가 코드로 대조해 이미 계산해 둔 값을 그대로
// 보여준다. 위반이 있어도 자동 폐기하지 않고 사용자가 보고 판단하게 한다.
function DraftContent({
  artifact,
  onApply,
  applyDisabled,
}: {
  artifact: Artifact;
  onApply: (draftText: string) => void;
  applyDisabled: boolean;
}) {
  const metadata = artifact.metadata as { parsed?: unknown; evidenceViolations?: EvidenceItem[] } | null;
  const parsed = metadata?.parsed;
  const violations = metadata?.evidenceViolations ?? [];

  if (!isWriterResult(parsed)) {
    return <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-2)' }}>{artifact.content}</pre>;
  }

  return (
    <div>
      {violations.length > 0 && (
        <div className="banner warn" style={{ marginBottom: 12 }}>
          <b>근거 불일치 {violations.length}건</b> — 존재하지 않는 경험 카드를 인용했습니다. 적용 전에 확인하세요.
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {violations.map((item, index) => (
              <li key={index}>{item.quoted_fact}</li>
            ))}
          </ul>
        </div>
      )}
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-1)', lineHeight: 1.7, fontFamily: 'inherit' }}>
        {parsed.draft}
      </pre>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '10px 0' }}>근거 {parsed.evidence.length}건 인용됨</p>
      <button type="button" className="run-button" disabled={applyDisabled} onClick={() => onApply(parsed.draft)}>
        이 초안을 에디터에 적용
      </button>
    </div>
  );
}

// 렌즈 출력이 JSON 스키마를 못 지켰을 수도 있어(§9 --json-schema가 100%
// 보장하진 않음) 원문 텍스트로 안전하게 대체 표시한다.
function ReviewContent({ artifact }: { artifact: Artifact }) {
  const metadata = artifact.metadata as { parsed?: unknown } | null;
  const parsed = metadata?.parsed;

  if (!isReviewResult(parsed)) {
    return <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-2)' }}>{artifact.content}</pre>;
  }

  return (
    <div>
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>{parsed.overall_assessment}</p>
      {parsed.job_fit_score != null && (
        <p style={{ fontSize: 13 }}>
          직무 적합도: <b>{parsed.job_fit_score}%</b>
        </p>
      )}
      {parsed.issues.length > 0 ? (
        <ul style={{ paddingLeft: 18, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {parsed.issues.map((issue, index) => (
            <li key={index}>
              <span className="status-pill dirty" style={{ marginRight: 6 }}>
                {CATEGORY_LABEL[issue.category] ?? issue.category}
              </span>
              <q>{issue.paragraph_excerpt}</q>
              <div style={{ color: 'var(--text-3)', marginTop: 2 }}>{issue.comment}</div>
              {issue.suggested_revision && (
                <div style={{ color: 'var(--cyan)', marginTop: 2 }}>제안: {issue.suggested_revision}</div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>지적된 문제가 없습니다.</p>
      )}
    </div>
  );
}
