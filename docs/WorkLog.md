# Work Log

> 실제 수행한 작업, 발생한 오류, 원인, 수정, 검증 결과를 기능 단위로 기록한다. 계획은 `Plan.md`, 정책 결정은 `DecisionLog.md`에서 관리한다.

## 기록 원칙

- 기능, 버그, 배포 단위로 기록한다.
- 파일을 열거나 사소한 문구를 바꾼 사실까지 모두 기록하지 않는다.
- 오류는 증상뿐 아니라 확정한 원인과 재검증 결과를 남긴다.
- 완료 주장에는 실행 명령 또는 직접 플레이 시나리오가 포함되어야 한다.

## 2026-08-06

### 초기 문서 구조 구성

- 상태: DONE
- 관련 계획: P-001

#### 작업

- `CLAUDE.md` 작업 규칙 정리
- `MVP_PLAN.md` 구현 범위 정리
- 운영 문서 `Plan`, `OpenQuestions`, `DecisionLog`, `WorkLog` 생성
- AI 사용 로그 디렉터리 생성

#### 검증

- 문서 간 역할 중복 여부 확인
- 미결정 → 결정 → 계획 → 구현 → 기록 흐름 확인

#### 남은 작업

- OQ-001~005 결정
- 프로젝트 초기화
- 최초 GitHub Pages 배포

---

### 프로젝트 뼈대와 시스템 레이어 구현

- 상태: DONE
- 관련 계획: P-001, P-005, P-006, P-007, P-008
- 관련 결정: DEC-005, DEC-006, DEC-007

#### 작업

- Next.js(App Router) + Phaser 3 + GSAP + Emotion + TypeScript 초기화, 정적 내보내기 설정
- 공통 계약 `src/game/types/game.ts`, 이벤트 버스 `src/game/EventBus.ts` 확정
- 시스템 구현: `RunState`, `CombatTelemetry`, `DirectorPolicy`, `RoomController`, `UpgradeSystem`
- 데이터 분리: `data/directorRules.ts`, `data/rooms.ts`, `data/enemies.ts`, `data/upgrades.ts`, `config/gameBalance.ts`
- React UI: 분석·강화·역기만·결과·F1 디버그 패널, HUD 오버레이
- 전투 담당 영역(`entities/**`)은 시그니처와 텔레메트리 호출 지점만 있는 스텁으로 남김
- GitHub Actions 배포 워크플로 작성
- 미결정 항목 OQ-006~025를 `OpenQuestions.md`에 등록하고, 값이 필요한 곳은 `OQ-XXX 미결정` 주석과 함께 임시값 사용

#### 오류 및 원인

1. **React #418 하이드레이션 오류**
   - 재현: 정적 빌드 결과물을 브라우저로 열면 콘솔에 minified React error #418
   - 원인: App Router에서 Emotion은 서버 렌더 시 스타일을 삽입하지 않는다. 프리렌더 HTML에는 스타일이 없고 클라이언트에서만 주입돼 마크업이 어긋났다.
   - 수정: `useServerInsertedHTML` 기반 `EmotionRegistry`를 추가해 프리렌더 HTML에 스타일을 함께 심었다.

2. **보스전 HUD에 `ROOM 0` 표시, 재시작 후 이전 런 HUD 잔존**
   - 재현: 보스전 진입 시 방 번호 0, 결과 화면에서 재시작해도 좌상단 HUD가 남음
   - 원인: `BossScene`이 HUD를 갱신하지 않았고, `HUDOverlay`의 재시작 처리가 `hud` 상태를 비우지 않았다.
   - 수정: 보스전 진입 시 HUD를 갱신하고 `BOSS` 표기로 분기, 재시작 시 HUD와 방 ID를 초기화, 전투 단계에서만 HUD를 노출하도록 변경.

