import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { PDFParse } from 'pdf-parse';

// §8 컨텍스트 팩의 최소 형태. 문항·JD·경험 카드 등 에이전트별 파일 생성은
// 4단계(에이전트 이식)에서 구체화한다 — 지금은 3단계(러너 엔진) 검증에 필요한
// "작업 폴더 생성 + 원재료 기록"까지만 한다.
export function workspaceRoot(runId) {
  return resolve(homedir(), '.career-atelier', 'workspaces', runId);
}

export function createWorkspace(runId, job) {
  const workspace = workspaceRoot(runId);
  const contextDir = resolve(workspace, 'context');
  const outputDir = resolve(workspace, 'output');
  mkdirSync(contextDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(
    resolve(contextDir, '00-INDEX.md'),
    `# 컨텍스트 팩\n\njob.kind: ${job.kind}\njob.id: ${job.id}\n\n(4단계에서 에이전트별 파일로 구체화 예정)\n`,
  );
  writeFileSync(resolve(contextDir, '99-payload.json'), JSON.stringify(job.payload ?? {}, null, 2));

  return { workspace, contextDir, outputDir };
}

function experienceCardMarkdown(item, { includeId = false } = {}) {
  const heading = includeId ? `### [id: ${item.id}] ${item.title}` : `### ${item.title}`;
  return [
    heading,
    `- 1. 상황/맥락: ${item.context || item.situation || '없음'}`,
    `- 2. 문제: ${item.problem || item.task || '없음'}`,
    `- 3. 내 역할: ${item.role_scope || '없음'}`,
    `- 4. 판단: ${item.judgment || '없음'}`,
    `- 5. 행동: ${item.action || '없음'}`,
    `- 6. 결과: ${item.result || '없음'}`,
    `- 결과 수치/객관적 변화: ${(item.metrics ?? []).join(', ') || '없음'}`,
    `- 7. 시행착오: ${item.trial_error || '없음'}`,
    `- 8. 회고: ${item.reflection || '없음'}`,
    `- 9. 활용 태그: ${(item.tags ?? []).join(', ') || '없음'}`,
  ].join('\n');
}

// §14 "경험 근거 강제" 3겹 중 렌즈가 담당하는 부분 — 팩에 없는 수치·회사명·
// 성과가 본문에 있는지 교차 검수한다. 4단계 첫 수직 슬라이스.
export const REVIEW_JSON_SCHEMA = {
  type: 'object',
  required: ['overall_assessment', 'job_fit_score', 'issues'],
  properties: {
    overall_assessment: { type: 'string' },
    job_fit_score: { type: ['integer', 'null'] },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['category', 'paragraph_excerpt', 'comment'],
        properties: {
          category: { type: 'string', enum: ['fact_error', 'overclaim', 'job_fit', 'suggestion'] },
          paragraph_excerpt: { type: 'string' },
          comment: { type: 'string' },
          suggested_revision: { type: 'string' },
        },
      },
    },
  },
};

export function createReviewContextPack(runId, { essay, experiences, jobPost }) {
  const workspace = workspaceRoot(runId);
  const contextDir = resolve(workspace, 'context');
  const schemaDir = resolve(workspace, 'schema');
  const outputDir = resolve(workspace, 'output');
  mkdirSync(contextDir, { recursive: true });
  mkdirSync(schemaDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(
    resolve(contextDir, '00-INDEX.md'),
    [
      '# 컨텍스트 팩 — 렌즈(검수)',
      '',
      '- 01-essay-draft.md: 검수 대상 자소서 (근거로 인용 가능)',
      '- 02-experiences.md: 사용자의 실제 경험 — 사실 확인의 기준 (근거로 인용 가능)',
      '- 03-job-description.md: 지원 직무 정보 (있을 때만, 근거로 인용 가능)',
      '',
    ].join('\n'),
  );

  writeFileSync(resolve(contextDir, '01-essay-draft.md'), essay.draft || '(본문 없음)');

  const experiencesText = experiences.length
    ? experiences.map((item) => experienceCardMarkdown(item)).join('\n\n')
    : '(등록된 경험 카드 없음 — 본문의 모든 수치·회사명·성과를 근거 불명으로 간주할 것)';
  writeFileSync(resolve(contextDir, '02-experiences.md'), experiencesText);

  const jobText = jobPost
    ? `## ${jobPost.company} · ${jobPost.role}\n\n${jobPost.description || ''}\n\n요구 역량: ${(jobPost.requirements ?? []).join(', ')}`
    : '(연결된 채용공고 없음 — job_fit_score는 null로 반환할 것)';
  writeFileSync(resolve(contextDir, '03-job-description.md'), jobText);

  writeFileSync(resolve(schemaDir, 'review.json'), JSON.stringify(REVIEW_JSON_SCHEMA, null, 2));

  return { workspace, contextDir, outputDir, schemaPath: resolve(schemaDir, 'review.json') };
}

// §14 "경험 근거 강제" 2겹 — 출력 스키마에 근거 배열을 필수로 넣는다.
// evidence[].experience_id는 04-experiences.md에 적힌 id와 정확히 같아야
// index.mjs의 3겹(사후 대조)이 검증할 수 있다.
export const WRITER_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['draft', 'evidence'],
  additionalProperties: false,
  properties: {
    draft: { type: 'string' },
    evidence: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['paragraph_index', 'experience_id', 'quoted_fact'],
        additionalProperties: false,
        properties: {
          paragraph_index: { type: 'integer' },
          experience_id: { type: 'string' },
          quoted_fact: { type: 'string' },
        },
      },
    },
  },
};

