/**
 * 전투 연출.
 *
 * 타격감은 피해 숫자가 아니라 "친 순간 화면이 반응했는가"에서 온다.
 * 여기 모인 네 가지가 그 반응을 만든다.
 *
 *   1. 슬래시 아크 — 무엇을 얼마나 넓게 베었는지
 *   2. 총 궤적    — 어디로 쐈는지
 *   3. 파편       — 맞았다는 확인
 *   4. 히트스톱 + 화면 셰이더 — 순간의 무게
 *
 * 그림은 전부 코드로 그린다. 에셋이 없기도 하고, 도트 격자에 맞춰 각지게 찍어야
 * 스프라이트와 톤이 맞기 때문이다. (OQ-024)
 *
 * 수치는 이 파일 안 `VFX`에 모은다. 확정되면 gameBalance로 옮긴다. (OQ-007)
 */

import Phaser from "phaser";

/** 연출용 도트 한 칸. 이 배수로만 좌표를 찍어야 스프라이트 격자와 어긋나지 않는다. */
const PIXEL = 4;

const VFX = {
  slash: {
    /** 도트를 몇 칸 찍어 호를 만들지. 늘리면 선이 촘촘해지고 무거워진다. */
    steps: 16,
    lifeMs: 150,
    /** 안쪽 밝은 심 + 바깥 붉은 몸통. 두 겹이어야 도트가 살아 있으면서도 진하다. */
    core: 0xffe3e6,
    body: 0xd2313a,
    thickness: PIXEL * 2,
  },
  beam: {
    lifeMs: 110,
    thickness: PIXEL,
    core: 0xfff3f4,
    glow: 0xff6b6b,
  },
  /**
   * 총알 꼬리.
   *
   * 옆 프로젝트(kracker)의 삼각 테일을 참고했다. 다만 그쪽은 매끈한 삼각형이고
   * 여기는 도트 화면이라, 뒤로 갈수록 얇아지는 사각형을 계단처럼 쌓아 같은 인상을 만든다.
   * 총알이 수평으로만 날아가므로 모양이 변하지 않는다. 한 번 그려두고 위치만 옮긴다.
   */
  tail: {
    length: 60,
    segments: 8,
    headHeight: PIXEL * 3,
    core: 0xfff6f6,
    glow: 0xff5560,
  },
  burst: {
    count: 7,
    lifeMs: 260,
    speed: { min: 130, max: 300 },
    size: PIXEL,
    color: 0xff8a94,
  },
  hitStopMs: 45,
  depth: 40,
} as const;

/**
 * 피격 순간의 화면 셰이더.
 *
 * RGB를 가로로 어긋뜨리고 붉게 물들인 뒤 주사선을 얹는다.
 * 어긋나는 양을 픽셀 단위로 맞춰야 도트가 흐려지지 않는다.
 * `uIntensity`가 0이면 원본 그대로라, 평상시에도 붙여둔 채로 둘 수 있다.
 */
export class HitFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private intensity = 0;

  constructor(game: Phaser.Game) {
    super({
      game,
      name: "HitFx",
      fragShader: `
        precision mediump float;
        uniform sampler2D uMainSampler;
        uniform float uIntensity;
        uniform vec2 uSize;
        varying vec2 outTexCoord;

        void main() {
          vec2 uv = outTexCoord;
          float amt = uIntensity;
          vec4 base = texture2D(uMainSampler, uv);

          // 도트 한 칸 단위로만 어긋뜨린다. 소수 픽셀로 밀면 경계가 뭉개진다.
          float shift = floor(amt * 5.0) * 2.0 / uSize.x;
          float r = texture2D(uMainSampler, uv + vec2(shift, 0.0)).r;
          float b = texture2D(uMainSampler, uv - vec2(shift, 0.0)).b;
          vec3 col = vec3(r, base.g, b);

          // 붉은 물듦. 검은 배경에서도 타격이 보이도록 더한다.
          col += vec3(0.42, 0.04, 0.07) * amt;

          // 한 줄 걸러 어둡게. 브라운관처럼 보이게 하는 정도로만 넣는다.
          float line = step(0.5, fract(uv.y * uSize.y * 0.5));
          col *= 1.0 - amt * 0.22 * line;

          gl_FragColor = vec4(col, base.a);
        }
      `,
    });
  }

  onPreRender(): void {
    this.set1f("uIntensity", this.intensity);
    this.set2f("uSize", this.renderer.width, this.renderer.height);
  }

  /** 0~1. 호출한 쪽이 트윈으로 0까지 떨어뜨린다. */
  setIntensity(value: number): void {
    this.intensity = value;
  }
}