3. **`eslint-config-next` v16 플랫 설정**
   - 원인: Next 16에서 `next lint`가 제거됨
   - 수정: `eslint.config.mjs` 플랫 설정으로 전환하고 스크립트를 `eslint .`로 변경

#### 검증

- `npx tsc --noEmit` 통과
- `npx eslint .` 오류 0, 경고 0
- `npm run build` 통과, `out/` 정적 산출물 생성
- Playwright(Chromium 1366×768)로 정적 산출물 직접 구동
  - 캔버스 1280×720 마운트, 콘솔 오류 0, 페이지 오류 0
  - 전체 흐름 관통: 시작 → 방1 → 분석 → 강화 → 방2 → 분석 → 강화 → 카운터 방3 → 역기만 판정 → 보스 → 결과 → 재시작
  - F1 디버그 패널에 phase·적중·대시·분류·신뢰도·카운터 방·보스 가중치 표시 확인
- `DirectorPolicy` 규칙 검증 22항목 전부 통과
  - 원거리 60% 이상 → RANGED, 근거리 60% 이상 → MELEE, 전체 적중 0 → MIXED
  - 균형 + 대시 8회 이상 → MOBILE, 대시 부족 시 MIXED
  - 최근 두 방 65/35 가중치, 이전 방 없으면 현재 방 100%
  - 성향별 카운터 방 매핑과 보스 패턴 가중치가 MVP_PLAN §5·§8과 일치
  - 역기만 판정(MIXED 전환 포함)과 체력 20% 회복
  - 동일 입력에 동일 결과

#### 남은 작업

- 전투 담당이 `entities/**` 스텁을 채워야 실제 분류 값이 나온다. 현재는 적중이 0이라 항상 MIXED다.
- 전투 완성 전까지 흐름 확인용으로 F2 방 스킵 키를 남겨두었다. 제출 전 유지 여부를 정한다.

---

### GitHub Pages 최초 배포

- 상태: DONE
- 관련 계획: P-002
- 관련 결정: DEC-005
- 관련 질문: OQ-025 (RESOLVED)

#### 작업

- `feat/project-skeleton` 브랜치를 `main`에 `--no-ff` 머지 (57 파일, 9 커밋)
- GitHub Actions가 정적 내보내기 결과물을 Pages에 배포
- 배포 URL: https://nullstage.github.io/null/

#### 오류 및 원인

- **`README.md`가 UTF-16으로 저장되어 있었다.**
  - 재현: `git diff`에 `Bin 18 -> 3664 bytes`로만 표시되고 내용 diff가 나오지 않음
  - 원인: 최초 커밋 시점부터 UTF-16 인코딩. git이 바이너리로 취급해 diff가 불가능하고 GitHub 웹에서 글자가 깨진다.
  - 수정: UTF-8로 변환. 추적 중인 나머지 56개 파일은 전부 UTF-8임을 확인했다.
  - 재발 방지: `.gitattributes`로 저장소 줄바꿈을 LF로 고정하고 바이너리 에셋만 변환에서 제외했다.

#### 검증

배포본(`https://nullstage.github.io/null/`)에 Playwright로 직접 접속해 확인했다.

- 비로그인·캐시 없는 새 브라우저 컨텍스트에서 접속 성공
- 1366×768과 1920×1080 모두 캔버스 1280×720 유지, 가로 스크롤 없음
- 새로고침 후 빈 화면 없음
- 실패한 네트워크 요청 0건 (에셋 경로 `basePath` 반영 확인)
- 콘솔 오류 0, 페이지 오류 0
- 전체 흐름 관통: 시작 → 방1 → 분석 → 강화 → 방2 → 분석 → 강화 → 카운터 방3 → 역기만 판정 → 보스 → 결과 → 재시작

#### 남은 작업

- 전투가 붙은 뒤 실제 플레이로 재검증한다. 현재는 적이 스텁이라 F2 스킵으로 흐름만 확인했다.

### 15:05 — 시작 화면 Figma 디자인 적용

