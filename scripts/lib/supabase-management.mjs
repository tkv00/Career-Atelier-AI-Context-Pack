import { spawnSync } from 'node:child_process';

function validateProjectRef(projectRef) {
  if (!/^[a-z]{20}$/.test(projectRef)) throw new Error('Supabase 프로젝트 ref 형식이 올바르지 않습니다.');
}

function safeCliOutput(value) {
  return String(value ?? '').replace(/sbp_[A-Za-z0-9_]+/g, '[REDACTED]').slice(0, 1500);
}

export function supportsSupabaseDbQuery({ run = spawnSync, platform = process.platform } = {}) {
  const result = run('supabase', ['db', 'query', '--help'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15_000,
    windowsHide: true, shell: platform === 'win32',
  });
  return !result.error && result.status === 0;
}

export function createCliManagementQuery({ projectRef, run = spawnSync, platform = process.platform, timeoutMs = 65_000 }) {
  validateProjectRef(projectRef);
  return async (query) => {
    // SQL을 argv에 넣으면 Windows 명령 길이 제한과 프로세스 목록 노출에 걸린다.
    // CLI의 stdin 경로는 같은 로그인 세션으로 Management API를 호출한다.
    const result = run('supabase', [
      'db', 'query', '--linked', '--project-ref', projectRef,
      '--output', 'json', '--agent', 'no',
    ], {
      encoding: 'utf8', input: query, stdio: ['pipe', 'pipe', 'pipe'], timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, windowsHide: true, shell: platform === 'win32',
    });
    if (result.error || result.status !== 0) {
      const detail = safeCliOutput(result.stderr || result.stdout || result.error?.message);
      throw new Error(`Supabase CLI SQL 실행이 실패하거나 시간 초과됐습니다. 같은 설치 명령을 다시 실행하면 적용 이력부터 확인합니다.${detail ? `\n${detail}` : ''}`);
    }
    try { return JSON.parse(result.stdout); }
    catch { throw new Error('Supabase CLI의 DB 응답이 JSON이 아닙니다. CLI 버전과 출력 형식을 확인하세요.'); }
  };
}

export function createManagementQuery({ projectRef, token, fetchImpl = fetch, timeoutMs = 65_000 }) {
  validateProjectRef(projectRef);
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  return async (query, { readOnly = false } = {}) => {
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, read_only: readOnly }),
      });
      const body = await response.text();
      if (!response.ok) {
        const hint = response.status === 401 ? 'supabase login으로 다시 로그인하세요.'
          : response.status === 403 ? '프로젝트 접근 권한과 database:write 권한을 확인하세요.'
          : response.status === 429 ? '요청 한도에 도달했습니다. 잠시 후 같은 명령을 다시 실행하세요.'
          : 'SQL 오류 또는 서버 상태를 확인한 뒤 같은 명령을 다시 실행하세요.';
        // API가 SQL/헤더를 되돌려 보내더라도 비밀은 오류 메시지에 남기지 않는다.
        const safe = body.replaceAll(token, '[REDACTED]').replace(/sbp_[A-Za-z0-9_]+/g, '[REDACTED]');
        throw new Error(`Management API HTTP ${response.status}: ${hint}\n${safe.slice(0, 1500)}`);
      }
      try { return JSON.parse(body); }
      catch { throw new Error('Management API 응답이 JSON이 아닙니다. 프록시 또는 API 응답을 확인하세요.'); }
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError' || error instanceof TypeError) {
        // 응답 유실 시 서버의 커밋 여부는 알 수 없다. SQL을 즉시 재전송하지 않고 다음 실행에서 이력을 조회한다.
        throw new Error('Management API HTTPS 요청이 실패하거나 시간 초과됐습니다. api.supabase.com:443 접근을 확인하고 같은 설치 명령을 다시 실행하세요. 서버 적용 여부는 재실행 시 이력으로 확인합니다.');
      }
      throw error;
    }
  };
}
