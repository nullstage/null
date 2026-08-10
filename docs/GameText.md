# Game Text — 대사·UI 문구 전체 목록

> 코드베이스에서 사용하는 모든 대사, 강화/각인/스킬 설명, UI 문구, 안내 텍스트를 한 곳에 모은 참조 문서다.
> Project NULL의 핵심 어휘인 **기록 · 이름 · 침식 · 시험 · 예측**의 톤을 일관되게 유지한다.
> 소스가 바뀌면 이 문서도 함께 갱신한다. 각 항목에 출처 파일을 표기한다.

---

## 1. 프롤로그 (런 시작 시, 검은 화면)

출처: `src/components/ui/PrologueText.tsx`

1. 이름을 잃은 자는 수없이 이곳을 지나갔다.
2. 그러나 끝까지 기록된 이름은 아직 하나도 없다.

---

## 2. 튜토리얼 — 기록자 대화 (방 1 진입 시)

출처: `src/components/ui/DialogueBox.tsx`
화자: **기록자**

1. ……또 하나가 눈을 떴군.
2. 이곳은 NULL. 이름을 잃은 것들이 마지막으로 흘러드는 곳이다.
3. 붉은 달 아래에서는 기억도, 몸도 오래 버티지 못한다.
4. 저 밖을 떠도는 것들도 처음부터 괴물이었던 것은 아니다.
5. 침식은 먼저 기억을 흐리고, 다음에는 이름을 지운다. ……너 역시 많은 것을 잊었겠지.
6. 놈들이 남기는 그림자 조각에는 지워지기 전의 기억이 조금 남아 있다. 필요하다면 거두어라.
7. 나는 이곳에서 지나간 자들을 기록한다.
8. 어떻게 싸웠는지. 무엇을 탐냈는지. 무엇을 두려워했는지.
9. 기록이 쌓이면 이곳도 너를 알게 된다.
10. 그리고 너를 알게 된 세계는, 더 이상 같은 시험을 내리지 않는다.
11. 그래도 앞으로 갈 생각이라면 문을 열어라.
12. 네 이름이 끝까지 남는지, 지켜보겠다.

---

## 3. Director(기록자) 대사

출처: `src/game/data/directorRules.ts` — `DIRECTOR_DIALOGUE`

화자는 NULL의 **기록자이자 시험을 설계하는 관찰자**다.
감정을 크게 드러내지 않고, 플레이어의 행동을 이미 기록해 두었다는 듯한 담담한 단문을 사용한다.

| ID                  | 대사                      |
| ------------------- | ----------------------- |
| `analysis_ranged`   | 거리를 두는 습관이 기록되었다.       |
| `analysis_melee`    | 칼끝을 믿는 자로군.             |
| `analysis_mobile`   | 발을 멈추는 법을 모르는군.         |
| `analysis_mixed`    | 아직 하나의 이름으로 묶기 어렵다.     |
| `counter_ranged`    | 다음 기록에는 숨을 거리가 부족할 것이다. |
| `counter_melee`     | 다음에는 그 칼끝이 닿기 어려울 것이다.  |
| `counter_mobile`    | 네가 달아날 자리부터 지워 두었다.     |
| `counter_mixed`     | 아직 판단하지 않겠다. 조금 더 보여라.  |
| `deception_success` | ……기록과 다르군. 네가 나를 속였다.   |
| `deception_failed`  | 예상대로다. 기록은 틀리지 않았다.     |

### 플레이 스타일 칭호 (`STYLE_TITLE`)

| 스타일    | 칭호           |
| ------ | ------------ |
| MELEE  | 칼끝을 믿는 자     |
| RANGED | 거리를 지키는 자    |
| MOBILE | 멈추지 않는 자     |
| MIXED  | 아직 기록되지 않은 자 |

### 다음 방 예고 (`COUNTER_SUMMARY`)

| 스타일    | 문구                   |
| ------ | -------------------- |
| MELEE  | 칼끝이 닿기 어려운 시험이 기다린다  |
| RANGED | 거리를 허락하지 않는 시험이 기다린다 |
| MOBILE | 움직임을 읽는 시험이 기다린다     |
| MIXED  | 아직 시험은 정해지지 않았다      |

### 스타일 표기 라벨 (`STYLE_LABEL`, `src/components/ui/AnalysisPanel.tsx`)

MELEE: 근거리 / RANGED: 원거리 / MOBILE: 기동 / MIXED: 혼합

---

## 4. 방랑자 NPC 대사

출처: `src/game/data/npcEvents.ts` — `NPC_EVENT.lines`

**우호(friendly)**