- 상태: DONE
- 관련 계획: P-012
- 관련 결정: DEC-008
- 관련 질문: OQ-026 (신규 OPEN)
- 관련 AI 로그: AI-004

#### 작업

- 사용자가 `src/` 최상단에 넣어 둔 이미지 4장을 `public/assets/title/`로 옮기고 이름을 정리했다.
  - `background.png` → `background.png`
  - `title.png` → `title-logo.png`
  - `subtitle.png` → `subtitle.png`
  - `decoration.png` → `ornament.png`
- `src/components/ui/TitleScreen.tsx` 신규. Figma `Frame 1`(node `1:33`)의 좌표를 그대로 옮겼다.
- `HUDOverlay`가 `phase === "READY"`일 때 이 화면을 띄우고, 입력 시 `ui:continue`를 발행한다.
- `ReadyScene`에서 플레이스홀더 텍스트와 자체 키·포인터 리스너를 제거했다.
  `CombatScene`·`BossScene`과 같은 `SHUTDOWN → cleanup()` 구독 해제 패턴을 적용했다.
- `theme.font.ui`(Pretendard) 추가, `app/globals.css`에 Pretendard 동적 서브셋 `@import` 추가.

#### 오류 및 원인

- **시작 화면이 뜨지 않을 조건이 있었다.**
  - 원인: `RunState.reset()`이 첫 줄에서 `this.phase = "READY"`로 필드를 직접 대입해,
    뒤따르는 `setPhase("READY")`가 중복 가드(`if (this.phase === phase) return`)에 걸렸다.
    결과적으로 `phase:change`가 한 번도 발행되지 않는다. `BootScene.shutdown()`이 이를 보완하는 것처럼
    보이지만, Phaser는 씬의 `shutdown` 메서드를 자동 호출하지 않는다(다른 씬들은 `events.once(SHUTDOWN)`을 쓴다).
  - 수정: 직접 대입을 제거하고, 모든 필드를 비운 뒤 마지막에 `this.setPhase("READY")`를 호출한다.

- **배경이 의도보다 훨씬 어둡게 나왔다.**
  - 재현: 첫 구현본을 브라우저에서 Figma 스크린샷과 대조. 붉은 달이 거의 보이지 않았다.
  - 원인: 전달받은 `background.png`가 이미 Figma의 `image 1` + `image 2`(`rgba(0,0,0,0.46)` + `blur(6px)`)를
    합쳐 내보낸 결과물인데, 코드에서 같은 오버레이를 한 번 더 얹어 이중 적용됐다.
  - 수정: 오버레이 레이어를 제거하고 배경 이미지만 깔았다. 이유를 주석으로 남겼다.

#### 검증

- `npm run typecheck` / `npm run lint` / `npm run build` 통과
- `npm run dev` 후 브라우저 직접 확인
  - Figma node `1:33` 스크린샷과 타이틀·서브타이틀·장식·안내 문구 위치 대조 일치
  - 장식(`ornament.png`)은 Figma에서 상하 반전 상태라 `scaleY(-1)` 적용, 내보낸 원본과 대조 확인
  - 아무 키 입력 → 시작 화면이 사라지고 `COMBAT` HUD(근거리 / ROOM 1 / 적 2) 표시
  - 콘솔 오류 0

#### 남은 작업

- 조작 안내를 어디에 표시할지 미결정 (OQ-026). 현재는 어디에도 없다.
- 적·플레이어가 스텁이라 전투 화면 자체는 여전히 비어 있다 (P-003·P-004).
- `next dev`가 `CLAUDE.md` 끝에 `nextjs-agent-rules` 블록을 자동 추가한다. 커밋 여부를 정해야 한다.

### 15:45 — 로딩 화면·시작 화면 연출과 화면 전환

- 상태: DONE
- 관련 계획: P-013
- 관련 결정: DEC-009
- 관련 질문: OQ-027 (신규 OPEN)
- 관련 AI 로그: AI-005