/** 카메라에 셰이더를 붙인다. 씬 생성 때 한 번 부른다. */
export const attachHitFx = (scene: Phaser.Scene): void => {
  if (scene.game.renderer.type !== Phaser.WEBGL) return;
  scene.cameras.main.setPostPipeline(HitFxPipeline);
};

/**
 * 셰이더를 한 번 번쩍인다.
 *
 * Canvas 렌더러에는 포스트 파이프라인이 없다. 없으면 조용히 넘어간다.
 * 연출이 빠질 뿐 전투는 그대로 돌아가야 한다.
 */
export const pulseHitFx = (scene: Phaser.Scene, strength = 0.55): void => {
  if (scene.game.renderer.type !== Phaser.WEBGL) return;

  const found = scene.cameras.main.getPostPipeline(HitFxPipeline);
  const target = (Array.isArray(found) ? found[0] : found) as HitFxPipeline | undefined;
  if (!target) return;

  // 트윈은 객체의 속성만 굴릴 수 있다. 중간값을 담을 그릇을 하나 만든다.
  const carrier = { value: strength };
  target.setIntensity(strength);
  scene.tweens.add({
    targets: carrier,
    value: 0,
    duration: 170,
    ease: "power2.out",
    onUpdate: () => target.setIntensity(carrier.value),
    onComplete: () => target.setIntensity(0),
  });
};

/**
 * 검 궤적.
 *
 * 매끈한 곡선이 아니라 도트를 한 칸씩 찍어 계단으로 만든다.
 * 반원을 그대로 쓰면 우산처럼 보여서, 진행 방향으로 기울인 부채꼴을 쓴다.
 *
 * @param step 콤보 단계(1~3). 단계마다 베는 방향과 크기가 달라야 연타가 읽힌다.
 */
export const slashArc = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  facing: 1 | -1,
  reach: number,
  step: number,
): void => {
  const { slash } = VFX;

  // 1타는 위에서 아래로, 2타는 아래에서 위로, 3타는 크게 내려친다.
  const sweep =
    step === 2
      ? { from: 62, to: -74, scale: 1 }
      : step >= 3
        ? { from: -96, to: 74, scale: 1.25 }
        : { from: -58, to: 70, scale: 1 };

  const radius = reach * 0.95 * sweep.scale;
  const graphics = scene.add.graphics();
  graphics.setDepth(VFX.depth);

  for (let i = 0; i <= slash.steps; i += 1) {
    const t = i / slash.steps;
    const angle = Phaser.Math.DegToRad(Phaser.Math.Linear(sweep.from, sweep.to, t));

    // 양 끝이 가늘어야 휘두른 궤적으로 보인다. 가운데가 가장 두껍다.
    const taper = Math.sin(t * Math.PI);
    const thickness = Math.max(PIXEL, Math.round((slash.thickness * taper) / PIXEL) * PIXEL);

    // 도트 격자에 맞춰 반올림한다. 격자를 벗어나면 계단이 흐트러진다.
    const px = Math.round((x + facing * Math.cos(angle) * radius) / PIXEL) * PIXEL;
    const py = Math.round((y + Math.sin(angle) * radius) / PIXEL) * PIXEL;

    graphics.fillStyle(slash.body, 1);
    graphics.fillRect(px - thickness, py - thickness, thickness * 2, thickness * 2);
    graphics.fillStyle(slash.core, 1);
    graphics.fillRect(px - PIXEL / 2, py - PIXEL / 2, PIXEL, PIXEL);
  }

  graphics.setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    duration: slash.lifeMs,
    ease: "power2.in",
    onComplete: () => graphics.destroy(),
  });
};

/**
 * 총 궤적.
 *
 * 투사체가 날아가는 것과 별개로, 쏜 순간 총구에서 뻗는 얇은 직선을 한 번 남긴다.
 * 이게 없으면 어디로 쐈는지 투사체를 눈으로 좇아야만 알 수 있다.
 */
