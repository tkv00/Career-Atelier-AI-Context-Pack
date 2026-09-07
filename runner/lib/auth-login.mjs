// 비밀번호는 공백까지 자격증명이다. 입력 오류만 구분하고 값을 보정하지 않는다.
export async function authenticateRunner(client, email, password, save) {
  if (!email.trim() || !email.includes('@')) throw new Error('웹에서 가입한 이메일을 입력하세요.');
  if (!password) throw new Error('Career Atelier에서 직접 정한 비밀번호를 입력하세요.');
  if (/^https?:\/\//i.test(password.trim())) throw new Error('비밀번호 칸에 웹 주소가 입력됐습니다. 주소는 브라우저에서 열고, 여기에는 웹 가입 시 정한 비밀번호를 입력하세요.');
  let response;
  try {
    response = await client.auth.signInWithPassword({ email: email.trim(), password });
  } catch {
    throw new Error('인증 서버에 연결하지 못했습니다. 인터넷 연결과 runner/.env의 SUPABASE_URL을 확인하세요.');
  }
  const { data, error } = response;
  if (error) {
    if (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message ?? '')) throw new Error('이메일 확인이 필요합니다. 가입 확인 메일을 먼저 열어 주세요.');
    if (error.code === 'over_request_rate_limit' || error.status === 429) throw new Error('로그인 요청이 너무 많습니다. 잠시 후 다시 시도하세요.');
    if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message ?? '')) {
      throw new Error('이메일 또는 비밀번호를 확인하세요. 웹에서 먼저 계정을 만들어야 하며 Supabase DB 비밀번호는 사용할 수 없습니다. 웹에서도 실패하면 로그인 화면에서 비밀번호를 재설정하세요. 웹만 성공한다면 웹과 러너의 연결 프로젝트가 같은지 확인하세요.');
    }
    throw new Error(`인증에 실패했습니다 (${error.code || error.status || '연결 오류'}). 웹 로그인과 Supabase Auth 설정을 확인하세요.`);
  }
  if (!data?.session || !data.user) throw new Error('로그인 세션을 받지 못했습니다. 웹에서 가입·이메일 확인을 완료하세요.');
  // 파일 저장이 끝나기 전에 성공을 출력하면 재시작 시 다시 로그인을 요구할 수 있다.
  await save(data.session);
  return data.user;
}
