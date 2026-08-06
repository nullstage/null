# Project NULL — 작업 규칙 (`CLAUDE.md`)

> NullStage의 NAN2026 사전과제 프로젝트 **Project NULL** 작업 규칙이다.  
> 기본 구현안은 **Phaser 3 · TypeScript · Vite**, 배포는 **GitHub Pages**다.  
> 기술 스택이 아직 확정되지 않았다면 `docs/OpenQuestions.md`에서 먼저 결정하고 `docs/DecisionLog.md`에 기록한다.  
> 프로젝트의 구현 범위와 세부 기준은 [`MVP_PLAN.md`](./MVP_PLAN.md)를 정본으로 따른다.

---

## 1. 프로젝트 목표

Project NULL은 플레이어의 전투 습관을 분석해 다음 방과 보스 행동을 바꾸는  
**Counter Director System**을 핵심으로 하는 2D 액션 로그라이크다.

핵심 경험은 다음 네 단계다.

```text
플레이어 전투 분석
→ 다음 방 카운터 구성
→ 플레이 스타일 전환을 통한 역기만
→ 보스 패턴 변화
```

이번 작업의 목표는 많은 콘텐츠가 아니라, **5~8분짜리 한 번의 런에서 위 경험이 명확히 드러나는 Web MVP**를 완성하는 것이다.

---


# Required Artifacts

프로젝트 문서는 다음 역할로 분리한다. 같은 내용을 여러 문서에 중복 작성하지 않는다.

## 정본 계획

| 문서 | 용도 |
|---|---|
| `MVP_PLAN.md` | MVP 범위, 시스템 계약, 구현 기준, 삭제 기준. 범위가 변경될 때만 갱신한다. |

## 운영 관리 문서

| 문서 | 용도 |
|---|---|
| `docs/Plan.md` | 현재 작업의 롤링 계획. 목표, 담당, 순서, 완료 조건, 다음 작업을 관리한다. |
| `docs/OpenQuestions.md` | 아직 결정되지 않아 구현을 막거나 결과에 영향을 주는 질문과 선택지를 관리한다. |
| `docs/DecisionLog.md` | 확정된 주요 결정과 근거, 검토한 대안, 영향 범위를 기록한다. |
| `docs/WorkLog.md` | 실제 작업, 발생한 오류, 원인, 수정, 검증 결과를 기록한다. |
| `docs/ai-log/YYYY-MM-DD.md` | 기능·설계·버그 단위의 대표 AI 프롬프트와 최종 반영 내용을 기록한다. |

## 문서 흐름

```text
미결정 사항 발생
→ OpenQuestions.md 등록
→ 사용자 또는 팀 결정
→ DecisionLog.md 기록
→ 필요하면 MVP_PLAN.md 갱신
→ Plan.md에 구현 작업 반영
→ 구현 및 검증
→ WorkLog.md와 ai-log 갱신
```

- `MVP_PLAN.md`는 전체 범위와 계약을 담는 비교적 안정적인 문서다.
- `Plan.md`는 지금 무엇을 할지 관리하는 자주 바뀌는 문서다.
- 질문이 해결되면 `OpenQuestions.md`에서 상태를 `RESOLVED`로 바꾸고 Decision ID를 연결한다.
- 구현 중 새로운 정책을 임의로 확정하지 않는다. 결과에 영향을 주는 사항은 먼저 질문으로 등록한다.

---

# Working Rules

1. **구현 전 문서 확인 및 Plan 갱신**
   - 기능을 추가하거나 수정하기 전에 `MVP_PLAN.md`, `docs/OpenQuestions.md`, `docs/Plan.md`를 확인한다.
   - 실제 구현 전에 `docs/Plan.md`에 목표, 변경 파일, 완료 조건, 검증 방법을 기록한다.
   - 미결정 사항이 있으면 구현을 추측으로 진행하지 않고 `docs/OpenQuestions.md`에 등록한 뒤 질문한다.
   - 계획과 다른 기능을 임의로 추가하지 않는다.
   - 계획과 코드가 어긋나면 현재 의도를 확인하고 문서를 먼저 정합화한다.

