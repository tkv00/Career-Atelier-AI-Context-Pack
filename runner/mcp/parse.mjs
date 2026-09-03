// 정리본(Markdown) → 구조화된 항목. 정규식·문자열 처리만 쓴다.
//
// LLM을 부르지 않는 건 두 가지 이유다. ① §19.2 #4가 파싱 실패 시 LLM 폴백을
// 금지한다. ② 무엇보다 이 서버를 만든 목적이 토큰 절감인데 파싱에 LLM을 쓰면
// 목적이 무너진다.
//
// 애매하면 조용히 추측하지 않고 skipped에 이유를 붙여 돌려준다 — 사용자가
// 보고 고치는 게 맞다(§10 "애매하면 사용자에게 보여 주고 고치게 한다").

// 섹션 제목 → 대상 종류. 위에서부터 먼저 맞는 것을 쓴다.
// "프로젝트"가 experience와 project 양쪽에 걸리고 "교육활동"이 education과
// training 양쪽에 걸려서, 더 구체적인 쪽을 반드시 위에 둔다.
const SECTION_KINDS = [
  [/기본\s*정보|프로필|profile/i, 'profile'],
  [/경험\s*카드|경험|experience/i, 'experience'],
  [/학력|출신\s*학교|education/i, 'education'],
  [/자격증|자격\s*사항|면허|certificat/i, 'certification'],
  [/대외\s*활동|동아리|activity|activities/i, 'activity'],
  [/교육\s*활동|교육\s*이수|연수|training/i, 'training'],
  [/프로젝트|project/i, 'project'],
  [/경력\s*사항|경력|근무|career|work/i, 'work'],
  [/수상|수상\s*내역|award/i, 'award'],
];

// 종류별 필드 별칭. 키는 정규화(공백·기호 제거, 소문자)해서 맞춘다.
const FIELD_ALIASES = {
  experience: {
    context: ['상황', '맥락', '상황맥락', '배경', 'context'],
    problem: ['문제', '과제', '해결할문제', 'problem', 'task'],
    role_scope: ['역할', '내역할', '담당', '담당역할', 'role', 'rolescope'],
    judgment: ['판단', '의사결정', '선택', 'judgment', 'judgement'],
    action: ['행동', '실행', '한일', '수행', 'action'],
    result: ['결과', '성과', 'result', 'outcome'],
    metrics: ['수치', '지표', '정량', '정량지표', 'metrics'],
    trial_error: ['시행착오', '실패', '어려움', '문제점', 'trialerror'],
    reflection: ['회고', '배운점', '느낀점', '교훈', 'reflection'],
    tags: ['태그', '키워드', 'tags', 'keywords'],
  },
  education: {
    school_type: ['구분', '학교구분', '종류', 'type', 'schooltype'],
    major: ['전공', '학과', 'major'],
    secondary_major: ['부전공', '복수전공', '이중전공', 'secondarymajor'],
    gpa: ['학점', '평점', 'gpa', '성적'],
    period: ['기간', '재학기간', 'period'],
    started_on: ['입학', '입학일', '시작', 'startedon'],
    ended_on: ['졸업', '졸업일', '종료', 'endedon'],
    status: ['상태', '학적', 'status'],
    hanja_name: ['한자이름', '한자명', 'hanjaname'],
    memo: ['메모', '비고', 'memo'],
  },
  certification: {
    registration_number: ['등록번호', '자격번호', '자격증번호', '발급번호', 'registrationnumber'],
    acquired_on: ['취득일', '취득', '취득일자', '합격일', 'acquiredon'],
    issuer: ['발급', '발급기관', '주관', '주관기관', 'issuer'],
    grade: ['등급', '급수', 'grade'],
    memo: ['메모', '비고', 'memo'],
  },
  activity: {
    organizer: ['주관', '기관', '단체', '주최', 'organizer'],
    period: ['기간', 'period'],
    started_on: ['시작', '시작일', 'startedon'],
    ended_on: ['종료', '종료일', 'endedon'],
    role: ['역할', '담당', 'role'],
    detail: ['내용', '상세', '설명', '활동내용', 'detail'],
  },
  training: {
    organizer: ['주관', '기관', '교육기관', '주최', 'organizer'],
    period: ['기간', 'period'],
    started_on: ['시작', '시작일', 'startedon'],
    ended_on: ['종료', '종료일', 'endedon'],
    detail: ['내용', '상세', '설명', '교육내용', 'detail'],
  },
  project: {
    organizer: ['주관', '기관', '소속', 'organizer'],
    period: ['기간', 'period'],
    started_on: ['시작', '시작일', 'startedon'],
    ended_on: ['종료', '종료일', 'endedon'],
    role: ['역할', '담당', 'role'],
    detail: ['내용', '상세', '설명', 'detail'],
    repo_url: ['저장소', '깃허브', '리포', 'repo', 'repourl', 'github', 'url', '링크'],
  },
  work: {
    employment_type: ['고용형태', '형태', '구분', '계약형태', 'employmenttype'],
    period: ['기간', '재직기간', 'period'],
    started_on: ['입사', '입사일', '시작', 'startedon'],
    ended_on: ['퇴사', '퇴사일', '종료', 'endedon'],
    leave_reason: ['퇴사사유', '사유', 'leavereason'],
    detail: ['내용', '상세', '업무', '담당업무', 'detail'],
  },
  award: {
    awarded_on: ['수상일', '수상일자', '일자', '수상', 'awardedon'],
    issuer: ['주관', '수여', '수여기관', '주최', 'issuer'],
    grade: ['등급', '상격', '수상등급', 'grade'],
    detail: ['내용', '상세', '설명', 'detail'],
  },
  profile: {
    display_name: ['이름', '성명', '표시이름', 'name', 'displayname'],
    target_roles: ['목표직무', '희망직무', '지원직무', 'targetroles'],
    interests: ['관심분야', '관심사', 'interests'],
    summary: ['소개', '한줄소개', '요약', 'summary'],
  },
};

