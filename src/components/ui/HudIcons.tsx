/**
 * HUD 전용 아이콘. 사용자가 제공한 픽셀아트 시트(근접·원거리·기동·생존·재장전·
 * 검기·검극·검무)를 8등분해 `public/assets/ui/skills/`에 개별 파일로 잘라 쓴다.
 *
 * 전부 이미지라 SVG의 currentColor 재염색은 못 받는다 — 강조색은 부모가
 * drop-shadow/border로만 준다(ModeEmblem·IconSlot 참고).
 */

import { assetPath } from "@/game/config/gameConfig";

/* eslint-disable @next/next/no-img-element */

/** 근접 모드 — 검. */
export const SwordIcon = () => <img src={assetPath("ui/skills/melee.png")} alt="" />;

/** 원거리 모드 — 총. */
export const GunIcon = () => <img src={assetPath("ui/skills/ranged.png")} alt="" />;

/** 그림자 조각. 제공받은 그림이라 다른 아이콘과 달리 currentColor를 안 탄다. */
export const ShardIcon = () => <img src={assetPath("ui/shard-icon.png")} alt="" />;

/** 재장전 — 도는 화살표. 회전 애니메이션은 부모가 건다. */
export const ReloadIcon = () => <img src={assetPath("ui/skills/reload.png")} alt="" />;

/** 검기(Q) — 날아가는 초승달 참격. */
export const WaveIcon = () => <img src={assetPath("ui/skills/wave.png")} alt="" />;

/** 검극(R) — 바닥에서 솟는 가시들. */
export const SpikeIcon = () => <img src={assetPath("ui/skills/spike.png")} alt="" />;

/** 체력 계열 아티팩트. */
export const HeartIcon = () => <img src={assetPath("ui/skills/health.png")} alt="" />;

/** 기동 계열 아티팩트 — 잔상이 남는 대시. */
export const BootIcon = () => <img src={assetPath("ui/skills/mobility.png")} alt="" />;

/** 검무(F) — 회전하는 칼바람. */
export const CycloneIcon = () => <img src={assetPath("ui/skills/cyclone.png")} alt="" />;

/** 관통탄(총 슬롯) — 단발 섬광. */
export const PierceIcon = () => <img src={assetPath("ui/skills/pierce.png")} alt="" />;

/** 총검돌격(총 슬롯) — 내지르는 참격. */
export const BayonetIcon = () => <img src={assetPath("ui/skills/bayonet.png")} alt="" />;

/** 확산탄(총 슬롯) — 부채꼴 탄막. */
export const SpreadIcon = () => <img src={assetPath("ui/skills/spread.png")} alt="" />;

/** 질주의 잔영(대쉬 슬롯). */
export const RushTrailIcon = () => <img src={assetPath("ui/skills/rush-trail.png")} alt="" />;

/** 심연의 도약(대쉬 슬롯) — 열리는 포탈. */
export const AbyssLeapIcon = () => <img src={assetPath("ui/skills/abyss-leap.png")} alt="" />;

/* eslint-enable @next/next/no-img-element */
