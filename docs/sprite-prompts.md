# 스프라이트 생성 프롬프트

> `sprite-gen`에 넣을 **base 이미지 한 장**을 만들기 위한 프롬프트 모음이다.
> 색은 `src/game/types/combat.ts`의 `SILHOUETTE`, 역할은 `src/game/data/enemies.ts`를 따른다.
> 여기 값을 바꾸면 코드의 팔레트도 함께 바꿔야 한다.

## 방향

레퍼런스는 **산나비 · 스컬 · 할로우나이트**다. 셋의 공통점은 하나다.

- 디테일이 아니라 **실루엣으로 읽힌다.** 얼굴 묘사를 줄이고 형태와 대비로 캐릭터를 세운다.
- 어두운 몸에 **포인트 색 하나.** 화면이 어두워도 캐릭터가 어디 있는지 즉시 보인다.
- 비율은 **6~7등신.** 머리가 큰 SD·치비 비율이 아니다.

이 게임은 붉은 달 아래 폐허, 「기록자」가 지켜보는 시험장이다. 색은 재와 피 두 가지로 좁힌다.

---

## 공통 스타일 블록

모든 캐릭터 프롬프트 앞에 그대로 붙인다.

```text
2D game sprite, side-view idle pose, pixel art, 6-to-7-head-tall realistic proportions,
dark fantasy, gothic ruin atmosphere, strong readable silhouette, minimal facial detail,
near-black body with a single glowing accent color, dramatic rim light from behind,
limited palette of ash grey and blood red, clean 1px outline, no anti-aliased blur,
full body visible, centered, flat solid magenta background (#FF00FF) for chroma keying
```

### 금지어 (negative prompt)

```text
chibi, super deformed, big head, anime style, kawaii, cute, moe, cel shaded,
3D render, photorealistic, gradient background, drop shadow, watermark, text,
multiple characters, cropped limbs, blurry, soft focus
```

### 기술 조건

| 항목 | 값 | 이유 |
|---|---|---|
| 배경 | 단색 마젠타 `#FF00FF` | `sprite-gen`의 `--chroma-key`가 이 색을 걷어낸다 |
| 자세 | 측면 대기(idle) | `breathe`가 정지 프레임 하나로 호흡을 만든다 |
| 크기 | 긴 변 512px 이상 | 축소는 되지만 확대는 뭉갠다 |
| 여백 | 사방에 캐릭터 키의 10% | 잘리면 `--safe-margin`으로도 못 살린다 |

---

## 캐릭터별 프롬프트

공통 블록 뒤에 아래 문장을 붙인다.

### 플레이어 — 시험받는 자

색: `#f2e9e4` (창백한 흰색). 화면에서 가장 밝아야 한다. 어디 있는지 즉시 보여야 하기 때문이다.

```text
a lone wanderer in a tattered hooded cloak, pale bone-white figure against darkness,
face hidden in shadow under the hood, one straight blade held low in a reverse grip,
worn leather straps and a torn scarf drifting, weary but upright stance
```

근거리·원거리 모드가 하나의 무기에서 갈리므로(MVP_PLAN §2-1), 검은 **한 자루만** 그린다.
총이나 활을 따로 들리지 않는다.

### 추격형 적 — 달려드는 것

색: `#c8383c` (붉은색). 원거리 플레이어를 압박한다.

```text
a gaunt hunched creature built for lunging, long thin limbs, low forward-leaning posture,
cracked crimson glow bleeding from the ribcage, no eyes, jaw split too wide,
tattered sinew trailing behind, coiled like it is about to spring
```

### 견제형 적 — 거리를 두는 것

색: `#9a5f86` (탁한 자주). 근거리 플레이어를 견제한다.

```text
a tall narrow figure floating just above the ground, long ragged robe hiding the legs,
faint violet ember cupped in skeletal hands, hollow mask with a single vertical slit,
still and patient, body turned slightly away as if keeping distance
```

### 기동 카운터형 적 — 길목을 막는 것

색: `#5f8fa6` (차가운 청록). 대시 습관을 카운터한다.

```text
a squat wide-bodied sentinel, heavy plated shell, four short legs braced on the ground,
cold teal runes glowing along the back plates, no head, a single wide eye-slit on the chest,
planted and immovable, faint circular sigil forming beneath it
```

### 보스 — 기록자의 집행자

색: `#ff3b6b` (선명한 붉은색). 패턴 4개(베기·돌진·투사체·내려찍기)를 쓴다.

```text
a towering armored judge wreathed in torn crimson banners, faceless helm with a
horizontal slit of red light, one massive greatsword resting point-down on the ground,
chains hanging from broken pauldrons, motionless and monumental,
silhouette wide at the shoulders and narrow at the waist
```

---

## sprite-gen에 넣기

base 이미지가 준비되면 다음 순서로 돌린다.

```bash
cd ~/Desktop/Dev/sprite-gen

# 1) 레시피와 상태별 프롬프트 생성
.venv/bin/python scripts/prepare_sprite_run.py \
  --out-dir runs/player --character-id player \
  --base-image /경로/base.png --cell-size 48 --chroma-key "#FF00FF"

# 2) 상태별 이미지 생성 (Codex를 이미지 제공자로 사용)
.venv/bin/python scripts/generate_sprite_image.py --provider codex \
  --prompt-file runs/player/prompts/idle.txt \
  --out runs/player/raw/idle.png \
  --ref runs/player/base-source.png

# 3) 프레임 추출 → 4) 선별(선택) → 5) 아틀라스 합성
.venv/bin/python scripts/extract_sprite_row_frames.py --run-dir runs/player
.venv/bin/python scripts/serve_curation.py --run-dir runs/player
.venv/bin/python scripts/compose_sprite_atlas.py --run-dir runs/player
```

`--cell-size`는 현재 도형 크기를 기준으로 잡았다.
플레이어 몸이 26×44, 적이 30~46 × 38~54라서 48이 여유 있게 들어간다.

## 게임에 붙이기

아틀라스(`sprite-sheet-alpha.png` + `manifest.json`)가 나오면 교체 지점은 두 곳뿐이다.

1. `src/game/scenes/BootScene.ts` — `createPlaceholderTextures()`를 실제 아틀라스 로드로 바꾼다.
2. `src/game/types/combat.ts` — `TEXTURE` 키를 아틀라스 프레임 이름으로 바꾼다.

엔티티 코드는 텍스처 키만 참조하므로 손대지 않는다. 색상 상수(`SILHOUETTE`)는 예고 표시와
잔상 tint에 계속 쓰이므로 남겨 둔다.