const normalizeKey = (key) => String(key).toLowerCase().replace(/[\s_·/\-()[\]]/g, '');

function fieldFor(kind, rawKey) {
  const table = FIELD_ALIASES[kind];
  if (!table) return null;
  const key = normalizeKey(rawKey);
  for (const [field, aliases] of Object.entries(table)) {
    if (aliases.some((alias) => normalizeKey(alias) === key)) return field;
  }
  return null;
}

// 날짜 — date 컬럼에 넣을 거라 YYYY-MM-DD가 아니면 넣지 않는다. 모카가
// "상시채용"을 date 컬럼에 넣어 insert가 통째로 깨졌던 것과 같은 사고를
// 막는다(runner/README.md 실측 #9).
export function parseDate(text) {
  const value = String(text ?? '').trim();
  if (!value) return null;
  if (/현재|재직|재학|진행\s*중|present|now/i.test(value)) return null;

  let m = value.match(/(\d{4})\s*[-.\/년]\s*(\d{1,2})\s*[-.\/월]\s*(\d{1,2})/);
  if (m) return iso(m[1], m[2], m[3]);

  m = value.match(/(\d{4})\s*[-.\/년]\s*(\d{1,2})/);
  if (m) return iso(m[1], m[2], 1);

  m = value.match(/^(\d{4})년?$/);
  if (m) return iso(m[1], 1, 1);

  return null;
}

function iso(y, mo, d) {
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const stamp = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // 2월 30일 같은 값은 Date가 넘겨 버리므로 되돌려 대조한다.
  const back = new Date(`${stamp}T00:00:00Z`);
  return Number.isNaN(back.getTime()) || back.toISOString().slice(0, 10) !== stamp ? null : stamp;
}

// "2020-03 ~ 2024-02", "2020.3 - 2024.2", "2020년 3월 ~ 현재"
export function parsePeriod(text) {
  const value = String(text ?? '').trim();
  if (!value) return { started_on: null, ended_on: null };
  const parts = value.split(/\s*[~–—]\s*|\s+-\s+|\s*부터\s*/).filter(Boolean);
  if (parts.length >= 2) return { started_on: parseDate(parts[0]), ended_on: parseDate(parts[1]) };
  return { started_on: parseDate(value), ended_on: null };
}