* ……아직 네 이름은 완전히 지워지지 않았군. 가져가라.
* 이 기억은 오래 붙들고 있었다. 이제 내게는 필요 없다.

**적대(hostile)**

* ……네 이름이 들린다.
* 내 것은 지워졌는데…… 왜 네 것은 아직 남아 있지?

---

## 5. 강화(Upgrade) 8종 + 확장 목록

출처: `src/game/data/upgrades.ts`

| ID                       | 분류       | 이름       | 설명                                                        |
| ------------------------ | -------- | -------- | --------------------------------------------------------- |
| MELEE_DAMAGE_UP          | MELEE    | 날 세우기    | 근거리 공격력이 20% 증가한다.                                        |
| MELEE_FINISHER_RANGE_UP  | MELEE    | 긴 궤적     | 근거리 연속 공격의 마지막 타격 범위가 넓어진다.                               |
| BLADE_REFORGED           | MELEE    | 다시 벼린 검  | 검이 더욱 길고 무거워진다. 피해량이 35% 증가하고 사거리가 늘어난다. 공격 궤적이 흰빛으로 변한다. |
| MELEE_BLADE_SIZE_UP      | MELEE    | 거대한 칼날   | 검의 공격 판정과 궤적 크기가 증가한다.                                    |
| MELEE_FIRE_EDGE (화염)     | MELEE    | 타오르는 칼날  | 근거리 공격에 화염이 깃든다. 적중한 대상은 잠시 불타며 추가 피해를 입는다.               |
| MELEE_SWORD_WAVE         | MELEE    | 검기       | 스킬 해금 — Q를 눌러 전방으로 날아가는 참격을 사용한다. 재사용 대기시간 4초.            |
| MELEE_SPIKE_ERUPTION     | MELEE    | 검극(劍棘)   | 스킬 해금 — R를 눌러 전방의 지면에서 검의 가시를 연속으로 솟구치게 한다. 재사용 대기시간 6초.  |
| MELEE_BLADE_CYCLONE      | MELEE    | 검무(劍舞)   | 스킬 해금 — F를 눌러 몸 주변을 휩쓰는 검의 폭풍을 일으킨다. 재사용 대기시간 8초.         |
| RANGED_COOLDOWN_DOWN     | RANGED   | 속사       | 원거리 공격의 발사 간격이 20% 감소한다.                                  |
| RANGED_PIERCE            | RANGED   | 관통탄      | 투사체가 적 1명을 추가로 관통한다.                                      |
| BARREL_REFORGED          | RANGED   | 개조된 총열   | 탄환의 피해량이 40% 증가하고 탄속이 빨라진다. 탄 궤적도 더욱 선명해진다.               |
| RANGED_BULLET_SIZE_UP    | RANGED   | 중탄       | 탄환 크기와 적중 판정 범위가 증가한다.                                    |
| RANGED_FROST_ROUND (냉기)  | RANGED   | 냉기탄      | 원거리 공격에 냉기가 깃든다. 적중한 대상의 움직임이 잠시 느려진다.                    |
| RANGED_POISON_ROUND (맹독) | RANGED   | 맹독탄      | 원거리 공격에 맹독이 깃든다. 적중한 대상은 일정 시간 지속 피해를 입는다.                |
| RANGED_FIRE_ROUND (화염)   | RANGED   | 소이탄      | 원거리 공격에 화염이 깃든다. 적중한 대상은 잠시 불타며 추가 피해를 입는다.               |
| RANGED_MAG_UP            | RANGED   | 확장 탄창    | 탄창 용량이 3발 증가한다.                                           |
| DASH_CHARGE_UP           | MOBILITY | 두 번째 발걸음 | 대시 충전 횟수가 1 증가한다.                                         |
| DASH_FOLLOWUP_DAMAGE_UP  | MOBILITY | 틈새 베기    | 대시 직후 사용하는 첫 공격의 피해량이 증가한다.                               |
| DASH_COOLDOWN_DOWN       | MOBILITY | 가벼운 발    | 대시 충전 시간이 25% 감소한다.                                       |
| DASH_INVULN_UP           | MOBILITY | 잔영       | 대시 중 무적 시간이 증가한다.                                         |
| HEALTH_MAX_UP            | HEALTH   | 남은 숨     | 최대 체력이 증가하고 증가한 만큼 즉시 회복한다.                               |
| HEALTH_REGEN             | HEALTH   | 되찾은 숨    | 방을 클리어할 때마다 체력을 소량 회복한다.                                  |
| HEALTH_ARMOR             | HEALTH   | 굳은 몸     | 받는 피해가 소폭 감소한다.                                           |

### 분류 라벨 (`CATEGORY_LABEL`, `src/components/ui/StatusPanel.tsx`)

