/**
 * 기동 카운터형. 반복적인 이동 습관을 카운터한다. (MVP_PLAN §2)
 * 전투 담당(팀원) 영역.
 *
 * 설계 조건:
 * - 플레이어의 이동 경로에 지연 폭발 장판을 배치한다
 * - 장판은 즉시 폭발하지 않고 범위를 사전에 표시한다 (`HAZARD.telegraphMs`)
 * - 대시 사용 자체를 처벌하지 않는다. "대시하면 즉시 피격"은 금지다. (DEC-004)
 *
 * OQ-006 미결정 — 일정이 밀리면 이 적과 MOBILE 분류를 함께 삭제한다.
 */

import { BaseEnemy, type EnemyDeps } from "./BaseEnemy";

export class MobilityCounterEnemy extends BaseEnemy {
  constructor(deps: EnemyDeps) {
    super("MOBILITY_COUNTER", deps);
  }

  spawn(_x: number, _y: number): void {
    // 팀원 담당: 스프라이트 생성, 물리 바디 설정
  }

  update(_time: number, _deltaMs: number): void {
    // 팀원 담당: 플레이어 이동 경로 예측, 장판 예고, 지연 폭발
  }
}