const DEFAULT_STYLE_GUIDE = [
  '- 1인칭으로, 담백하게 쓴다. "저는 ~했습니다" 반복을 피하고 문장 구조를 다양하게 가져간다.',
  '- 추상적 형용사(열정적인, 헌신적인, 최선을 다해)보다 구체적 행동과 수치로 보여준다.',
  '- 목표 글자수를 넘기지 않는다. 공백 포함 기준으로 계산한다.',
  '- 상투적 도입("안녕하십니까", "저는 ~에서 태어나")으로 시작하지 않는다.',
].join('\n');

// §14 1겹 — 04-experiences.md가 비어 있으면 호출 전에 index.mjs가 실행 자체를
// 거부한다(이 함수는 그 이후에만 불린다).
export function createWriterContextPack(runId, { essay, experiences, jobPost, currentDraft, revisionRequests }) {
  // 요청이 하나라도 있고 고칠 본문이 있어야 '수정 모드'다.
  const revising = Boolean(currentDraft?.trim()) && (revisionRequests?.length ?? 0) > 0;
  const workspace = workspaceRoot(runId);
  const contextDir = resolve(workspace, 'context');
  const schemaDir = resolve(workspace, 'schema');
  const outputDir = resolve(workspace, 'output');
  mkdirSync(contextDir, { recursive: true });
  mkdirSync(schemaDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(
    resolve(contextDir, '00-INDEX.md'),
    [
      '# 컨텍스트 팩 — 뮤즈(작성)',
      '',
      '- 01-questions.md: 자소서 문항 + 목표 글자수 (근거로 인용 가능)',
      '- 02-job-description.md: 지원 직무 정보 (있을 때만, 근거로 인용 가능)',
      '- 04-experiences.md: 이 폴더 밖의 경험은 절대 인용하지 말 것 — 유일한 사실 근거',
      '- 06-style-guide.md: 문체 규칙',
      ...(revising
        ? [
            '- 07-current-draft.md: 지금 화면에 있는 본문 — 이걸 고치는 것이 이번 임무다',
            '- 08-revision-requests.md: 사용자가 요청한 수정 사항 (아래가 최신)',
          ]
        : []),
      '',
    ].join('\n'),
  );

  writeFileSync(
    resolve(contextDir, '01-questions.md'),
    `## 문항\n${essay.question || '(문항 미지정 — 일반적인 자기소개서로 작성)'}\n\n## 목표 글자수 (공백 포함)\n${essay.target_chars || 700}자`,
  );

  const jobText = jobPost
    ? `## ${jobPost.company} · ${jobPost.role}\n\n${jobPost.description || ''}\n\n요구 역량: ${(jobPost.requirements ?? []).join(', ')}`
    : '(연결된 채용공고 없음)';
  writeFileSync(resolve(contextDir, '02-job-description.md'), jobText);

  const experiencesText = experiences
    .map((item) => experienceCardMarkdown(item, { includeId: true }))
    .join('\n\n');
  writeFileSync(resolve(contextDir, '04-experiences.md'), experiencesText);
  writeFileSync(resolve(contextDir, '06-style-guide.md'), DEFAULT_STYLE_GUIDE);

  // 수정 요청이 있으면 "백지에서 쓰기"가 아니라 "이 글을 고치기"가 된다.
  // 현재 본문과 요청 이력을 함께 넘겨, 앞서 지시한 방향을 되돌리지 않게 한다.
  if (revising) {
    writeFileSync(
      resolve(contextDir, '07-current-draft.md'),
      `## 현재 본문 (이걸 고친다)\n\n${currentDraft}`,
    );
    writeFileSync(
      resolve(contextDir, '08-revision-requests.md'),
      [
        '## 사용자 수정 요청 (위가 오래된 것, 맨 아래가 이번 요청)',
        '',
        '이전 요청으로 이미 반영한 방향은 유지한 채, 맨 아래 요청을 새로 반영한다.',
        '',
        ...revisionRequests.map((item, index) => `${index + 1}. ${item.instruction}`),
      ].join('\n'),
    );
  }

  writeFileSync(resolve(schemaDir, 'writer.json'), JSON.stringify(WRITER_OUTPUT_SCHEMA, null, 2));

  return { workspace, contextDir, outputDir, schemaPath: resolve(schemaDir, 'writer.json') };
}

// 루미(뉴스) — Codex의 자동 web_search 도구 사용(실측 확인: 별도 --search
// 플래그 불필요, 모델이 필요하면 알아서 검색한다). additionalProperties:false는
// OpenAI 구조화 출력 요구사항(§9 실측, WRITER_OUTPUT_SCHEMA와 같은 이유).
export const NEWS_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['summary', 'items'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'source', 'url', 'date', 'implication'],
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          source: { type: 'string' },
          url: { type: 'string' },
          date: { type: 'string' },
          implication: { type: 'string' },
        },
      },
    },
  },
};

