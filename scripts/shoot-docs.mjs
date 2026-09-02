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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 2, mobile: false,
    });

    if (!headless) {
      console.log('\nChrome 창이 열렸습니다. 그 창에서 로그인하세요.');
      console.log('메일의 매직링크도 반드시 그 창에서 열어야 합니다.');
      console.log('로그인이 감지되면 자동으로 촬영이 시작됩니다. (최대 10분 대기)\n');

      // Enter 입력을 기다리는 대신 로그인 상태를 직접 확인한다 — 백그라운드로
      // 돌릴 때도 동작하고, 사용자가 창을 오가며 매직링크를 여는 흐름과도 맞는다.
      const deadline = Date.now() + 10 * 60 * 1000;
      let signedIn = false;
      while (Date.now() < deadline) {
        await sleep(3000);
        try {
          await send('Page.navigate', { url: `${ORIGIN}/dashboard` });
          await sleep(2500);
          const where = await send('Runtime.evaluate', {
            expression: 'location.pathname', returnByValue: true,
          });
          if (where.result.value !== '/login') { signedIn = true; break; }
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
