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