2. **핵심 루프 우선**
   - 우선순위는 아래 순서를 따른다.

   ```text
   실행 가능
   > 플레이어 조작
   > 전투 감각
   > 적 동작
   > 전투 데이터 수집
   > Director 분석
   > 다음 방 변화
   > 보스 변화
   > 결과 리포트
   > 폴리싱
   ```

   - 핵심 루프가 완성되지 않은 상태에서 추가 적, 추가 무기, 로고 애니메이션, 설정 화면 등을 먼저 만들지 않는다.

3. **범위 확대 금지**
   - 다음 기능은 사용자 승인 없이 구현하지 않는다.
     - 백엔드 API 및 데이터베이스
     - 계정과 장기 플레이어 프로필
     - 실시간 생성형 AI 호출
     - 절차적 맵 생성
     - 여러 캐릭터 또는 여러 보스
     - 영구 성장, 상점, 인벤토리, NPC
     - 멀티플레이
     - 복잡한 환경 변화

4. **사용자 결정 필요 시 질문**
   - 게임 엔진 변경
   - 핵심 전투 방식 변경
   - 게임 루프 변경
   - MVP 범위 변경
   - 유료 에셋 또는 외부 API 도입
   - 배포 방식 변경  
   위 사항은 임의로 결정하지 않고 먼저 질문한다.

5. **작업 단위를 작게 유지**
   - 한 번에 하나의 기능 또는 하나의 오류만 처리한다.
   - 기능 구현과 대규모 리팩터링을 같은 작업에 섞지 않는다.
   - 3일 차 종료 이후에는 신규 핵심 기능을 추가하지 않는다.

6. **추측보다 실행 검증**
   - 버그는 재현하고 원인을 확인한 뒤 수정한다.
   - 임의의 지연 시간, 무작위 재시도, 전역 상태 추가로 증상을 덮지 않는다.
   - 빌드 성공만으로 완료 처리하지 않고 실제 브라우저에서 플레이한다.

7. **작업 완료 후 기록**
   - 실제 수행 내용과 검증 결과는 `docs/WorkLog.md`에 기록한다.
   - 정책이나 범위가 확정되었다면 `docs/DecisionLog.md`를 갱신한다.
   - AI를 활용한 핵심 작업은 `docs/ai-log/`에 대표 프롬프트와 사람의 판단을 남긴다.
   - `Plan.md`의 해당 항목을 완료 처리하고 다음 작업을 갱신한다.

---

# Development Guide

## 게임 상태 관리

게임 진행 상태는 한 곳에서 관리한다.

```ts
type GamePhase =
  | "BOOT"
  | "READY"
  | "COMBAT"
  | "ANALYSIS"
  | "UPGRADE"
  | "BOSS"
  | "RESULT"
  | "GAME_OVER";
```

Scene, UI, 적 객체가 각각 독립적으로 다음 방이나 결과 상태를 변경하지 않도록 한다.

## 책임 분리

권장 책임은 다음과 같다.

```text
PlayerController
- 이동, 점프, 대시, 공격, 피격

CombatTelemetry
- 공격, 적중, 대시, 피격, 클리어 시간 기록

DirectorPolicy
- 플레이 스타일 분류
- 다음 방 선택
- 보스 패턴 가중치 계산

RoomController
- 적 스폰
- 방 시작과 종료

UpgradeSystem
- 강화 선택지 생성 및 적용

BossController
- 보스 상태와 패턴 선택

RunState
- 현재 방
- 누적 데이터
- 선택 강화
- Director 예측
```

4일 MVP이므로 과도한 추상화나 범용 프레임워크 제작은 피한다.

## 계약 우선

아래 타입을 먼저 확정하고, 모든 시스템이 동일한 계약을 사용한다.

