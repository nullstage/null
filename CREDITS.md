# Credits

Project NULL에 사용한 외부 에셋과 오픈소스의 출처다.
라이선스 조건이 붙은 항목은 조건도 함께 적는다. 항목을 추가하면 이 문서도 갱신한다.

---

## 음악

배경음악 4곡은 **Suno**로 생성했다.

| 파일 | 용도 |
|---|---|
| `public/assets/audio/the-weight-of-silence.mp3` | 타이틀 |
| `public/assets/audio/bgm-village.mp3` | 방 1 (무전투 마을) |
| `public/assets/audio/bgm-combat.mp3` | 전투 방 |
| `public/assets/audio/bgm-boss.mp3` | 보스전 |

> Music generated with Suno (https://suno.com).

Suno 무료 플랜 약관은 출력물을 **비영리 목적으로만** 사용하도록 하고,
사용할 때마다 Suno 표기를 요구한다.

> "you will only use Outputs generated from Submissions made by you through the Service
> solely for your lawful, internal, personal and non-commercial purposes, provided that
> you give attribution credit to Suno in each case."

이 조건 때문에 게임 내 설정 화면 사운드 탭에도 같은 고지를 둔다
(`src/components/ui/SettingsPanel.tsx`의 `Credit`). 그 문구를 지우면 라이선스 조건이 깨진다.
상업적 이용으로 전환할 경우 유료 플랜 전환 또는 음원 교체가 필요하다.

---

## 효과음

효과음 19개는 **Pixabay**에서 받았다. 라이선스 조건이 붙지 않는 음원만 선별했다.

- 출처: https://pixabay.com
- 라이선스: Pixabay Content License
- 저작자 표기: 불필요 ("Use Content without having to attribute the author")
- 제약: 음원 자체를 단독 상품으로 재판매하는 것은 금지

| 분류 | 파일 |
|---|---|
| 검·총 | `sword-hit-1~3.mp3`, `gun-shot.mp3`, `shell-drop.mp3` |
| 피격·방어 | `hit-enemy.mp3`, `player-hurt.mp3`, `parry.mp3`, `parry-cast.mp3` |
| 이동 | `dash.mp3`, `footstep-run.mp3`, `portal.mp3` |
| 스킬 | `skill-spike.mp3`, `skill-sword-wave.mp3` |
| 보스 | `boss-awaken.mp3`, `boss-chain.mp3`, `boss-slam.mp3` |
| UI | `ui-select.mp3`, `ui-move.mp3` |

보스 패턴 효과음 일부는 새 음원을 받는 대신 기존 트랙의 피치·재생속도를 변조해 재사용한다.

---

## 스프라이트 (외부 팩)

적 스프라이트 2종은 **zneeke**의 itch.io 팩에서 가져왔다.

| 파일 | 팩 | 출처 |
|---|---|---|
| `public/assets/sprites/enemies/chaser.png` | Goblin Scout Dark Silhouette | https://zneeke.itch.io/goblin-scout-silhouette |
| `public/assets/sprites/enemies/ranged.png` | Dark Fantasy Monster Pack 3 | https://zneeke.itch.io/dark-fantasy-monster-pack-3 |

양 팩 공통 조건이다.

- 허용: 상업적 프로젝트에서의 사용 및 수정
  ("Use for commercial projects and modify assets as needed")
- 금지: 에셋 자체의 재판매·재포장·재배포(수정본 포함), 게임 제작 도구·코드 템플릿 포함,
  **AI 학습 사용**, 크립토·NFT·P2E·메타버스 프로젝트에서의 사용

저작자 표기 의무는 명시되어 있지 않으나 여기에 출처를 남긴다.
두 팩의 스프라이트는 원본을 그대로 쓰거나 크기·히트박스만 조정했고,
AI 생성 파이프라인의 입력으로 사용하지 않았다.

---

## 서체

`next/font/local`로 번들한다(`src/styles/fonts.ts`).

### Neo둥근모 — `src/assets/fonts/NeoDunggeunmo.ttf`

보스 이름·지역명·아이템명 등 라벨에 쓴다.
`@kfonts/neodgm`에서 ttf만 내려받아 로컬에 두었다.

폰트 파일의 `name` 테이블에 기재된 내용이다.

> Original font was released under the public domain by Jungtae Kim in 1990s.
> Conversion and additional character design by Dalgona. <me@dalgona.dev>

> This font software may be used, studied, modified, embedded and redistributed
> under the SIL Open Font License 1.1.

- 라이선스: SIL Open Font License 1.1 (https://scripts.sil.org/OFL)
- 원 저작: 김정태(1990년대, 퍼블릭 도메인) / 변환·추가 설계: Dalgona
- 조건: 서체 파일을 재배포할 때 저작권 고지와 라이선스 사본을 함께 포함한다.
  서체 자체를 단독 판매할 수 없다.
- 웹 빌드가 ttf를 그대로 서빙하므로 이 항목은 재배포에 해당하며,
  OFL은 임베딩과 재배포를 명시적으로 허용한다.

### Pretendard — CDN

대화 본문(`DialogueBox`)과 시스템 UI(`theme.font.mono`), 시작 화면 메뉴,
Phaser 씬 텍스트에 쓴다.

`app/globals.css`가 jsDelivr에서 한글 동적 서브셋을 받는다.

```text
https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/
  pretendardvariable-dynamic-subset.css
```

- 제작자: orioncactus (길형진)
- 라이선스: SIL Open Font License 1.1
- **서체 파일을 저장소에 두지 않는다.** CDN이 직접 서빙하므로
  이 프로젝트가 서체를 재배포하지는 않는다.
- 외부 CDN 의존이므로 오프라인이나 CDN 장애 시에는
  `-apple-system` → `Malgun Gothic` → `sans-serif` 순으로 대체된다.

### 제거한 서체 — 조선굵은고딕 (ChosunKg)

대화 본문과 시스템 UI에 쓰던 서체였으나 **제거했다.**
폰트 파일의 `name` 테이블에서 확인한 정보는 다음과 같았다.

| 항목 | 값 |
|---|---|
| 패밀리 | 조선굵은고딕 |
| 저작권 | `Copyright(c) 2020 조선일보사` |
| PostScript 이름 | `ChosunKg` |
| 라이선스 필드 | 비어 있음 (OFL 등 명시 없음) |

조선일보가 배포하는 무료 서체로 개인·기업 사용과 인쇄물·웹페이지·영상 사용이
허용되지만, 다음 조건이 붙는다.

- 수정 후 판매 금지. "배포된 형태 그대로" 사용해야 한다.
- 복사·배포에 대가를 요구할 수 없다.
- **공식 배포처 이외에서의 배포를 금지한다.**

이 프로젝트는 `next/font/local`로 ttf를 번들해 GitHub Pages에서 직접 서빙했으므로
마지막 조항에 걸리는지가 불분명했다. 공식 배포 페이지 원문을 확인하지 못한 상태에서
그대로 두는 것보다 걷어내는 편이 안전하다고 판단해,
`src/assets/fonts/ChosunKg.ttf`를 삭제하고 해당 자리를 Pretendard로 통일했다.
빌드 산출물에도 이 서체 파일이 더 이상 포함되지 않는다.

---

## AI로 생성한 에셋

외부에서 받은 것이 아니라 직접 생성한 항목이다.

| 분류 | 수 | 도구 |
|---|---|---|
| 스프라이트·배경·타일·장식·UI·이펙트 이미지 | 234 | ChatGPT 이미지 생성 |
| 배경음악 | 4 | Suno (위 "음악" 참조) |

이미지 생성 프롬프트는 `docs/sprite-prompts.md`에 있다.
`sprite-gen` 파이프라인이 codex CLI 경유로 호출한 기록이 `docs/ai-log/`에 남아 있는데,
생성 주체는 같은 ChatGPT 이미지 모델이다.

---

## 오픈소스

`package.json` 기준이며 라이선스는 설치본(`node_modules/*/package.json`)에서 확인했다.

### 런타임

| 패키지 | 버전 | 라이선스 |
|---|---|---|
| next | 16.3.0 | MIT |
| react | 19.2.8 | MIT |
| react-dom | 19.2.8 | MIT |
| phaser | 3.90.0 | MIT |
| gsap | 3.15.0 | Standard "no charge" license |
| @emotion/react | 11.14.0 | MIT |
| @emotion/styled | 11.14.1 | MIT |
| @emotion/cache | 11.14.0 | MIT |

GSAP은 MIT가 아니다. 패키지 메타데이터의 문구는
`Standard 'no charge' license: https://gsap.com/standard-license.` 이며
조건은 해당 페이지를 정본으로 따른다.

### 개발

| 패키지 | 버전 | 라이선스 |
|---|---|---|
| typescript | 6.0.3 | Apache-2.0 |
| eslint | 9.39.5 | MIT |
| eslint-config-next | ^16.3.0 | MIT |
| @types/node | ^26.1.2 | MIT |
| @types/react | ^19.2.18 | MIT |
| @types/react-dom | ^19.2.4 | MIT |

MIT와 Apache-2.0은 배포물에 라이선스 고지를 유지할 것을 요구한다.
화면 표기 의무는 없으므로 이 문서가 그 역할을 한다.