export const beamLine = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  facing: 1 | -1,
  length: number,
): void => {
  const { beam } = VFX;
  const graphics = scene.add.graphics();
  graphics.setDepth(VFX.depth);

  const top = Math.round(y / PIXEL) * PIXEL;
  const left = facing > 0 ? Math.round(x / PIXEL) * PIXEL : Math.round((x - length) / PIXEL) * PIXEL;

  // 바깥 옅은 선 + 안쪽 흰 심. 한 겹이면 너무 가늘어 안 보인다.
  graphics.fillStyle(beam.glow, 0.5);
  graphics.fillRect(left, top - beam.thickness, length, beam.thickness * 2);
  graphics.fillStyle(beam.core, 1);
  graphics.fillRect(left, top - beam.thickness / 2, length, beam.thickness);

  graphics.setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    duration: beam.lifeMs,
    ease: "power2.in",
    onComplete: () => graphics.destroy(),
  });
};

/**
 * 총알 꼬리를 만든다.
 *
 * 총알 자체는 작은 점이라 너무 빠르면 눈으로 좇을 수 없다.
 * 뒤로 늘어지는 꼬리가 있어야 어디서 어디로 지나갔는지가 남는다.
 *
 * 반환한 Graphics는 부른 쪽이 매 프레임 `setPosition`으로 따라 붙이고,
 * 총알이 사라질 때 함께 없애야 한다. 총알에 자식으로 붙이면 물리 바디가 함께 커진다.
 */
export const createBulletTrail = (
  scene: Phaser.Scene,
  facing: 1 | -1,
): Phaser.GameObjects.Graphics => {
  const { tail } = VFX;
  const graphics = scene.add.graphics();
  graphics.setDepth(VFX.depth - 1);
  graphics.setBlendMode(Phaser.BlendModes.ADD);

  const segmentWidth = Math.ceil(tail.length / tail.segments / PIXEL) * PIXEL;

  for (let i = 0; i < tail.segments; i += 1) {
    const t = i / tail.segments;
    // 뒤로 갈수록 얇아지고 옅어진다. 두 가지가 같이 줄어야 뾰족해 보인다.
    const height = Math.round((tail.headHeight * (1 - t)) / PIXEL) * PIXEL;
    if (height <= 0) break;

    const left = -facing * (t * tail.length) - (facing > 0 ? segmentWidth : 0);

    graphics.fillStyle(tail.glow, 0.5 * (1 - t));
    graphics.fillRect(left, -height, segmentWidth, height * 2);
    graphics.fillStyle(tail.core, 0.85 * (1 - t));
    graphics.fillRect(left, -height / 2, segmentWidth, height);
  }

  // 총알 머리. 가장 밝은 한 칸이 있어야 탄이 어디쯤인지 읽힌다.
  graphics.fillStyle(tail.core, 1);
  graphics.fillRect(-PIXEL, -PIXEL, PIXEL * 2, PIXEL * 2);

  return graphics;
};

/** 적중 지점에서 튀는 도트 파편. 사각형만 써야 스프라이트와 같은 결로 보인다. */
export const hitBurst = (scene: Phaser.Scene, x: number, y: number): void => {
  const { burst } = VFX;

  for (let i = 0; i < burst.count; i += 1) {
    const shard = scene.add.rectangle(x, y, burst.size, burst.size, burst.color);
    shard.setDepth(VFX.depth);
    shard.setBlendMode(Phaser.BlendModes.ADD);

    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const speed = Phaser.Math.Between(burst.speed.min, burst.speed.max);

    scene.tweens.add({
      targets: shard,
      x: x + Math.cos(angle) * speed * (burst.lifeMs / 1000),
      // 위로 튄 뒤 떨어지는 것처럼 보이도록 세로에만 낙차를 더한다.
      y: y + Math.sin(angle) * speed * (burst.lifeMs / 1000) + 24,
      alpha: 0,
      duration: burst.lifeMs,
      ease: "power2.out",
      onComplete: () => shard.destroy(),
    });
  }
};

/**
 * 히트스톱.
 *
 * 맞은 순간 물리를 아주 짧게 멈춘다. 이게 있으면 같은 피해량도 훨씬 무겁게 느껴진다.
 * 애니메이션과 트윈은 계속 돌게 둔다. 전부 멈추면 화면이 얼어붙은 것처럼 보인다.
 */
export const hitStop = (scene: Phaser.Scene, durationMs = VFX.hitStopMs): void => {
  const world = scene.physics.world;
  if (world.isPaused) return;

  world.pause();
  scene.time.delayedCall(durationMs, () => world.resume());
};