```ts
interface CombatTelemetry {
  meleeAttacks: number;
  meleeHits: number;
  rangedAttacks: number;
  rangedHits: number;
  dashCount: number;
  airAttackCount: number;
  damageTakenCount: number;
  clearTimeMs: number;
  remainingHp: number;
}

type PlayStyle = "MELEE" | "RANGED" | "MOBILE" | "MIXED";

interface DirectorAnalysis {
  style: PlayStyle;
  confidence: number;
  counterRoomId: string;
  dialogueId: string;
}

interface BossPatternWeights {
  slash: number;
  dash: number;
  projectile: number;
  slam: number;
}
```

## Counter Director 원칙

- MVP에서는 규칙 기반 정책 엔진을 사용한다.
- 적 체력과 공격력은 플레이 성향에 따라 올리지 않는다.
- 플레이 스타일에 맞는 적 조합과 보스 패턴 비중만 바꾼다.
- 카운터는 플레이어의 주력 방식을 완전히 봉쇄하지 않는 **소프트 카운터**여야 한다.
- 분석 결과는 플레이어가 이해할 수 있도록 화면에 표시한다.
- 플레이어가 스타일을 바꿔 예측을 빗나가게 할 수 있어야 한다.

금지 예시:

- 모든 투사체 완전 반사
- 대시 사용 즉시 피격
- 특정 무기 무효화
- 분석 결과에 따른 적 공격력 급증

## 게임 수치 관리

적 체력, 공격력, 이동속도, Director 임계값, 보스 패턴 가중치는 Scene 내부에 흩뿌리지 않는다.

권장 위치:

```text
src/config/gameBalance.ts
src/data/enemies.ts
src/data/upgrades.ts
src/data/directorRules.ts
```

---

# AI 사용 기록

대회 제출을 위해 AI 사용 내역을 남긴다.

## 기록 대상

다음 작업에서 AI를 사용하면 기록한다.

- 아이디어 및 설계 검토
- 코드 생성과 리팩터링
- 버그 분석
- 테스트 케이스 작성
- 밸런스 검토
- UI 문구 및 문서 작성
- 에셋 생성

## 기록 방식

모든 대화를 그대로 저장하지 않는다.  
**기능·설계·버그 단위의 대표 프롬프트**만 남긴다.

파일 위치:

```text
docs/ai-log/2026-08-06.md
docs/ai-log/2026-08-07.md
docs/ai-log/2026-08-08.md
docs/ai-log/2026-08-09.md
```

기록 형식:

```md
## AI-001 — 작업 제목

### 목적
무엇을 해결하기 위해 사용했는지

### 사용 도구
도구와 모델

### 대표 프롬프트
실제로 사용한 핵심 프롬프트

### AI 제안 요약
제안의 핵심

### 최종 반영
실제 코드나 기획에 적용한 내용

### 사람의 수정 및 판단
거절하거나 수정한 내용과 이유

### 관련 파일
수정된 주요 파일
```

AI 로그에는 API 키, 토큰, 개인정보, 로컬 사용자 경로를 남기지 않는다.

---

Model & Subagent Rules

기본 원칙

기본은 메인 에이전트가 직접 처리한다.

순차적인 단일 작업, 파일 2~3개 수준의 수정, 작은 버그 수정은 서브에이전트에 위임하지 않는다.

실패 영향이 크더라도 범위가 좁다면 메인 에이전트가 직접 신중하게 처리한다.

위임 자체가 품질이나 속도를 보장하지 않는다. 작업 분할과 통합 비용이 더 크면 직접 처리한다.

위임이 허용되는 경우

서브에이전트는 다음 두 경우에만 사용한다.

서로 독립적인 작업을 병렬로 진행할 때

플레이어 전투와 Director 정책처럼 수정 파일이 겹치지 않는 경우

게임 로직과 배포 설정처럼 서로 독립적으로 검증할 수 있는 경우

광범위한 탐색이 필요할 때

저장소 전체 구조 파악

다수 파일에서 상태 전환 또는 이벤트 흐름 추적

에셋 참조, 중복 로직, 전역 상태 사용처 전체 검색

결론만 받아 메인 에이전트가 최종 판단할 수 있는 조사

다음 작업은 위임하지 않는다.

한 파일 또는 소수 파일의 단순 수정

순서대로 처리해야 하는 단일 기능

앞 단계 결과를 받아야 다음 단계가 가능한 작업

