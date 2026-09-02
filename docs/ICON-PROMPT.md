# 아이콘 생성 프롬프트

다른 AI(ChatGPT·Gemini·Midjourney 등)에 붙여 넣어 Career Atelier 앱 아이콘을 만들기 위한 프롬프트입니다.

아래 **A**를 그대로 복사해 쓰면 되고, 결과가 마음에 안 들면 **C**의 변형을 시도하세요.

<br>

## A. 기본 프롬프트 (복사해서 사용)

```text
Design a single app icon for "Career Atelier", a personal job-application
workspace that runs AI agents on the user's own subscriptions.

CONCEPT
The product is framed as an orbital command deck: the user is a commander and
seven AI crew members do the research and drafting. The icon should read as
"a workspace in orbit", not as a generic robot or briefcase.

Pick ONE of these as the subject and commit to it fully:
  1. A stylised planet with a single elliptical orbit ring, and one small
     glowing satellite dot on the ring.
  2. A rounded square badge holding a bold letter "C" with an orbit arc
     sweeping behind it.
  3. An abstract mark: one warm sphere with a thin cool arc crossing it.

STYLE
- Flat vector, geometric, confident shapes. No gradients meshes, no 3D
  bevels, no drop shadows, no glossy highlights.
- Very few elements. It must stay legible at 32x32 pixels.
- Dark background, not white. The product is a dark interface.
- Slightly futuristic and calm. Not playful, not corporate blue, not neon
  cyberpunk.

COLOR (use these exact values)
- Background: #080d16 (near-black navy)
- Primary accent: #f5a962 (warm amber) — the planet or the letter
- Secondary accent: #58cfe4 (cool cyan) — the orbit arc or the satellite dot
- Optional light: #e6eef7 (near-white) for a single small highlight
Amber is the subject; cyan is the accent. Do not swap their weight.

COMPOSITION
- Square canvas, 1024x1024.
- Subject centred with generous padding — roughly 15% margin on all sides.
- Fills the frame confidently; no tiny mark floating in a large empty square.

MUST NOT INCLUDE
- No text, letters, or numbers anywhere, except the single "C" if you choose
  option 2.
- No human figures, faces, robots, or mascots.
- No briefcases, ties, graduation caps, resumes, documents, or checkmarks.
- No stock "AI" clichés: brains, circuit boards, neural nets, glowing hexagons.
- No photorealism, no reflections, no lens flares.

OUTPUT
A single square icon on the dark background, ready to be exported as a PNG.
```

<br>

## B. 왜 이렇게 썼는지

프롬프트를 고칠 일이 생길 때를 위해 의도를 남깁니다.

**선택지를 셋으로 좁힌 이유** — "알아서 잘 만들어 줘"라고 하면 대부분의 모델이 서류가방이나 로봇 얼굴로 돌아갑니다. 방향을 셋으로 못 박고 "하나만 골라 끝까지 밀어라"라고 해야 절충안이 안 나옵니다.

**금지 목록이 긴 이유** — 아이콘 생성에서 실제로 반복되는 실패가 정해져 있습니다. 뇌 그림, 회로 기판, 체크마크, 졸업모. 미리 막지 않으면 매번 다시 지시해야 합니다.

**색을 값으로 박은 이유** — "따뜻한 주황"이라고 하면 모델마다 다른 주황이 나옵니다. `#f5a962`와 `#58cfe4`는 앱이 실제로 쓰는 토큰이라, 아이콘만 튀지 않으려면 이 값이어야 합니다.

**32px 언급** — 아이콘은 결국 탭과 독에서 작게 쓰입니다. 이 제약을 명시하지 않으면 확대했을 때만 예쁜, 디테일 과잉인 그림이 나옵니다.

<br>

## C. 결과가 아쉬울 때 바꿔볼 것

한 번에 원하는 게 안 나오는 게 정상입니다. 한 번에 하나씩만 바꾸세요.

| 증상 | 프롬프트에 추가 |
|---|---|
| 너무 복잡함 | `Reduce to at most three shapes total.` |
| 작게 보면 뭉개짐 | `Thicker strokes, higher contrast between subject and background.` |
| 흔해 보임 | `Avoid a perfectly centred symmetrical composition; tilt the orbit ring about 20 degrees.` |
| 색이 탁함 | `Make the amber subject clearly brighter than the background; no muted tones.` |
| 배경이 흰색으로 나옴 | `The background must be solid #080d16. Do not use white or transparent.` |
| 글자가 들어감 | `Absolutely no text of any kind.` |

<br>

## D. 받은 뒤 할 일

1. **32×32로 줄여서 보세요.** 여기서 뭉개지면 나머지는 의미가 없습니다.
2. **다크·라이트 배경 양쪽에 올려 보세요.** 앱은 다크지만 파비콘은 브라우저 탭 색 위에 놓입니다.
3. 파일 위치:
   - 파비콘 → `web/public/favicon.svg` (또는 `favicon.png`)
   - README 배너에 쓰려면 → `docs/images/`

<br>

## E. 참고 — 현재 브랜드

| 항목 | 값 |
|---|---|
| 배경 | `#060910` · `#080d16` |
| 주 강조 | `#f5a962` (amber) |
| 보조 강조 | `#58cfe4` (cyan) |
| 밝은 글자 | `#e6eef7` |
| 분위기 | 우주 관제실, 어둡고 차분함, 픽셀아트 캐릭터가 함께 등장 |

배너 이미지([docs/images/banner.png](images/banner.png))와 로그인 화면이 현재 톤을 가장 잘 보여줍니다. 아이콘은 그 옆에 놓았을 때 같은 제품으로 보여야 합니다.
