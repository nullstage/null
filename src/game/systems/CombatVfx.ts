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
    /** 짧을수록 날카롭다. 길게 남으면 휘두른 것이 아니라 걸어둔 것처럼 보인다. */
    lifeMs: 120,
    /** 안쪽 밝은 심 + 바깥 옅은 획. 두 겹이되 심이 훨씬 얇아야 가늘게 보인다. */
    core: 0xfff2f3,
    body: 0xe0454e,
    /** 획의 굵기. 호가 커진 만큼 같이 굵어야 가늘어 보이지 않는다. */
    outerWidth: 8,
    innerWidth: 3,
    /** 호를 몇 점으로 찍을지. 점 크기보다 촘촘해야 선으로 이어진다. */
    segments: 64,
    /**
     * 사거리에 곱해 호의 반지름을 정한다.
     * 1을 넘기면 그림이 판정 범위 밖까지 뻗어, 닿아 보이는데 안 맞는 일이 생긴다.
     */
    radiusScale: 0.95,
  },
  beam: {
    lifeMs: 100,
    /** 총알은 가늘어야 빠르게 보인다. 굵으면 광선이 되고 속도가 죽는다. */
    thickness: 2,
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
    /** 가로로 길고 세로로 얇아야 지나간 자국으로 읽힌다. 세로가 길면 빗살처럼 보인다. */
    length: 84,
    segments: 6,
    /** 총알 머리의 두께. 여기서 뒤로 갈수록 얇아진다. 굵으면 총알이 아니라 광선이 된다. */
    headHeight: 5,
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
  /**
   * 적이 죽는 순간.
   *
   * 맞을 때와 죽을 때가 같은 연출이면 마지막 한 대가 언제 들어갔는지 알 수 없다.
   * 파편을 두 배로 뿌리고, 바깥으로 퍼지는 도트 링을 하나 더 얹어 확실히 구분한다.
   */
  death: {
    shards: 16,
    lifeMs: 380,
    speed: { min: 180, max: 420 },
    ring: { points: 22, radius: 14, growTo: 3.4, lifeMs: 300, dot: 3 },
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
 * 콤보 단계별 베는 각도.
 *
 * 0도가 정면, 음수가 위, 양수가 아래다. 위아래로 크게 휘두르면 우산처럼 보여 둔탁하다.
 * 대각선으로 짧게 지나가야 날카롭게 읽힌다.
 */
const SLASH_SWEEPS = [
  /** 1타 — 뒤 위에서 앞 아래로 크게 내려긋는다. */
  { from: -130, to: 18, scale: 1 },
  /** 2타 — 앞 아래에서 뒤 위로 올려 벤다. 1타의 반대 방향이라 연타가 눈에 띈다. */
  { from: 100, to: -40, scale: 1 },
  /** 3타 — 같은 대각선을 더 길고 크게 가로지른다. */
  { from: -150, to: 46, scale: 1.25 },
] as const;

/**
 * 검 궤적.
 *
 * 한 획으로 지나간 곡선을 그린다. 도트를 한 칸씩 찍어 계단으로 만들면
 * 획이 굵어지고 뭉쳐 보여, 베었다기보다 뭔가를 놓아둔 것처럼 둔탁해진다.
 *
 * 바깥의 옅고 조금 굵은 획과 안쪽의 밝고 아주 얇은 심, 두 겹만 쓴다.
 *
 * @param step 콤보 단계(1~3). 단계마다 베는 방향이 달라야 연타가 읽힌다.
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
  const sweep = SLASH_SWEEPS[Math.min(Math.max(step, 1), SLASH_SWEEPS.length) - 1];
  const radius = reach * slash.radiusScale * sweep.scale;

  const graphics = scene.add.graphics();
  graphics.setDepth(VFX.depth);

  /**
   * 호를 아주 작은 점으로 촘촘히 찍는다.
   *
   * `lineStyle`+`strokePoints`가 더 자연스러워 보이지만 화면에 나오지 않았고,
   * `fillRect`는 확실히 그려진다. 점을 두께보다 훨씬 촘촘히 찍으면 결국 같은 선이 된다.
   *
   * 점 크기가 곧 획의 굵기다. 크게 찍으면 예전처럼 뭉쳐서 둔탁해진다.
   */
  const stamp = (size: number, color: number, alpha: number) => {
    graphics.fillStyle(color, alpha);
    for (let i = 0; i <= slash.segments; i += 1) {
      const angle = Phaser.Math.DegToRad(
        Phaser.Math.Linear(sweep.from, sweep.to, i / slash.segments),
      );
      // 양 끝이 가늘어야 지나간 획으로 보인다. 가운데가 가장 굵다.
      const taper = 0.35 + 0.65 * Math.sin((i / slash.segments) * Math.PI);
      const width = size * taper;
      graphics.fillRect(
        x + facing * Math.cos(angle) * radius - width / 2,
        y + Math.sin(angle) * radius - width / 2,
        width,
        width,
      );
    }
  };

  stamp(slash.outerWidth, slash.body, 0.45);
  stamp(slash.innerWidth, slash.core, 1);

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

  const segmentWidth = tail.length / tail.segments;

  for (let i = 0; i < tail.segments; i += 1) {
    const t = i / tail.segments;
    // 뒤로 갈수록 얇아지고 옅어진다. 두 가지가 같이 줄어야 뾰족해 보인다.
    // 격자에 반올림하지 않는다. 반올림하면 계단이 생겨 가는 꼬리가 굵어 보인다.
    const height = tail.headHeight * (1 - t);
    const left = -facing * (t * tail.length) - (facing > 0 ? segmentWidth : 0);

    // height가 이미 전체 두께다. 위아래로 한 번 더 늘리면 꼬리가 아니라 세로 빗살이 된다.
    graphics.fillStyle(tail.glow, 0.5 * (1 - t));
    graphics.fillRect(left, -height / 2, segmentWidth, height);
  }

  // 총알 머리. 가장 밝은 한 점이 있어야 탄이 어디쯤인지 읽힌다.
  graphics.fillStyle(tail.core, 1);
  graphics.fillRect(-facing * 2, -tail.headHeight / 2, 6, tail.headHeight);

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
 * 적이 쓰러지는 순간의 연출.
 *
 * 사라지는 트윈만으로는 "죽었다"가 아니라 "없어졌다"로 보인다.
 * 퍼지는 링이 있어야 그 자리에서 무언가 터졌다는 인상이 남는다.
 *
 * @param color 그 적의 실루엣 색. 누가 죽었는지 색으로 구분된다.
 */
export const deathBurst = (scene: Phaser.Scene, x: number, y: number, color: number): void => {
  const { death } = VFX;

  for (let i = 0; i < death.shards; i += 1) {
    const shard = scene.add.rectangle(x, y, PIXEL, PIXEL, color);
    shard.setDepth(VFX.depth);
    shard.setBlendMode(Phaser.BlendModes.ADD);

    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const speed = Phaser.Math.Between(death.speed.min, death.speed.max);
    const travel = death.lifeMs / 1000;

    scene.tweens.add({
      targets: shard,
      x: x + Math.cos(angle) * speed * travel,
      y: y + Math.sin(angle) * speed * travel + 30,
      alpha: 0,
      duration: death.lifeMs,
      ease: "power2.out",
      onComplete: () => shard.destroy(),
    });
  }

  // 링은 점을 원형으로 찍은 뒤 통째로 키운다. 선으로 그리면 커질 때 두께까지 같이 굵어진다.
  const ring = scene.add.graphics({ x, y });
  ring.setDepth(VFX.depth);
  ring.setBlendMode(Phaser.BlendModes.ADD);
  ring.fillStyle(color, 1);
  for (let i = 0; i < death.ring.points; i += 1) {
    const angle = (i / death.ring.points) * Math.PI * 2;
    ring.fillRect(
      Math.cos(angle) * death.ring.radius - death.ring.dot / 2,
      Math.sin(angle) * death.ring.radius - death.ring.dot / 2,
      death.ring.dot,
      death.ring.dot,
    );
  }

  scene.tweens.add({
    targets: ring,
    scale: death.ring.growTo,
    alpha: 0,
    duration: death.ring.lifeMs,
    ease: "power2.out",
    onComplete: () => ring.destroy(),
  });

  pulseHitFx(scene, 0.7);
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
