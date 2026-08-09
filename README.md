# Project NULL

플레이어의 전투 습관을 분석해 다음 방과 보스 행동을 바꾸는 **Counter Director System** 중심의 2D 액션 로그라이크.

```text
플레이어 전투 분석 → 다음 방 카운터 구성 → 플레이 스타일 전환을 통한 역기만 → 보스 패턴 변화
```

배포: https://nullstage.github.io/null/

## 실행

```powershell
npm install
npm run dev      # http://localhost:3000
```

| 스크립트 | 용도 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 정적 내보내기 (`out/`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | 타입 검사 |

## 스택

Next.js(App Router) · Phaser 3 · GSAP · Emotion · TypeScript — 근거는 `docs/DecisionLog.md` DEC-005.

배포는 정적 내보내기 결과물을 GitHub Pages에 올린다. `main` 푸시 시
`.github/workflows/deploy.yml`이 빌드·배포하며, 저장소 하위 경로 때문에
CI에서 `NEXT_PUBLIC_BASE_PATH=/null`을 주입한다.

## 런 흐름

```text
시작 화면 → 방 1(무전투 튜토리얼, DEC-013)
→ 방 2(1웨이브 분석 → 2·3웨이브 축소판 소프트 카운터, DEC-016)
→ 분석·카운터 예고 → 강화
→ 방 3(카운터 방) → 역기만 판정 → 강화
→ 보스(방 3 65% + 방 2 35% 가중, DEC-019) → 결과 리포트
```

강화는 방 1·2·3 클리어 후 3회 지급한다(DEC-015).
패링·아티팩트·NPC 상점·NPC 이벤트는 DEC-014로 승인된 확장 범위다.

## 구조

UI는 Phaser 내부가 아니라 캔버스 위 React DOM 오버레이에 있다(DEC-006).
둘은 `src/game/EventBus.ts`로만 통신하며 서로의 객체를 직접 참조하지 않는다.

```text
app/               Next.js 셸
src/components/    React UI (Emotion + GSAP) — HUD·패널·시작 화면
src/game/
  scenes/          Boot / Ready / Combat / Boss
  entities/        Player · Boss · 적 3종
  systems/         Telemetry · DirectorPolicy · RunState · Upgrade · Engravings · Room · Audio · Vfx
  data/            enemies · rooms · upgrades · engravings · shop · npcEvents · directorRules
  config/          gameBalance · gameConfig · inputConfig
public/assets/     스프라이트·배경·타일·UI·오디오
docs/              계획·결정·작업 기록
```

전체 구조는 `MVP_PLAN.md` §11 참고.

## 담당 구분

`docs/DecisionLog.md` DEC-007 기준이다.

| 영역 | 담당 | 파일 |
|---|---|---|
| 전투 | 팀원 | `src/game/entities/**`, 씬의 지형·연출 부분 |
| 시스템 | 본인 | `src/game/systems/**`, `src/game/data/**`, `src/components/**`, 배포 |

전투 코드에서 `telemetry.record*()`와 `emitHud()` 호출은 지우지 않는다.
전자는 Director 분석의 유일한 입력이고, 후자는 HUD 갱신의 유일한 경로다.
키 코드도 하드코딩하지 말고 `KEY_BINDINGS`를 참조한다.

공통 타입(`src/game/types/game.ts`)과 이벤트 계약(`src/game/EventBus.ts`)은 시스템 담당이 관리한다.

## 조작

기본값은 `src/game/config/inputConfig.ts`에 있다. 키 바인딩 자체는 아직 미확정(OQ-004)이지만,
시작 화면 설정에서 바꿀 수 있고 변경분은 `localStorage`에 남는다.

| 동작 | 키 |
|---|---|
| 이동 | A / D |
| 점프 | Space |
| 대시 | Shift |
| 공격 | J |
| 모드 전환 | K |
| 패링 | S |
| 스킬 1·2·3 (아티팩트로 해금) | Q / R / F |
| 상호작용 (전송 게이트 등) | W |
| 확인 | Enter |
| 키맵 도움말 | H |
| 일시정지 | ESC |
| 디버그 패널 | F1 |
| 방 즉시 클리어 (`?debug=1`일 때만, DEC-018) | F2 |

디버그 키 F1·F2·H는 재바인딩 대상이 아니다.
키맵 모달은 방 1 서사 종료 직후 최초 1회 자동으로 뜨고, 그 뒤에는 H로 다시 열 수 있다(DEC-020).

## 문서

| 문서 | 용도 |
|---|---|
| `MVP_PLAN.md` | MVP 범위와 시스템 계약 (정본) |
| `docs/Plan.md` | 현재 작업의 롤링 계획 |
| `docs/OpenQuestions.md` | 미결정 사항 |
| `docs/DecisionLog.md` | 확정된 결정과 근거 |
| `docs/WorkLog.md` | 실제 작업과 검증 결과 |
| `docs/GameText.md` | 인게임 문구 |
| `docs/sprite-prompts.md` | 에셋 생성 프롬프트 |
| `docs/ai-log/` | AI 사용 기록 |

코드에 `OQ-XXX 미결정` 주석이 있는 값은 임시값이다. 확정된 수치로 취급하지 않는다.
