/**
 * 견제형. 근거리 플레이를 견제한다. (MVP_PLAN §2)
 * 전투 담당(팀원) 영역.
 *
 * 설계 조건:
 * - 일정 거리를 유지하며 투사체 발사
 * - 벽에 몰리면 취약
 * - 투사체는 점프나 대시로 회피 가능해야 한다 (하드 카운터 금지, DEC-004)
 */

import { BaseEnemy, type EnemyDeps } from "./BaseEnemy";

export class RangedEnemy extends BaseEnemy {
  constructor(deps: EnemyDeps) {
    super("RANGED", deps);
  }

  spawn(_x: number, _y: number): void {
    // 팀원 담당: 스프라이트 생성, 물리 바디 설정
  }

  update(_time: number, _deltaMs: number): void {
    // 팀원 담당: 거리 유지, 예고 후 투사체 발사, 벽 몰림 처리
  }
}