export function createNewsContextPack(runId, { interests }) {
  const workspace = workspaceRoot(runId);
  const contextDir = resolve(workspace, 'context');
  const schemaDir = resolve(workspace, 'schema');
  const outputDir = resolve(workspace, 'output');
  mkdirSync(contextDir, { recursive: true });
  mkdirSync(schemaDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(
    resolve(contextDir, '01-interests.md'),
    interests.length ? interests.join(', ') : '(관심 분야 미설정 — IT/채용 시장 전반의 최신 소식을 다룰 것)',
  );
  writeFileSync(resolve(schemaDir, 'news.json'), JSON.stringify(NEWS_OUTPUT_SCHEMA, null, 2));

  return { workspace, contextDir, outputDir, schemaPath: resolve(schemaDir, 'news.json') };
}

// 솔(기업조사) — Claude 사용. 렌즈 실측 결과 Claude의 --json-schema는
// additionalProperties:false 없이도 동작했다(§9) — 굳이 안 붙인다.
export const COMPANY_RESEARCH_SCHEMA = {
  type: 'object',
  required: ['summary', 'facts', 'role_requirements', 'writing_material'],
  properties: {
    summary: { type: 'string' },
    facts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'source_url'],
        properties: {
          claim: { type: 'string' },
          source_url: { type: 'string' },
        },
      },
    },
    role_requirements: { type: 'array', items: { type: 'string' } },
    writing_material: { type: 'array', items: { type: 'string' } },
  },
};

// instruction은 사용자가 다이얼로그에 자유 형식으로 적은 추가 지시(예: "경쟁사
// 대비 기술 스택 차이 위주로", "최근 인수합병 이슈 확인해줘") — 회사/직무/JD로는
// 못 담는 조사 방향을 사용자가 직접 얹을 수 있게 한다.
async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

// 파일명에서 workspace 안전한 stem만 남긴다 — 경로 구분자·특수문자를 지워
// 다른 context 파일과 충돌하거나 워크스페이스 밖으로 못 나가게 한다.
function safeFileStem(fileName) {
  const stem = fileName.replace(/\.[^./\\]+$/, '');
  return stem.replace(/[^A-Za-z0-9가-힣_-]/g, '_').slice(0, 40) || 'file';
}