같은 파일을 여러 에이전트가 동시에 수정해야 하는 작업

통합 판단이 핵심인 짧은 설계 작업

파일 소유권

병렬 작업 시 파일 소유권을 명확히 분리한다.

예:

Agent A
- src/game/entities/Player.ts
- src/game/systems/CombatTelemetry.ts

Agent B
- src/game/systems/DirectorPolicy.ts
- src/game/data/directorRules.ts

Agent C
- .github/workflows/
- vite.config.*
- 배포 검증

규칙:

같은 파일을 여러 에이전트가 동시에 편집하지 않는다.

공통 타입이나 계약 파일은 먼저 메인 에이전트가 확정한다.

공통 파일 수정이 필요하면 병렬 작업을 중단하고 메인 에이전트가 통합한다.

서브에이전트는 자신에게 할당되지 않은 파일을 임의로 수정하지 않는다.

위임 프롬프트 필수 항목

서브에이전트에게 작업을 맡길 때는 반드시 다음을 포함한다.

작업 목표
읽어야 할 파일
수정 가능한 파일
수정하면 안 되는 파일
따라야 할 타입과 계약
완료 조건
검증 명령
실제 플레이 검증 시나리오
최종 보고 형식

예:

목표:
플레이 데이터를 MELEE, RANGED, MOBILE, MIXED로 분류하는 규칙 기반 DirectorPolicy 구현

읽을 파일:
- MVP_PLAN.md
- src/game/types/game.ts
- src/game/systems/CombatTelemetry.ts

수정 가능:
- src/game/systems/DirectorPolicy.ts
- src/game/data/directorRules.ts
- 관련 단위 테스트

수정 금지:
- Player.ts
- CombatScene.ts
- Boss.ts

계약:
- PlayStyle 타입과 DirectorAnalysis 인터페이스 변경 금지
- 현재 방 65%, 이전 방 35% 가중치 사용
- 적 체력과 공격력 조절 금지

검증:
- npm run build
- 원거리 60% 이상일 때 RANGED
- 근거리 60% 이상일 때 MELEE
- 전체 적중 0이면 MIXED
- 동일 입력에 동일 결과

보고:
- 수정 파일
- 구현 요약
- 검증 결과
- 남은 위험

모델 선택

판단, 설계, 디버깅, 통합 검토가 필요한 작업은 상위 추론 모델을 사용한다.

명세가 확정된 반복 구현, 파일 변환, 기계적인 테스트 작성은 경량 모델을 사용할 수 있다.

모델 선택보다 작업 범위와 계약을 명확하게 주는 것을 우선한다.

결과 통합

서브에이전트의 완료 보고를 그대로 신뢰하지 않는다.

메인 에이전트가 반드시 확인한다.

실제 diff

수정 범위 준수 여부

타입과 계약 일치 여부

불필요한 기능 추가 여부

npm run build 결과

배포 환경 동작 여부

전체 게임 흐름과의 충돌

재시작 시 상태 초기화

GitHub Pages 에셋 경로

서브에이전트가 각자 테스트를 통과했더라도, 병합 후 전체 시나리오를 다시 검증한다.

4일 MVP에서의 권장 병렬화

권장:

Day 1
- Agent A: 플레이어 이동과 전투
- Agent B: 상태 구조, 텔레메트리, 최초 배포

Day 2
- Agent A: 적 3종과 방
- Agent B: Director 정책과 분석 UI

Day 3
- Agent A: 보스
- Agent B: 강화, 역기만, 결과 리포트

비권장:

- 여러 에이전트가 CombatScene을 동시에 수정
- 플레이어 전투를 공격, 대시, 피격으로 지나치게 분할
- Director 설계와 구현을 서로 다른 에이전트가 순차적으로 왕복
- 작은 버그 하나를 탐색, 수정, 검증 에이전트로 각각 분리

---

# Git Rules

## 브랜치

작은 문구 수정, 단순 버그, 밸런스 값 변경은 `main`에 직접 반영할 수 있다.

여러 파일에 걸친 기능은 브랜치를 사용한다.

