#!/usr/bin/env node
// 문서용 스크린샷 촬영기 (docs/images/screens/).
//
// UI를 고칠 때마다 README 이미지를 손으로 다시 찍는 건 금방 밀린다. 이 스크립트는
// Chrome을 띄워 정해진 화면들을 같은 크기·같은 배율로 찍어 준다.
//
// 로그인이 필요한 화면이라 처음 한 번은 창이 열린다. 거기서 로그인하면 프로필이
// 남아, 다음부터는 `--headless`로 조용히 찍힌다.
//
//   node scripts/shoot-docs.mjs            # 창을 띄워 로그인 후 촬영
//   node scripts/shoot-docs.mjs --headless # 저장된 프로필로 조용히 촬영
//
// 화면에 보이는 이메일은 캡처 직전에 you@example.com으로 바꿔 저장한다.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = resolve(root, 'docs/images/screens');
const PROFILE = resolve(homedir(), '.career-atelier/docs-shot-profile');
const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://localhost:3000';
const PORT = 9333;
const headless = process.argv.includes('--headless');

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) {
  console.error('Chrome을 찾지 못했습니다. CHROME_PATH 환경변수로 경로를 지정하세요.');
  process.exit(1);
}

// 촬영 목록 --------------------------------------------------------------
const maskEmails = `
  const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}/g;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (re.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, 'you@example.com');
    re.lastIndex = 0;
  }
`;
const step = (body) => `(async () => { ${maskEmails}; ${body ?? "return 'ok';"} })()`;

const SHOTS = [
  { path: '/login', file: '00-login.png', script: step() },
  { path: '/dashboard', file: '01-dashboard.png', script: step() },
  {
    path: '/calendar',
    file: '02-calendar.png',
    // 마감일이 있는 날에 포커스를 줘 미리보기 팝오버를 연 채로 찍는다.
    script: step(`
      const day = [...document.querySelectorAll('.calendar-day')].find(d => d.querySelector('.calendar-day-preview'));
      if (day) { day.focus(); await new Promise(r => setTimeout(r, 500)); }
      return day ? 'preview-open' : 'no-events';
    `),
  },
  {
    path: '/calendar',
    file: '03-stage-board.png',
    script: step(`
      const b = document.querySelector('.application-status-board');
      if (b) { b.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 600)); }
      return b ? 'ok' : 'no-board';
    `),
  },
  { path: '/prompts', file: '04-prompt-lab.png', script: step() },
  { path: '/experiences', file: '05-experiences.png', script: step() },
  { path: '/interviews', file: '06-interviews.png', script: step() },
];

// CDP 최소 클라이언트 ------------------------------------------------------
async function connect() {
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {}
  }
  throw new Error('Chrome 디버깅 포트에 연결하지 못했습니다.');
}