// "3.82 / 4.5", "3.82(4.5)", "4.5 만점에 3.82", "3.82"
export function parseGpa(text) {
  const value = String(text ?? '').trim();
  const numbers = [...value.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (numbers.length === 0) return { gpa: null, gpa_scale: null };
  if (numbers.length === 1) return { gpa: numbers[0], gpa_scale: null };
  // "4.5 만점에 3.82"처럼 만점이 먼저 나오는 표기가 있어 크기로 가른다.
  const gpa = Math.min(numbers[0], numbers[1]);
  const scale = Math.max(numbers[0], numbers[1]);
  return { gpa, gpa_scale: scale };
}

export function parseList(text) {
  return String(text ?? '')
    .split(/[,·、]|\s{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

// Markdown 본문을 항목 배열로 만든다.
export function parseMarkdown(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  const items = [];
  const skipped = [];

  let kind = null;
  let sectionTitle = null;
  let current = null;
  let lastField = null;

  const flush = () => {
    if (!current) return;
    if (!current.title) {
      skipped.push({ reason: '항목 제목이 비어 있음', line: current.line, kind: current.kind });
    } else {
      items.push(current);
    }
    current = null;
    lastField = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) { lastField = null; continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();

      if (level === 1) {
        flush();
        sectionTitle = text;
        kind = SECTION_KINDS.find(([re]) => re.test(text))?.[1] ?? null;
        if (!kind) skipped.push({ reason: `알 수 없는 섹션 — 어느 표로 넣을지 판단 불가`, heading: text, line: index + 1 });
        continue;
      }

      // ## 이하는 항목 시작. 섹션을 못 알아본 상태면 항목도 버린다.
      flush();
      if (!kind) {
        skipped.push({ reason: `상위 섹션을 알 수 없어 건너뜀`, heading: text, line: index + 1 });
        continue;
      }
      current = { kind, title: text, section: sectionTitle, line: index + 1, fields: {} };
      continue;
    }

    if (!current) continue;

    // "- 키: 값" / "* 키: 값" / "키: 값"
    const bullet = line.match(/^[-*•▪]\s*(.+)$/);
    const body = bullet ? bullet[1] : line;
    const pair = body.match(/^([^:：]{1,24})\s*[:：]\s*(.*)$/);

    if (pair) {
      const field = fieldFor(current.kind, pair[1]);
      if (field) {
        current.fields[field] = pair[2].trim();
        // 부전공과 복수전공은 같은 칸에 들어가지만 DB는 둘을 구분해서 저장한다
        // (secondary_major_type). 어느 쪽으로 적었는지는 여기서만 알 수 있어서
        // 값을 넣는 김에 종류도 같이 정한다.
        if (field === 'secondary_major') {
          current.fields.secondary_major_type = /복수|이중/.test(pair[1]) ? '복수전공' : '부전공';
        }
        lastField = field;
      } else {
        // 못 알아본 키는 버리지 않고 detail 계열에 흘려 둔다 — 사용자가 쓴
        // 내용이 조용히 사라지는 게 제일 나쁘다.
        const sink = FIELD_ALIASES[current.kind].detail ? 'detail'
          : FIELD_ALIASES[current.kind].memo ? 'memo'
          : FIELD_ALIASES[current.kind].reflection ? 'reflection' : null;
        if (sink) {
          current.fields[sink] = `${current.fields[sink] ? `${current.fields[sink]}\n` : ''}${body}`;
          lastField = sink;
        } else {
          skipped.push({ reason: `알 수 없는 항목 키`, key: pair[1].trim(), heading: current.title, line: index + 1 });
        }
      }
      continue;
    }

    // 키가 없는 줄은 직전 필드의 이어짐으로 본다(여러 줄 서술이 흔하다).
    if (lastField) {
      current.fields[lastField] = `${current.fields[lastField]}\n${body}`.trim();
    } else {
      const sink = FIELD_ALIASES[current.kind].detail ? 'detail'
        : FIELD_ALIASES[current.kind].context ? 'context' : null;
      if (sink) {
        current.fields[sink] = `${current.fields[sink] ? `${current.fields[sink]}\n` : ''}${body}`;
        lastField = sink;
      }
    }
  }
  flush();

  return { items, skipped };
}

export { SECTION_KINDS, FIELD_ALIASES };