MELEE: 근접 / RANGED: 원거리 / MOBILITY: 기동 / HEALTH: 생존

### 속성 라벨 (`ELEMENT_LABEL`)

FIRE: 화염 / FROST: 냉기 / POISON: 맹독

### 강화 보스 직전 마지막 지급 문구 (`UpgradePanel.tsx`)

> "마지막 기록을 남길 준비를 해라."

---

## 6. 각인(刻印) — 기록 제단

출처: `src/game/data/engravings.ts`

| ID          | 이름     | 설명                                           |
| ----------- | ------ | -------------------------------------------- |
| ROOT        | 첫 글자   | 기록자가 지워진 이름의 첫 글자를 다시 새겼다. 모든 각인은 여기에서 시작된다. |
| VIGOR       | 견딤     | 새로운 기록을 시작할 때 최대 체력이 10 증가한다.                |
| MEMORY      | 기억 갈무리 | 새로운 기록을 그림자 조각 4개와 함께 시작한다.                  |
| SPARE_SHELL | 여분의 탄피 | 새로운 기록을 시작할 때 탄창 용량이 1발 증가한다.                |
| SWORD_PATH  | 검로(劍路) | 스킬 재사용 대기시간이 12% 감소한다.                       |
| AFTERIMAGE  | 잔영     | 새로운 기록을 시작할 때 대시 충전 횟수가 1 증가한다.              |

각인판 안내 문구(`EngravePanel.tsx`, 아무 노드도 선택하지 않았을 때):

> 각인에 마우스를 올리면 남겨진 기록을 확인할 수 있습니다.
> 새길 수 있는 각인을 선택하면 다음 기록에도 그 흔적이 남습니다.
> *침식도 한 번 새겨진 기록까지는 지우지 못한다.*

---

## 7. 보스 패턴 라벨

출처: `src/components/ui/ResultPanel.tsx` — `PATTERN_LABEL`

slash: 베기 / dash: 돌진 / projectile: 투사체 / slam: 내려찍기

---

## 8. UI 패널 — 타이틀 & 본문 문구

### AnalysisPanel (방 클리어 후 분석)

출처: `src/components/ui/AnalysisPanel.tsx`

* 패널 제목: 「기록 분석」
* 부제: `{스타일} 성향으로 판단 — 확신도 N%`
* 항목: 근거리 적중 / 원거리 적중 / 기동 의존도
* 다음 방 표시: `다음 시험 — {COUNTER_SUMMARY}`
* 버튼: 기록을 이어간다

### DeceptionPanel (역기만 결과)

출처: `src/components/ui/DeceptionPanel.tsx`

* 제목(성공): 기록이 어긋났다 / (실패): 기록대로였다
* 판정 문구(성공): 기록자를 속였다 / (실패): 기록자에게 읽혔다
* 항목: 예측된 방식 / 실제 전투 방식 / 보상(체력 +N)
* 버튼: 마지막 시험으로

### ResultPanel (런 결과)

출처: `src/components/ui/ResultPanel.tsx`

* 패널 제목: 「남겨진 기록」
* 판정: 이름을 남겼다 / 기록이 여기서 끊겼다
* 항목: 생존 시간 / 마지막 전투 방식 / 기록자를 속였는가(속였다/읽혔다/판단되지 않음)
* 섹션: 방마다 남긴 기록 / 마지막 시험의 패턴
* 버튼: 다시 기록한다

### UpgradePanel (강화 선택)

출처: `src/components/ui/UpgradePanel.tsx`

* 패널 제목(일반): 「이번 기록에 남길 것」
* 패널 제목(마지막): 「마지막으로 남길 것」

### ShopPanel (그림자 상인)

출처: `src/components/ui/ShopPanel.tsx`

* 패널 제목: 「그림자 상인」
* 잔액 라벨: 그림자 조각
* 매물 없을 때: 더 남은 것은 없다. 네가 모두 가져갔군.
* 버튼: 거래를 마친다

### EngravePanel (기록 제단)

출처: `src/components/ui/EngravePanel.tsx`

* 패널 제목: 「기록 제단」
* 버튼: 제단에서 물러난다

### StatusPanel (상태창)

출처: `src/components/ui/StatusPanel.tsx`

* 패널 제목: 「남아 있는 것」
* 섹션: 스킬 / 아티팩트
* 태그: 스킬
* 빈 상태: 아직 남겨진 스킬이나 아티팩트가 없습니다. / 슬롯을 선택하면 자세한 내용을 확인할 수 있습니다.
* 하단 힌트: E — 닫기

### TitleScreen (시작 화면)

출처: `src/components/ui/TitleScreen.tsx`