// 솔(기업조사) 첨부파일 — DART 공시자료 등. Codex/Claude/Antigravity 중 어느
// CLI가 PDF를 직접 읽을 수 있는지 실측하지 않았으므로, Node에서 미리 텍스트로
// 뽑아 어떤 프로바이더를 쓰든 동일하게 읽게 한다. 실패한 파일은 건너뛰고
// 계속 진행한다 — 첨부 하나가 깨졌다고 조사 자체를 막을 이유는 없다.
async function writeCompanyAttachments(contextDir, attachments, supabase) {
  if (!attachments?.length) return { hasAttachments: false, notes: '(첨부파일 없음)' };

  const notes = [];
  for (const [index, attachment] of attachments.entries()) {
    const outFile = `04-attachment-${index + 1}-${safeFileStem(attachment.file_name)}.md`;
    try {
      const { data, error } = await supabase.storage.from('company-research').download(attachment.storage_path);
      if (error || !data) throw new Error(error?.message ?? '다운로드 결과가 비었습니다.');
      const buffer = Buffer.from(await data.arrayBuffer());

      const text = /\.pdf$/i.test(attachment.file_name)
        ? await extractPdfText(buffer)
        : buffer.toString('utf8');

      writeFileSync(resolve(contextDir, outFile), `# ${attachment.file_name}\n\n${text}`);
      notes.push(`- ${attachment.file_name} → context/${outFile}`);
    } catch (error) {
      notes.push(`- ${attachment.file_name}: 처리 실패(${error.message})`);
    }
  }
  return { hasAttachments: true, notes: notes.join('\n') };
}

export async function createCompanyContextPack(runId, { company, role, jobDescription, instruction, attachments, supabase }) {
  const workspace = workspaceRoot(runId);
  const contextDir = resolve(workspace, 'context');
  const schemaDir = resolve(workspace, 'schema');
  const outputDir = resolve(workspace, 'output');
  mkdirSync(contextDir, { recursive: true });
  mkdirSync(schemaDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(resolve(contextDir, '01-company.md'), `## 기업\n${company}\n\n## 직무\n${role || '(미지정)'}`);
  writeFileSync(resolve(contextDir, '02-job-description.md'), jobDescription || '(JD 미제공)');
  writeFileSync(resolve(contextDir, '03-user-instruction.md'), (instruction || '').trim() || '(추가 지시 없음 — 회사·직무·JD 기준으로 일반 조사)');
  const { hasAttachments } = await writeCompanyAttachments(contextDir, attachments, supabase);
  writeFileSync(resolve(schemaDir, 'company.json'), JSON.stringify(COMPANY_RESEARCH_SCHEMA, null, 2));

  return { workspace, contextDir, outputDir, schemaPath: resolve(schemaDir, 'company.json'), hasAttachments };
}

// 모카(채용탐색) — Codex 사용, additionalProperties:false 필요(§9 실측).
// 결과는 job_posts에 URL 기준 upsert된다(index.mjs) — url이 빈 문자열이면
// 안 된다는 걸 스키마 설명에도 명시한다.
export const JOBS_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['jobs'],
  additionalProperties: false,
  properties: {
    jobs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['company', 'role', 'url', 'deadline', 'description', 'requirements', 'fit_score', 'source'],
        additionalProperties: false,
        properties: {
          company: { type: 'string' },
          role: { type: 'string' },
          url: { type: 'string' },
          deadline: { type: ['string', 'null'] },
          description: { type: 'string' },
          requirements: { type: 'array', items: { type: 'string' } },
          fit_score: { type: 'integer' },
          source: { type: 'string' },
        },
      },
    },
  },
};

export function createJobsContextPack(runId, { targetRoles, interests, experiences }) {
  const workspace = workspaceRoot(runId);
  const contextDir = resolve(workspace, 'context');
  const schemaDir = resolve(workspace, 'schema');
  const outputDir = resolve(workspace, 'output');
  mkdirSync(contextDir, { recursive: true });
  mkdirSync(schemaDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(
    resolve(contextDir, '01-profile.md'),
    [
      `## 목표 직무\n${targetRoles.length ? targetRoles.join(', ') : '(미지정)'}`,
      `## 관심 분야\n${interests.length ? interests.join(', ') : '(미지정)'}`,
    ].join('\n\n'),
  );

  const experiencesText = experiences.length
    ? experiences.map((item) => `- ${item.title}: ${(item.tags ?? []).join(', ') || '태그 없음'}`).join('\n')
    : '(등록된 경험 카드 없음 — fit_score를 보수적으로 매길 것)';
  writeFileSync(resolve(contextDir, '02-experiences.md'), experiencesText);
  writeFileSync(resolve(schemaDir, 'jobs.json'), JSON.stringify(JOBS_OUTPUT_SCHEMA, null, 2));

  return { workspace, contextDir, outputDir, schemaPath: resolve(schemaDir, 'jobs.json') };
}

export const INTERVIEW_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['questions'],
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      minItems: 6,
      maxItems: 12,
      items: {
        type: 'object',
        required: ['question', 'answer_markdown'],
        additionalProperties: false,
        properties: {
          question: { type: 'string', description: '실제 면접관이 물을 법한 구체적인 한국어 질문' },
          answer_markdown: { type: 'string', description: '경험 카드 근거만 사용한 한국어 Markdown 답안. 근거가 없으면 [내 경험 입력 필요] 표시' },
        },
      },
    },
  },
};

