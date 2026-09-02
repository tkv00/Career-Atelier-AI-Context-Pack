// 나의 정보 7개 섹션의 필드 정의.
//
// 섹션마다 폼을 손으로 7벌 쓰면 필드 하나 늘 때마다 7군데를 고쳐야 한다.
// 여기 한 곳에 적어 두고 폼·목록·저장이 전부 이걸 읽는다.

export type FieldType = 'text' | 'date' | 'number' | 'textarea' | 'select' | 'url';

export type FieldSpec = {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  wide?: boolean; // 폼에서 두 칸 차지
};

// supabase-js의 .from()은 테이블 이름 리터럴을 요구한다. string으로 두면
// 어느 테이블에 쓰는지 타입이 검사되지 않는다.
export type RecordTable =
  | 'education_records'
  | 'certifications'
  | 'external_activities'
  | 'training_programs'
  | 'project_records'
  | 'work_experiences'
  | 'awards';

export type SectionSpec = {
  id: string;
  table: RecordTable;
  title: string;
  hint: string;
  titleField: string; // 목록에서 큰 글씨로 보여줄 필드
  fields: FieldSpec[];
  attachments?: string[]; // 첨부 종류. 없으면 첨부 UI를 띄우지 않는다
};

export const EMPLOYMENT_TYPES = ['체험형인턴', '연계형인턴', '계약직', '정규직', '프리랜서', '아르바이트'];
export const SCHOOL_TYPES = ['대학교', '고등학교'];
export const EDUCATION_STATUSES = ['재학', '휴학', '졸업', '수료', '중퇴'];
export const SECONDARY_MAJOR_TYPES = ['부전공', '복수전공'];

export const SECTIONS: SectionSpec[] = [
  {
    id: 'education',
    table: 'education_records',
    title: '학력',
    hint: '고등학교와 대학교를 함께 관리합니다. 대학교를 고르면 전공·학점 칸이 열립니다.',
    titleField: 'school_name',
    attachments: ['성적증명서', '졸업증명서', '재학증명서', '기타'],
    fields: [
      { name: 'school_type', label: '구분', type: 'select', options: SCHOOL_TYPES },
      { name: 'school_name', label: '학교명', type: 'text', placeholder: '○○대학교' },
      { name: 'started_on', label: '입학', type: 'date' },
      { name: 'ended_on', label: '졸업·예정', type: 'date' },
      { name: 'status', label: '상태', type: 'select', options: EDUCATION_STATUSES },
      { name: 'major', label: '전공', type: 'text' },
      { name: 'secondary_major', label: '부·복수전공', type: 'text' },
      { name: 'secondary_major_type', label: '부·복수 구분', type: 'select', options: SECONDARY_MAJOR_TYPES },
      { name: 'gpa', label: '학점', type: 'number', placeholder: '3.85' },
      { name: 'gpa_scale', label: '기준', type: 'number', placeholder: '4.5' },
      { name: 'hanja_name', label: '한자 이름', type: 'text', placeholder: '증명서용' },
      { name: 'memo', label: '메모', type: 'textarea', wide: true },
    ],
  },
  {
    id: 'certification',
    table: 'certifications',
    title: '자격증',
    hint: '등록번호까지 적어 두면 지원서에 그대로 옮겨 쓸 수 있습니다.',
    titleField: 'name',
    attachments: ['자격증 사본', '기타'],
    fields: [
      { name: 'name', label: '자격증명', type: 'text' },
      { name: 'registration_number', label: '등록번호', type: 'text' },
      { name: 'acquired_on', label: '취득일', type: 'date' },
      { name: 'issuer', label: '발급기관', type: 'text' },
      { name: 'grade', label: '등급', type: 'text', placeholder: '1급 / 필기 합격' },
      { name: 'memo', label: '메모', type: 'textarea', wide: true },
    ],
  },
  {
    id: 'activity',
    table: 'external_activities',
    title: '대외활동',
    hint: '서포터즈, 학회, 동아리처럼 학교 밖에서 한 활동입니다.',
    titleField: 'name',
    fields: [
      { name: 'name', label: '활동명', type: 'text' },
      { name: 'organizer', label: '주최기관', type: 'text' },
      { name: 'started_on', label: '시작', type: 'date' },
      { name: 'ended_on', label: '종료', type: 'date' },
      { name: 'role', label: '역할', type: 'text' },
      { name: 'detail', label: '세부내용', type: 'textarea', wide: true },
    ],
  },
  {
    id: 'training',
    table: 'training_programs',
    title: '교육활동',
    hint: '부트캠프, 사내 교육, 온라인 과정 등 이수한 교육입니다.',
    titleField: 'name',
    attachments: ['수료증', '기타'],
    fields: [
      { name: 'name', label: '교육명', type: 'text' },
      { name: 'organizer', label: '주최기관', type: 'text' },
      { name: 'started_on', label: '시작', type: 'date' },
      { name: 'ended_on', label: '종료', type: 'date' },
      { name: 'detail', label: '세부내용', type: 'textarea', wide: true },
    ],
  },
  {
    id: 'project',
    table: 'project_records',
    title: '프로젝트',
    hint: '깃허브 링크를 적어 두면 지원서에서 바로 꺼내 쓸 수 있습니다.',
    titleField: 'name',
    fields: [
      { name: 'name', label: '프로젝트명', type: 'text' },
      { name: 'organizer', label: '주최·소속', type: 'text' },
      { name: 'started_on', label: '시작', type: 'date' },
      { name: 'ended_on', label: '종료', type: 'date' },
      { name: 'role', label: '역할', type: 'text' },
      { name: 'repo_url', label: '깃허브 링크', type: 'url', wide: true },
      { name: 'detail', label: '세부내용', type: 'textarea', wide: true },
    ],
  },
  {
    id: 'work',
    table: 'work_experiences',
    title: '경력사항',
    hint: '인턴도 포함합니다. 유형을 구분해 두면 지원 자격 확인이 쉬워집니다.',
    titleField: 'company',
    attachments: ['경력증명서', '재직증명서', '기타'],
    fields: [
      { name: 'company', label: '회사명', type: 'text' },
      { name: 'employment_type', label: '유형', type: 'select', options: EMPLOYMENT_TYPES },
      { name: 'started_on', label: '입사', type: 'date' },
      { name: 'ended_on', label: '퇴사', type: 'date' },
      { name: 'leave_reason', label: '퇴사사유', type: 'text' },
      { name: 'detail', label: '세부내용', type: 'textarea', wide: true },
    ],
  },
  {
    id: 'award',
    table: 'awards',
    title: '수상내역',
    hint: '공모전, 경진대회, 교내 시상 등입니다.',
    titleField: 'name',
    attachments: ['상장 사본', '기타'],
    fields: [
      { name: 'name', label: '수상명', type: 'text' },
      { name: 'awarded_on', label: '수상일', type: 'date' },
      { name: 'issuer', label: '수상기관', type: 'text' },
      { name: 'grade', label: '등급', type: 'text', placeholder: '대상 / 최우수상' },
      { name: 'detail', label: '세부내용', type: 'textarea', wide: true },
    ],
  },
];

export function sectionById(id: string): SectionSpec | undefined {
  return SECTIONS.find((section) => section.id === id);
}

// 대학교에서만 의미가 있는 칸. 고등학교를 고르면 폼에서 숨긴다.
export const UNIVERSITY_ONLY_FIELDS = new Set([
  'major',
  'secondary_major',
  'secondary_major_type',
  'gpa',
  'gpa_scale',
]);