function rpc(ws) {
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: rs, reject: rj } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rj(new Error(JSON.stringify(msg.error))) : rs(msg.result);
    }
  };
  return (method, params = {}) =>
    new Promise((rs, rj) => {
      const msgId = ++id;
      pending.set(msgId, { resolve: rs, reject: rj });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(PROFILE, { recursive: true });

  // 앞선 실행의 Chrome이 살아 있으면 새로 띄운 창이 아니라 그 낡은 창에 붙는다.
  // 사용자는 새 창에서 로그인하는데 스크립트는 옛 창을 보게 되어, 원인을 알기
  // 어려운 "로그인해도 감지 안 됨"이 된다. 먼저 확인하고 멈춘다.
  try {
    const stale = await fetch(`http://127.0.0.1:${PORT}/json/version`, {
      signal: AbortSignal.timeout(1500),
    }).then((r) => r.json());
    console.error(`포트 ${PORT}을 이미 다른 Chrome이 쓰고 있습니다 (${stale.Browser ?? 'unknown'}).`);
    console.error('이전 촬영 창을 닫은 뒤 다시 실행하세요.');
    process.exit(1);
  } catch {
    // 연결 실패 = 포트가 비어 있음. 정상 경로다.
  }

  const args = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    '--window-size=1440,900',
    '--no-first-run',
    '--no-default-browser-check',
  ];
  if (headless) args.unshift('--headless=new');

  const chrome = spawn(CHROME, [...args, headless ? 'about:blank' : `${ORIGIN}/login`], { stdio: 'ignore' });

  try {
    const page = await connect();
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((rs, rj) => {
      ws.onopen = rs;
      ws.onerror = () => rj(new Error('CDP 웹소켓 연결 실패'));
    });
    const send = rpc(ws);

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable'); // 아래 로그인 대기에서 Network.getCookies를 쓴다
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 2, mobile: false,
    });

    if (!headless) {
      console.log('\n촬영용 Chrome 창이 열렸습니다.\n');
      console.log('  1) 그 창에서 이메일을 입력해 매직링크를 요청하세요.');
      console.log('  2) 메일에 온 링크를 클릭하지 말고 "링크 주소 복사"를 한 뒤,');
      console.log('     그 창의 주소창에 붙여넣어 여세요.\n');
      console.log('  다른 브라우저에서 링크를 열면 세션이 그쪽에 생겨,');
      console.log('  이 창은 계속 로그아웃 상태로 남습니다.\n');
      console.log('로그인이 감지되면 자동으로 촬영이 시작됩니다. (최대 20분 대기)\n');

      // Enter 입력을 기다리는 대신 로그인 상태를 직접 확인한다. 단, 여기서
      // 페이지를 이동시키면 안 된다 — 사용자가 로그인 폼을 채우는 중에 화면을
      // 날려버려 로그인 자체가 불가능해진다. 쿠키만 조용히 들여다본다.
      const deadline = Date.now() + 20 * 60 * 1000;
      let signedIn = false;
      let hintShown = false;
      while (Date.now() < deadline) {
        await sleep(3000);
        try {
          const { cookies } = await send('Network.getCookies', { urls: [ORIGIN] });
          if (cookies.some((c) => /-auth-token$/.test(c.name) && c.value)) {
            signedIn = true;
            break;
          }
          // 매직링크를 요청하면 code-verifier만 먼저 생긴다. 그 상태로 오래
          // 머물면 링크를 다른 브라우저에서 연 것이므로 한 번 짚어 준다.
          if (!hintShown && cookies.some((c) => c.name.includes('code-verifier'))) {
            hintShown = true;
            console.log('\n  링크 요청은 확인됐습니다. 이제 메일의 링크를 이 창의 주소창에 붙여넣어 주세요.');
          }
        } catch {}
        process.stdout.write('.');
      }
      console.log('');
      if (!signedIn) {
        throw new Error('10분 안에 로그인이 확인되지 않았습니다.');
      }
      console.log('로그인 확인됨. 촬영을 시작합니다.\n');
    }

    for (const shot of SHOTS) {
      await send('Page.navigate', { url: ORIGIN + shot.path });
      await sleep(4000);

      const evaluated = await send('Runtime.evaluate', {
        expression: shot.script, awaitPromise: true, returnByValue: true,
      });
      await sleep(600);

      // 로그인 화면으로 튕겼다면 세션이 없는 것 — 조용히 잘못된 그림을 남기지 않는다.
      const url = await send('Runtime.evaluate', { expression: 'location.pathname', returnByValue: true });
      if (shot.path !== '/login' && url.result.value === '/login') {
        console.error(`✗ ${shot.file} — 로그인이 안 되어 있습니다. --headless 없이 다시 실행해 로그인하세요.`);
        continue;
      }

      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(resolve(OUT, shot.file), Buffer.from(data, 'base64'));
      console.log(`✓ ${shot.file} ${evaluated.result?.value ? `(${evaluated.result.value})` : ''}`);
    }

    ws.close();
    console.log(`\n저장 위치: ${OUT}`);
  } finally {
    chrome.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