#### 작업

- `LoadingScreen.tsx` 신규. 시작 화면 에셋 4장을 프리로드한다.
  흰 배경 + 검은 `LOADING` + 장식, 배경에 번개처럼 내리꽂히는 세로 픽셀 글리치(GSAP).
- `ScreenFade.tsx` 신규. 검게 덮은 시점에 `ui:continue`를 발행하고 다시 걷는다.
- 시작 화면 → 전투 전환을 `none → cover → load → none` 3단계로 두고,
  덮인 뒤 로딩 화면을 한 번 더 보여 준다. 로딩 컴포넌트를 그대로 재사용한다.
- `TitleScreen.tsx`에 등장 타임라인 추가 — 배경 페이드인·아주 느린 줌아웃,
  타이틀 낙하, 장식이 위에서 아래로 자람, 서브타이틀, 안내 문구 페이드인 후 무한 펄스.
- `titleAssets.ts` 신규. 로딩 화면과 시작 화면이 같은 에셋 목록을 본다.
- `theme.z`에 `loading: 40`, `transition: 50` 추가.
- `ornament.png`를 상하 반전해 저장하고 CSS `scaleY(-1)`을 제거했다.

#### 오류 및 원인

- **시작 화면 위아래에 붉은 띠(레터박스)가 남았다.**
  - 재현: 16:9가 아닌 창(1404×840, 1316×904)에서 접속
  - 원인: 배경 이미지가 16:9 무대 안에 있어 무대 크기까지만 채웠다.
  - 수정: 배경을 무대 밖으로 빼서 화면 전체를 `object-fit: cover`로 덮게 했다.
    배경은 잘려도 되고 타이틀은 잘리면 안 되므로 둘의 좌표계를 분리했다.

- **로딩 화면이 걷히는 동안 흰색이 검게 탁해졌다.**
  - 원인: 페이드아웃이 끝난 뒤에 시작 화면을 붙여서, 걷히는 동안 아래가 비어 있었다.
  - 수정: `onReveal`을 추가해 걷히기 **시작**할 때 시작 화면을 먼저 붙인다.

#### 검증

- `npm run typecheck` / `npm run lint` / `npm run build` 통과
- 브라우저 직접 확인
  - 로딩(흰 배경·검은 LOADING·글리치) → 걷히며 시작 화면이 드러남 → 타이틀 등장 → 안내 문구 펄스
  - 클릭·키 입력 → 검은 페이드 → `근거리 / ROOM 1 / 적 2` HUD
  - 1404×840(16:9 아님)에서 배경이 화면 전체(1920×1149 뷰포트에서 2014×1206)를 덮어 여백 0
  - 콘솔 오류 0

#### 남은 작업

- 로딩 화면 디자인은 Figma 시안이 없는 임시안이다 (OQ-027).
- 배경을 `cover`로 덮으면서 창 비율에 따라 Figma 원본과 구도가 조금 달라진다. 의도한 맞바꿈이다.
- 백그라운드 탭에서는 브라우저가 `requestAnimationFrame`을 늦춰 연출이 멈춘 것처럼 보인다.
  탭으로 돌아오면 이어서 재생된다. 정상 동작이며, 자동화 검증 시 이 점을 감안해야 한다.

---

## 기록 템플릿

```md
## YYYY-MM-DD HH:mm — 작업 제목

- 상태: DONE | PARTIAL | FAILED
- 관련 계획: P-XXX
- 관련 결정: DEC-XXX
- 관련 AI 로그: AI-XXX

### 작업
- 실제 수정 내용
- 주요 변경 파일

### 오류 및 원인
- 재현 방법
- 확인한 원인
- 적용한 수정

### 검증
- 실행 명령
- 직접 플레이 시나리오
- 결과

### 남은 작업
- 미완료 항목
- 후속 위험
```
