// 에이전트 스프라이트 정규화 — 원본 6종은 프레임 크기(429~536px)도, 캐릭터가
// 차지하는 비율(70~96%)도, 바닥 정렬선(상단 여백 8~137px)도 제각각이라 같은
// CSS 박스에 넣으면 크기가 들쭉날쭉해 보인다. 이 스크립트는 모든 시트를
// "같은 프레임 크기 · 같은 캐릭터 높이 · 같은 바닥선"으로 다시 굽는다.
//
// 프레임 경계는 투명한 세로 거터로 찾고(균등 1/4 분할이 아니다 — 실측해보니
// 시트마다 간격이 달라 옆 프레임 조각이 딸려 온다), 세로 범위와 배율은 시트
// 전체에 하나만 적용한다 — 프레임마다 따로 맞추면 홀로그램이 있는 프레임만
// 커져서 애니메이션 중 캐릭터가 "숨쉬듯" 커졌다 작아진다.
//
// 실행: node scripts/normalize-agent-sprites.mjs
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// 원본 아트는 web/ 밖(design/agent-sources)에 둔다 — Vercel Root Directory가
// web/이라 원본 10MB가 배포 번들에 섞이지 않는다. 배포되는 건 정규화된 372KB뿐.
const sourceDir = resolve(here, '..', '..', 'design', 'agent-sources');
const assetsDir = resolve(here, '..', 'public', 'assets');

const FRAMES = 4;
const FRAME_W = 240;
const FRAME_H = 300;
const CHAR_H = 258; // 프레임 높이의 86% — 말풍선/이름표와 겹치지 않을 여백을 남긴다
const FLOOR_GAP = 16; // 바닥에서 띄우는 간격. 모든 캐릭터가 같은 선 위에 선다.
const ALPHA_THRESHOLD = 24;

const SHEETS = [
  { id: 'news', src: 'orbit-agent-news-v2.png' },
  { id: 'jobs', src: 'orbit-agent-jobs-v2.png' },
  { id: 'company', src: 'orbit-agent-company-v2.png' },
  { id: 'review', src: 'orbit-agent-review-v2.png' },
  { id: 'writer', src: 'orbit-agent-writer-v2.png' },
  { id: 'interview', src: 'orbit-agent-interview-v1.png' },
];

// 프레임 경계를 "폭의 1/4"로 가정하면 안 된다 — 실측해보니 시트마다 캐릭터가
// 균등 간격으로 놓여 있지 않아, 균등 분할하면 옆 프레임의 홀로그램 조각이
// 딸려 들어온다. 대신 세로로 완전히 비어 있는 열(거터)을 찾아 실제 덩어리
// 경계를 잡는다.
function findFrameColumns(data, width, height) {
  const columnHasInk = new Array(width).fill(false);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      if (data[(y * width + x) * 4 + 3] >= ALPHA_THRESHOLD) {
        columnHasInk[x] = true;
        break;
      }
    }
  }

  const clusters = [];
  let start = -1;
  for (let x = 0; x < width; x += 1) {
    if (columnHasInk[x] && start < 0) start = x;
    if ((!columnHasInk[x] || x === width - 1) && start >= 0) {
      const end = columnHasInk[x] ? x : x - 1;
      clusters.push({ start, end });
      start = -1;
    }
  }

  // 홀로그램이 본체와 떨어져 있으면 덩어리가 4개보다 많아진다. 가장 가까운
  // 덩어리끼리 반복해 합쳐 정확히 4개로 만든다.
  while (clusters.length > FRAMES) {
    let bestIndex = 0;
    let bestGap = Infinity;
    for (let i = 0; i < clusters.length - 1; i += 1) {
      const gap = clusters[i + 1].start - clusters[i].end;
      if (gap < bestGap) {
        bestGap = gap;
        bestIndex = i;
      }
    }
    clusters[bestIndex] = { start: clusters[bestIndex].start, end: clusters[bestIndex + 1].end };
    clusters.splice(bestIndex + 1, 1);
  }
  if (clusters.length !== FRAMES) throw new Error(`프레임을 ${FRAMES}개로 나누지 못했습니다 (${clusters.length}개).`);
  return clusters;
}

// 세로 범위는 시트 전체 공통으로 잡는다 — 프레임마다 따로 자르면 홀로그램이
// 있는 프레임만 키가 달라져 애니메이션 중 캐릭터가 "숨쉬듯" 커졌다 작아진다.
function verticalBounds(data, width, height) {
  let minY = Infinity;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < ALPHA_THRESHOLD) continue;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      break;
    }
  }
  if (maxY < 0) throw new Error('불투명 픽셀을 찾지 못했습니다.');
  return { minY, maxY };
}

async function normalizeSheet({ id, src }) {
  const inputPath = resolve(sourceDir, src);
  const input = sharp(await readFile(inputPath)).ensureAlpha();
  const { width, height } = await input.metadata();
  if (!width || !height) throw new Error(`${src}: 크기를 읽지 못했습니다.`);

  const { data } = await input.raw().toBuffer({ resolveWithObject: true });
  const columns = findFrameColumns(data, width, height);
  const { minY, maxY } = verticalBounds(data, width, height);
  const cropH = maxY - minY + 1;

  // 시트 전체에 같은 배율을 적용한다(프레임별로 다시 맞추지 않는다) — 그래야
  // 프레임이 넘어가도 캐릭터 크기가 변하지 않는다. 배율은 가장 넓은 프레임이
  // 프레임 폭 안에 들어가도록 잡는다.
  const widestCrop = Math.max(...columns.map((c) => c.end - c.start + 1));
  const heightScale = CHAR_H / cropH;
  const widthScale = (FRAME_W - 12) / widestCrop;
  const scale = Math.min(heightScale, widthScale);

  const composites = [];
  for (let frame = 0; frame < FRAMES; frame += 1) {
    const { start, end } = columns[frame];
    const cropW = end - start + 1;
    const finalW = Math.max(1, Math.round(cropW * scale));
    const finalH = Math.max(1, Math.round(cropH * scale));
    const frameBuffer = await sharp(await readFile(inputPath))
      .ensureAlpha()
      .extract({ left: start, top: minY, width: cropW, height: cropH })
      .resize(finalW, finalH, { kernel: 'lanczos3', fit: 'fill' })
      .png()
      .toBuffer();
    composites.push({
      input: frameBuffer,
      left: frame * FRAME_W + Math.round((FRAME_W - finalW) / 2),
      top: FRAME_H - FLOOR_GAP - finalH,
    });
  }
  const finalH = Math.round(cropH * scale);

  const outputPath = resolve(assetsDir, `agent-${id}.png`);
  const out = await sharp({
    create: { width: FRAME_W * FRAMES, height: FRAME_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 })
    .toBuffer();
  await writeFile(outputPath, out);

  const beforeBytes = (await readFile(inputPath)).length;
  console.log(
    `${id.padEnd(10)} ${String(width).padStart(4)}x${height} → ${FRAME_W * FRAMES}x${FRAME_H}` +
      ` | 캐릭터 높이 ${finalH}px | ${(beforeBytes / 1024).toFixed(0)}KB → ${(out.length / 1024).toFixed(0)}KB`,
  );
}

for (const sheet of SHEETS) {
  await normalizeSheet(sheet);
}
console.log(`\n프레임 규격: ${FRAME_W}x${FRAME_H} × ${FRAMES}프레임 · 캐릭터 높이 ${CHAR_H}px · 바닥선 하단 ${FLOOR_GAP}px`);
