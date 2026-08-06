/**
 * 추격형. 원거리 플레이를 압박한다. (MVP_PLAN §2)
 * 전투 담당(팀원) 영역.
 *
 * 설계 조건:
 * - 플레이어에게 접근 후 근접 공격
 * - 돌진 전 예고 동작 필수 (`definition.telegraphMs`)
 * - 근거리 공격에 경직되기 쉬움
 */

import { BaseEnemy, type EnemyDeps } from "./BaseEnemy";

export class ChaserEnemy extends BaseEnemy {
  constructor(deps: EnemyDeps) {
    super("CHASER", deps);
  }

  spawn(_x: number, _y: number): void {
    // 팀원 담당: 스프라이트 생성, 물리 바디 설정
  }

  update(_time: number, _deltaMs: number): void {
    // 팀원 담당: 플레이어 추격, 예고 후 돌진, 근접 공격, 경직 처리
  }
}