export function createInterviewContextPack(runId, { jobPost, researchNotes, experiences, existingQuestions }) {
  const workspace = workspaceRoot(runId);
  const contextDir = resolve(workspace, 'context');
  const schemaDir = resolve(workspace, 'schema');
  const outputDir = resolve(workspace, 'output');
  mkdirSync(contextDir, { recursive: true });
  mkdirSync(schemaDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(
    resolve(contextDir, '00-INDEX.md'),
    [
      '# 컨텍스트 팩 — 에코(면접 코치)',
      '',
      '- 01-job-description.md: 대상 기업·직무·JD',
      '- 02-company-research.md: 저장된 기업 조사 자료',
      '- 03-experiences.md: 답안에 사용할 수 있는 유일한 사용자 사실 근거',
      '- 04-existing-questions.md: 중복을 피해야 하는 기존 질문',
      '',
      '03-experiences.md에 없는 사실은 만들지 않는다.',
    ].join('\n'),
  );
  writeFileSync(resolve(contextDir, '01-job-description.md'), `# ${jobPost.company} · ${jobPost.role}\n\n${jobPost.description || '(JD 없음)'}\n\n## 요구 역량\n${(jobPost.requirements ?? []).map((item) => `- ${item}`).join('\n') || '- 미입력'}`);
  writeFileSync(resolve(contextDir, '02-company-research.md'), researchNotes.length ? researchNotes.map((item) => `## ${item.title}\n\n${item.body}`).join('\n\n') : '(저장된 기업 조사 없음 — JD 범위 안에서만 질문할 것)');
  writeFileSync(resolve(contextDir, '03-experiences.md'), experiences.length ? experiences.map((item) => experienceCardMarkdown(item, { includeId: true })).join('\n\n') : '(등록된 경험 없음 — 모든 경험형 답안에 [내 경험 입력 필요]를 표시할 것)');
  writeFileSync(resolve(contextDir, '04-existing-questions.md'), existingQuestions.length ? existingQuestions.map((item) => `- ${item.question}`).join('\n') : '(기존 질문 없음)');
  writeFileSync(resolve(schemaDir, 'interview.json'), JSON.stringify(INTERVIEW_OUTPUT_SCHEMA, null, 2));

  return { workspace, contextDir, outputDir, schemaPath: resolve(schemaDir, 'interview.json') };
}

// 6번째 비서(소제목) — Gemini(Antigravity CLI)로 실행한다(사용자 요청,
// 2026-09-01). 완성된 본문에서 뽑아내는 요약이라 §14 evidence 배열은
// 강제하지 않는다. description을 반드시 채운다 — 실측 결과 agy는
// description 없는 필드에 "작업을 완료했다"는 메타 요약을 채워 넣는
// 오작동을 보였다(runner/README.md 참고).
export const SUBTITLE_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['subtitle', 'rationale'],
  additionalProperties: false,
  properties: {
    subtitle: {
      type: 'string',
      description: '실제로 제안하는 소제목 문구 그 자체(15자 이내). 작업 완료 여부에 대한 메타 설명이 아니라 진짜 소제목이어야 한다.',
    },
    rationale: { type: 'string', description: '왜 이 소제목을 골랐는지 1문장' },
  },
};

export function createSubtitleContextPack(runId, { essay, existingSubtitle }) {
  const workspace = workspaceRoot(runId);
  const contextDir = resolve(workspace, 'context');
  const schemaDir = resolve(workspace, 'schema');
  const outputDir = resolve(workspace, 'output');
  mkdirSync(contextDir, { recursive: true });
  mkdirSync(schemaDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(resolve(contextDir, '01-essay-draft.md'), essay.draft || '(본문 없음)');
  writeFileSync(resolve(contextDir, '02-question.md'), essay.question || '(문항 미설정)');
  writeFileSync(resolve(contextDir, '03-existing-subtitle.md'), existingSubtitle || '(기존 소제목 없음 — 새로 짓는다)');
  writeFileSync(resolve(schemaDir, 'subtitle.json'), JSON.stringify(SUBTITLE_OUTPUT_SCHEMA, null, 2));

  return { workspace, contextDir, outputDir, schemaPath: resolve(schemaDir, 'subtitle.json') };
}