* 메뉴: 새 기록 / 이어서 기록하기(비활성) / 설정

### PauseMenu (일시정지)

출처: `src/components/ui/PauseMenu.tsx`

* 제목: 기록 일시 정지
* 메뉴: 계속하기 / 설정 / 기록 저장(비활성) / 이번 기록 포기 / 나가기
* 하단 힌트: ESC — 돌아가기

### SettingsPanel (설정)

출처: `src/components/ui/SettingsPanel.tsx`

* 헤더: 설정
* 섹션: 사운드 / 조작
* 사운드 항목: 전체 음량 / 배경음악 / 효과음
* 사운드 안내: 효과음 설정은 현재 메뉴와 전투 효과음에 적용됩니다.
* 음원 출처 고지: 배경음악은 Suno로 생성했습니다. 효과음은 Pixabay 음원입니다.
  — Suno 무료 플랜 약관이 요구하는 표기다. 임의로 지우면 라이선스 조건이 깨진다(`CREDITS.md` 참조).
* 조작 안내: 변경할 키를 선택한 뒤 새 키를 입력하세요. Esc를 누르면 취소됩니다. 이미 사용 중인 키를 선택하면 두 동작의 키가 서로 바뀝니다. 디버그 키(F1·F2)는 변경할 수 없습니다.
* 버튼: 기본값으로 되돌리기
* 키 입력 대기 표시: 새 키 입력…

#### 조작 동작 라벨 (`ACTION_LABELS`)

왼쪽 이동 / 오른쪽 이동 / 점프 / 대시 / 공격 / 무기 전환 / 패링 / 검기 / 검극 / 검무 / 상호작용 / 확인 / 디버그 패널 / 방 건너뛰기

### FirstVisitPrompt (첫 방문 안내)

출처: `src/components/ui/FirstVisitPrompt.tsx`

* 라벨: NOTICE
* 본문: 처음 기록을 시작합니다. / 원활한 플레이를 위해 아래 버튼을 눌러 오디오와 입력을 활성화해 주세요.
* 버튼: 기록 시작

### 사망/포기 결과창 (RespawnScreen)

출처: `src/components/HUDOverlay.tsx`

* 제목: 기록이 끊겼다
* 항목: 생존 시간 / 처치한 적
* 안내: ENTER — 다시 눈을 뜬다

---

## 9. 상호작용 프롬프트 (전투 씬 내 키캡 안내)

출처: `src/game/scenes/CombatScene.ts` — `buildInteractPrompt`

* 기본값: 문 열기
* 방랑자 NPC: 말을 건다
* 그림자 상인: 거래한다
* 기록 제단(각인): 기록을 새긴다

---

## 10. 로딩 화면

출처: `src/components/ui/LoadingScreen.tsx`

* 캡션: RECORDING
* 방 전환 시 부가 문구(verdict): 직전 분석의 `STYLE_TITLE` 값 사용
  예: `"거리를 지키는 자"`

추가 선택 문구:

```text
READING YOUR RECORD...
```

또는 한글 중심으로 가고 싶다면:

```text
기록을 읽는 중…
```

전체 UI가 한글 중심이라면 **`기록을 읽는 중…`을 추천**한다.

---

## 11. 오류 메시지

출처: `src/game/data/rooms.ts`

* `존재하지 않는 시험 구역입니다: {id}`

개발용 오류임을 조금 더 명확히 하고 싶다면:

* `[Room Error] 존재하지 않는 시험 구역: {id}`

---

## 부록 — 출처 파일 목록

* `src/game/data/directorRules.ts`
* `src/game/data/upgrades.ts`
* `src/game/data/engravings.ts`
* `src/game/data/npcEvents.ts`
* `src/game/data/shop.ts`
* `src/game/data/rooms.ts`
* `src/components/ui/AnalysisPanel.tsx`
* `src/components/ui/DeceptionPanel.tsx`
* `src/components/ui/ResultPanel.tsx`
* `src/components/ui/UpgradePanel.tsx`
* `src/components/ui/ShopPanel.tsx`
* `src/components/ui/EngravePanel.tsx`
* `src/components/ui/StatusPanel.tsx`
* `src/components/ui/TitleScreen.tsx`
* `src/components/ui/PauseMenu.tsx`
* `src/components/ui/SettingsPanel.tsx`
* `src/components/ui/FirstVisitPrompt.tsx`
* `src/components/ui/PrologueText.tsx`
* `src/components/ui/DialogueBox.tsx`
* `src/components/ui/LoadingScreen.tsx`
* `src/components/HUDOverlay.tsx`
* `src/game/scenes/CombatScene.ts`
