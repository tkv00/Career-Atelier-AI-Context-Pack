export const PILOTS = [
  { id: 'news', name: '루미', role: '통신 · 뉴스 조사', station: '통신석', frame: 1, color: '#78dcec', instrument: 'signal', href: '/activity', mission: '산업 뉴스와 원문 출처를 수집하고 있습니다.' },
  { id: 'jobs', name: '모카', role: '항로 · 채용 탐색', station: '항법석', frame: 2, color: '#e9bc7a', instrument: 'radar', href: '/records', mission: '채용공고와 프로필을 대조하며 다음 항로를 찾고 있습니다.' },
  { id: 'company', name: '솔', role: '기업정보 해독', station: '분석석', frame: 3, color: '#84b8f6', instrument: 'scan', href: '/records', mission: '기업 자료를 조사하고 지원에 필요한 근거를 정리하고 있습니다.' },
  { id: 'writer', name: '뮤즈', role: '자소서 작성', station: '작성석', frame: 4, color: '#c9b6f0', instrument: 'write', href: '/records', mission: '경험과 문항을 연결해 자기소개서 초안을 작성하고 있습니다.' },
  { id: 'review', name: '렌즈', role: '근거 검수', station: '검수석', frame: 5, color: '#87d4b0', instrument: 'scan', href: '/records', mission: '과장된 표현과 빠진 근거를 확인하고 있습니다.' },
  { id: 'interview', name: '에코', role: '면접 코치', station: '교신석', frame: 6, color: '#efaaa2', instrument: 'signal', href: '/interviews', mission: '직무와 경험을 대조해 예상 면접 질문을 설계하고 있습니다.' },
  { id: 'subtitle', name: '콤마', role: '소제목 제안', station: '편집석', frame: 7, color: '#d8cf91', instrument: 'write', href: '/records', mission: '본문의 핵심 근거를 짧은 소제목으로 압축하고 있습니다.' },
] as const;

export type PilotId = typeof PILOTS[number]['id'];
export type PilotRun = { agent_id: string; status: string; error?: string | null; created_at: string };
export type PilotState = 'idle' | 'queued' | 'working' | 'completed' | 'attention' | 'offline';
export type PendingPilotJob = { id: string; status: string } | null;
export const ACTIVE_PILOT_STATUSES = ['running', 'queued'];

const statusLabels: Record<string, string> = {
  running: '임무 수행 중', retrying: '자동 재시도', queued: '출발 대기', completed: '임무 완료',
  failed: '확인 필요', blocked_auth: 'CLI 인증 필요', blocked_profile: '프로필 필요',
  waiting_for_reset: '구독 한도 대기', cancelled: '임무 중단',
};

export function getPilotState(id: PilotId, runs: PilotRun[], online: boolean, pending?: PendingPilotJob) {
  const own = runs.filter(run => run.agent_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  // 같은 파일럿의 다른 임무가 끝나도 아직 실행 중인 임무는 관제실에서 사라지면 안 된다.
  // retrying은 이전 실행을 끝내고 새 잡을 만든 기록이다. 완료된 재시도보다 우선하면 영원히 작업 중으로 보인다.
  const run = own.find(item => item.status === 'running')
    ?? own.find(item => item.status === 'queued') ?? own[0];
  const status = pending && !ACTIVE_PILOT_STATUSES.includes(run?.status ?? '') ? pending.status : run?.status;
  let state: PilotState = 'idle';
  if (!online) state = 'offline';
  else if (status === 'running') state = 'working';
  else if (status === 'queued' || status === 'retrying') state = 'queued';
  else if (status === 'completed') state = 'completed';
  else if (['failed', 'blocked_auth', 'blocked_profile', 'waiting_for_reset'].includes(status ?? '')) state = 'attention';

  let message = '좌석에서 다음 임무를 기다리고 있습니다.';
  if (state === 'offline') message = '러너가 연결되면 임무를 이어갈 수 있습니다. 로컬 컴퓨터의 러너를 확인해 주세요.';
  else if (state === 'working') message = PILOTS.find(pilot => pilot.id === id)!.mission;
  else if (state === 'queued') message = status === 'retrying' ? '이전 결과를 검증하지 못해 새 임무로 재시도를 요청했습니다.' : '요청이 대기열에 있습니다. 실행 순서가 오면 출발합니다.';
  else if (state === 'completed') message = '최근 임무를 완료했습니다. 실행 기록에서 결과를 확인해 보세요.';
  else if (state === 'attention') message = run?.error || ({
    blocked_auth: '이 파일럿이 사용하는 CLI에 로그인이 필요합니다.',
    blocked_profile: '목표 직무와 관심 분야를 채워 주세요.',
    waiting_for_reset: '구독 한도가 초기화되면 임무를 이어갈 수 있습니다.',
  }[status ?? ''] ?? '임무를 완료하지 못했습니다. 실행 기록의 오류를 확인해 주세요.');
  else if (status === 'cancelled') message = '이전 임무가 중단됐습니다. 다음 임무를 기다리고 있습니다.';
  return { state, status, label: state === 'offline' ? '연결 대기' : statusLabels[status ?? ''] ?? '임무 대기', message, createdAt: run?.created_at ?? null };
}