```text
feat/player-combat
feat/director-policy
feat/enemies
feat/boss
fix/room-transition
docs/ai-log
```

같은 파일을 여러 작업자가 동시에 수정하지 않는다.

## 커밋

한 커밋에는 하나의 목적만 포함한다.

```text
feat: add melee and ranged combat modes
feat: classify player combat style
feat: generate counter room preset
feat: apply director weights to boss patterns
fix: reset telemetry on restart
docs: record director policy decision
```

다음은 커밋하지 않는다.

```text
node_modules/
dist/
.env
*.local
개인 인증 정보
임시 로그
```

커밋 메시지와 브랜치명에는 자동 생성 도구 서명을 넣지 않는다.

```text
Co-Authored-By: Claude
Generated with Claude Code
```

AI 사용 내역은 `docs/ai-log/`에서 별도로 관리한다.

---

# Deployment Rules

- Web 빌드는 GitHub Pages에 배포한다.
- `main` 반영 시 GitHub Actions가 `dist/`를 자동 배포한다.
- 배포 파이프라인은 1일 차에 먼저 검증한다.
- 게임 핵심 로직은 전부 클라이언트에서 동작해야 한다.
- 런 데이터는 메모리에서 관리하고, 필요한 경우에만 `localStorage`를 사용한다.
- GitHub Pages의 저장소 하위 경로를 고려해 Vite `base`를 설정한다.
- 사운드는 사용자 입력 이후 활성화한다.

최소 검증 환경:

- Chrome 최신 버전
- 시크릿 창
- GitHub 로그아웃 상태
- 1366×768
- 1920×1080
- 캐시 삭제 후 재접속

---

# Validation

작업 전 프로젝트의 실제 스크립트를 확인한다.

최소 필수 검증:

```bash
npm run build
```

스크립트가 존재하면 함께 실행한다.

```bash
npm run lint
npm run test
```

필수 플레이 시나리오:

### 원거리 플레이

```text
원거리 공격 위주
→ RANGED 분석
→ 추격형 중심 방
→ 보스 돌진 패턴 비중 증가
```

### 근거리 플레이

```text
근거리 공격 위주
→ MELEE 분석
→ 견제형 중심 방
→ 보스 투사체 패턴 비중 증가
```

### 역기만

```text
초반 원거리 위주
→ RANGED 분석
→ 근거리 강화 선택
→ 근거리 전환
→ 예측 실패 표시
```

실패 경로도 확인한다.

- 일반방 및 보스전 사망 후 재시작
- 방 클리어 이벤트 중복 호출
- 강화 선택 중 중복 입력
- 적이 없는 방에서 진행 정지
- 새로고침 후 빈 화면
- 에셋 또는 사운드 로딩 실패
- 재시작 후 이전 런 데이터 잔존

---

# Completion Checklist

- [ ] 배포 URL에서 별도 설치 없이 실행된다.
- [ ] 이동·점프·공격·대시가 정상 동작한다.
- [ ] 원거리와 근거리 플레이가 다르게 분류된다.
- [ ] 분류 결과에 따라 다음 방이 달라진다.
- [ ] 분석 결과와 Director 대사가 표시된다.
- [ ] 스타일 전환으로 예측을 빗나가게 할 수 있다.
- [ ] 보스 패턴 비중이 플레이 성향에 따라 바뀐다.
- [ ] 사망 후 정상적으로 재시작된다.
- [ ] 처음부터 결과 화면까지 5~8분 안에 진행된다.
- [ ] `npm run build`가 통과한다.
- [ ] 배포 환경에서 치명적인 콘솔 오류가 없다.
- [ ] `docs/Plan.md`가 현재 작업 상태와 일치한다.
- [ ] 미결정 사항이 `docs/OpenQuestions.md`에 남아 있다.
- [ ] 확정된 주요 결정이 `docs/DecisionLog.md`에 기록되어 있다.
- [ ] 작업·오류·검증 결과가 `docs/WorkLog.md`에 기록되어 있다.
- [ ] 주요 AI 사용 내역이 `docs/ai-log/`에 기록되어 있다.
