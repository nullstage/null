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

/** 두 색을 t(0~1)만큼 섞는다. 연사 단계별로 크기뿐 아니라 색까지 바뀌어야 "다른 발"로 읽힌다. */
const lerpColor = (a: number, b: number, t: number): number =>
  Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.ValueToColor(a),
    Phaser.Display.Color.ValueToColor(b),
    100,
    Math.round(Phaser.Math.Clamp(t, 0, 1) * 100),
  ).color;

const VFX = {
  slash: {
    /** 짧을수록 날카롭다. 길게 남으면 휘두른 것이 아니라 걸어둔 것처럼 보인다. */
    lifeMs: 160,
    /** 안쪽 밝은 심 + 바깥 옅은 획. 두 겹이되 심이 훨씬 얇아야 가늘게 보인다. */
    core: 0xfff2f3,
    body: 0xe0454e,
    /** 획의 굵기. 호가 커진 만큼 같이 굵어야 가늘어 보이지 않는다. */
    outerWidth: 8,
    innerWidth: 3,
    /**
     * (실험) 초승달 모양 채우기의 두께.
     *
     * 얇은 선이 아니라 면으로 채운 두꺼운 띠를 그린다 — 스컬류 게임의 큰 슬래시 이펙트를
     * 참고했다. 가운데(스윙 정점)에서 가장 두껍고 양 끝에서 점으로 모인다.
     */
    crescentThickness: 46,
    /**
     * 두께가 스윙 진행률(0~1)의 몇 제곱에 반응할지.
     *
     * 1이면 사인 곡선 그대로라 초반부터(t=0.1에서 벌써 최대 두께의 35%) 두꺼워져
     * 칼끝이 아니라 뭉툭한 덩어리가 바로 나온 것처럼 보인다. 지수를 올리면
     * 초반엔 얇게 오래 버티다가 스윙 중후반(t≈0.7 부근)에서야 가장 두꺼워진다 —
     * 가느다란 칼끝이 먼저 지나가고 그 뒤로 몸통이 굵게 따라붙는 모양이다.
     */
    taperPower: 2.2,
    /** 호를 몇 점으로 찍을지. 점 크기보다 촘촘해야 선으로 이어진다. */
    segments: 64,
    /**
     * 사거리에 곱해 호의 반지름을 정한다.
     * 1을 넘기면 그림이 판정 범위 밖까지 뻗어, 닿아 보이는데 안 맞는 일이 생긴다.
     */
    radiusScale: 0.95,
    /**
     * 세로를 이 비율로 눌러 타원으로 만든다.
     *
     * 정원으로 그리면 화면과 평행한 고리라 평면으로 보인다.
     * 납작하게 눌러야 비스듬히 누운 원처럼 읽혀 깊이가 생긴다.
     */
    flatten: 0.52,
    /**
     * 눌린 타원을 이만큼 기울인다(도). 화면 y는 아래로 증가한다.
     *
     * 양수면 1타 궤적이 왼쪽 위(-21, -45)에서 오른쪽 아래(45, 42)로 내려간다.
     * 부호를 뒤집으면 올려 베는 모양이 되므로 그대로 두어야 한다.
     */
    tiltDeg: 34,
    /**
     * 검을 벼린 뒤의 궤적.
     *
     * 수치만 오르면 무엇이 좋아졌는지 화면에서 알 수 없다.
     * 붉은 기를 걷고 흰빛으로 바꿔 손에 든 것이 달라졌음을 한눈에 보이게 한다.
     */
    reforged: {
      core: 0xffffff,
      body: 0xffd8dc,
      outerWidth: 11,
      innerWidth: 4,
      crescentThickness: 58,
    },
  },
  /**
   * (실험) 레이저사이트 조준선.
   *
   * "찌잉(그어짐) → 팡(총성)" 두 박자로 읽히게 한다. 총구에서 순식간에 벽까지
   * 얇고 흐릿한 선이 그어진 뒤(찌잉), 총알이 그 위를 훑고 지나가며 총성이 터진다(팡).
   * 실제 목표 지점을 조준하지 않고 벽까지 긋는다 — 정확한 사거리 판정이 아니라
   * "이 방향으로 쐈다"는 신호만 필요하기 때문이다.
   */
  beam: {
    /** 총구에서 벽까지 긋는 데 걸리는 시간. 이게 "찌잉" 구간이다. */
    revealMs: 45,
    /**
     * 다 그어진 뒤 실제로 총알이 나가기까지 버티는 시간.
     * 이 동안 조준선이 옅은 상태에서 점점 밝아진다 — "곧 쏜다"는 예고다.
     * 총알 발사 자체가 이 시간만큼 늦춰진다(`BEAM_WINDUP_MS`로 노출).
     */
    holdMs: 140,
    /** 발사와 함께 옅어지는 데 걸리는 시간. */
    fadeMs: 90,
    /** 얇아야 레이저사이트로 보인다. 굵으면 총 궤적이 아니라 광선검이 된다. */
    thickness: 1,
    /** 흐릿하게 두르는 겹의 굵기 배수. */
    glowScale: 3.5,
    core: 0xfff3f4,
    glow: 0xff6b6b,
    /** 다 밝아졌을 때(발사 직전)의 세기. 처음부터 이만큼 보이면 조준선이 아니라 광선이 된다. */
    coreAlpha: 0.42,
    glowAlpha: 0.12,
    /** 막 그어진 순간의 세기. coreAlpha/glowAlpha에 곱해진다 — 낮을수록 "처음엔 거의 안 보임". */
    startAlphaScale: 0.3,
  },
  /** 발사 순간 총구에서 터지는 짧은 섬광. beam의 "팡"에 해당한다. */
  muzzle: {
    lifeMs: 80,
    core: 0xffffff,
    spark: 0xffd9a8,
    coreRadius: 5,
    /** 총구에서 뻗는 짧은 불꽃 가닥 수. */
    rays: 4,
    rayLength: 16,
  },
  /** 총알이 맞았을 때. 검보다 가볍고 빨라야 한다 — 무거운 타격이 아니라 스치는 느낌이다. */
  rangedSpark: {
    count: 5,
    lifeMs: 130,
    speed: { min: 220, max: 380 },
    length: 10,
    color: 0xffd9a8,
  },
  /**
   * 총알 꼬리.
   *
   * 옆 프로젝트(kracker)의 삼각 테일을 참고했다. 다만 그쪽은 매끈한 삼각형이고
   * 여기는 도트 화면이라, 뒤로 갈수록 얇아지는 사각형을 계단처럼 쌓아 같은 인상을 만든다.
   * 총알이 수평으로만 날아가므로 모양이 변하지 않는다. 한 번 그려두고 위치만 옮긴다.
   */
  tail: {
    /**
     * 가로로 길고 세로로 얇아야 지나간 자국으로 읽힌다. 세로가 길면 빗살처럼 보인다.
     * 총구(몸 중심에서 facing*26px 앞)에서 뒤로 이 길이만큼 뻗는다 — 너무 길면
     * 쏘는 순간 꼬리 뒷부분이 캐릭터 몸 뒤로 삐져나와 보인다는 지적이 있어 줄였다.
     */
    length: 50,
    segments: 6,
    /** 총알 머리의 두께. 여기서 뒤로 갈수록 얇아진다. 굵으면 총알이 아니라 광선이 된다. */
    headHeight: 5,
    core: 0xfff6f6,
    glow: 0xff5560,
    /** 총열을 개조한 뒤. 꼬리가 길고 두꺼워져 탄이 무거워진 것이 보인다. */
    reforged: { length: 70, headHeight: 8, core: 0xffffff, glow: 0xffb9c2 },
  },
  burst: {
    count: 20,
    lifeMs: 260,
    speed: { min: 180, max: 520 },
    size: PIXEL,
    color: 0xff8a94,
    /** 파편보다 먼저, 아주 짧게 터지는 작은 충격 링. 순간의 무게를 더한다. */
    ring: { points: 14, radius: 4, growTo: 3.2, lifeMs: 140 },
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
  /**
   * 발밑 흙먼지 — 뛰어오를 때와 착지할 때.
   * 전투 이펙트와 달리 가산 블렌드를 쓰지 않는다. 빛나면 흙이 아니라 불꽃처럼 보인다.
   */
  dust: {
    color: 0xa89478,
    alpha: 0.55,
    size: PIXEL,
    /** 밀어내는 정도만 다르다 — 착지가 더 세게, 더 많이 튄다. */
    jump: { count: 5, speed: { min: 50, max: 110 }, lifeMs: 200 },
    land: { count: 9, speed: { min: 90, max: 200 }, lifeMs: 260 },
    /** 달릴 때 발밑에 살짝 — 착지·점프보다 훨씬 여리다. */
    run: { count: 1, speed: { min: 15, max: 35 }, lifeMs: 180 },
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
 * (실험) 상시 배경 조명 셰이더.
 *
 * 화면 전체를 붉은 그림자 톤으로 가라앉히고, 플레이어가 있는 자리만 원형으로 밝게
 * 남긴다 — "캐릭터에게 시선이 모이는" 명암을 만든다. `HitFx`와 달리 순간 번쩍이는
 * 게 아니라 방에 들어서는 동안 계속 켜져 있는 셰이더다.
 */
export class AmbientLightPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private centerX = 0.5;
  private centerY = 0.5;
  private strength = 0;

  constructor(game: Phaser.Game) {
    super({
      game,
      name: "AmbientLight",
      fragShader: `
        precision mediump float;
        uniform sampler2D uMainSampler;
        uniform vec2 uSize;
        uniform vec2 uCenter;
        uniform float uStrength;
        varying vec2 outTexCoord;

        void main() {
          vec4 base = texture2D(uMainSampler, outTexCoord);

          // 화면 비율을 보정해야 밝은 자리가 타원이 아니라 원으로 보인다.
          float aspect = uSize.x / uSize.y;
          vec2 uv = vec2(outTexCoord.x * aspect, outTexCoord.y);
          vec2 center = vec2(uCenter.x * aspect, uCenter.y);
          float dist = distance(uv, center);

          // 0(중심, 밝음) ~ 1(바깥, 그림자). 캐릭터 반경 밖으로 부드럽게 퍼진다.
          float shadow = smoothstep(0.16, 0.62, dist) * uStrength;

          // 그림자는 검게 죽이지 않고 붉은 톤으로 가라앉힌다 — 완전한 검정은 안개처럼 보인다.
          vec3 shadowTone = base.rgb * vec3(0.42, 0.16, 0.18);
          vec3 col = mix(base.rgb, shadowTone, shadow);

          // 중심부는 옅은 붉은 빛을 더해 은은한 광원처럼 보이게 한다.
          col += vec3(0.10, 0.02, 0.03) * (1.0 - shadow) * uStrength;

          // 화면 가장자리 비네트. 캐릭터 조명과는 별개로 화면 자체의 네 귀퉁이를
          // 눌러 시선이 화면 중앙(캐릭터가 대체로 머무는 자리)에 머물게 한다.
          vec2 screenUv = outTexCoord - 0.5;
          float vignette = smoothstep(0.35, 0.85, length(screenUv));
          col *= 1.0 - vignette * 0.35 * uStrength;

          gl_FragColor = vec4(col, base.a);
        }
      `,
    });
  }

  onPreRender(): void {
    this.set2f("uSize", this.renderer.width, this.renderer.height);
    this.set2f("uCenter", this.centerX, this.centerY);
    this.set1f("uStrength", this.strength);
  }

  /** 밝은 중심을 화면 정규화 좌표(0~1)로 옮긴다. 카메라가 스크롤해도 매 프레임 다시 불러야 한다. */
  setCenter(x: number, y: number): void {
    this.centerX = x;
    this.centerY = y;
  }

  /** 0~1. 방 진입 시 트윈으로 서서히 올리면 화면이 갑자기 어두워지지 않는다. */
  setStrength(value: number): void {
    this.strength = value;
  }
}

/** 카메라에 상시 조명 셰이더를 붙인다. 씬 생성 때 한 번 부른다. */
export const attachAmbientLight = (scene: Phaser.Scene, strength = 0.75): void => {
  if (scene.game.renderer.type !== Phaser.WEBGL) return;
  scene.cameras.main.setPostPipeline(AmbientLightPipeline);
  const found = scene.cameras.main.getPostPipeline(AmbientLightPipeline);
  const pipeline = (Array.isArray(found) ? found[0] : found) as AmbientLightPipeline | undefined;
  pipeline?.setStrength(strength);
};

/**
 * 매 프레임 불러서 밝은 중심을 캐릭터 화면 위치로 옮긴다.
 * 월드 좌표에서 카메라 스크롤만큼 빼고 화면 크기로 나누면 정규화 좌표가 된다.
 */
export const updateAmbientLightCenter = (
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
): void => {
  if (scene.game.renderer.type !== Phaser.WEBGL) return;

  const found = scene.cameras.main.getPostPipeline(AmbientLightPipeline);
  const pipeline = (Array.isArray(found) ? found[0] : found) as AmbientLightPipeline | undefined;
  if (!pipeline) return;

  const camera = scene.cameras.main;
  // WebGL 프레임버퍼는 원점이 왼쪽 아래라 outTexCoord.y가 화면 기준과 뒤집혀 있다.
  // 정규화한 y를 1에서 빼야 화면에서 실제로 보이는 자리와 맞는다.
  pipeline.setCenter(
    (worldX - camera.scrollX) / camera.width,
    1 - (worldY - camera.scrollY) / camera.height,
  );
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
  /** 검을 벼렸는가. 색과 굵기가 바뀌어 강화가 화면에 드러난다. */
  reforged = false,
): void => {
  const { slash } = VFX;
  const look = reforged ? slash.reforged : slash;
  const sweep = SLASH_SWEEPS[Math.min(Math.max(step, 1), SLASH_SWEEPS.length) - 1];
  const radius = reach * slash.radiusScale * sweep.scale;

  const graphics = scene.add.graphics();
  graphics.setDepth(VFX.depth);
  // x·y에 facing을 따로따로(그것도 일관되지 않게) 곱하다가 왼쪽으로 벨 때
  // 궤적이 뒤집히지 않는 버그가 났다(사용자가 여러 번 확인). slashFlash와 같은 방식으로
  // 고친다 — 좌표는 항상 오른쪽 기준 고정값으로만 계산하고, 그래픽스 오브젝트 자체를
  // `setScale(facing, 1)`로 통째로 뒤집는다. 아래 좌표는 전부 이 오브젝트 기준 로컬 좌표다.
  graphics.setPosition(x, y);
  graphics.setScale(facing, 1);

  // 눌러서 기울인 타원. 정원은 화면과 평행한 고리라 깊이가 없고 일자로 보인다.
  const tilt = Phaser.Math.DegToRad(slash.tiltDeg);
  const tiltCos = Math.cos(tilt);
  const tiltSin = Math.sin(tilt);

  /**
   * 지금까지 실제로 그은 각도의 끝점. 처음엔 시작점(0)에서 멈춰 있다가
   * 아래 리빌 트윈이 `sweep.to`까지 밀어 올린다 — 이게 있어야 "찍힌 자국"이 아니라
   * "칼이 지나가며 긋는 궤적"으로 보인다.
   */
  let revealTo: number = sweep.from;

  /**
   * 타원+기울기 위의 한 점(그래픽스 로컬 좌표). 반지름을 바꿔 부를 수 있다 —
   * 초승달의 안쪽/바깥쪽 테두리를 같은 함수로 그리기 위해서다.
   * 도트 격자에 맞추지 않는다 — 매끈한 면이 목적이다.
   */
  const pointAt = (t: number, r: number) => {
    const angle = Phaser.Math.DegToRad(Phaser.Math.Linear(sweep.from, revealTo, t));
    const ex = Math.cos(angle) * r;
    const ey = Math.sin(angle) * r * slash.flatten;
    return {
      x: ex * tiltCos - ey * tiltSin,
      y: ex * tiltSin + ey * tiltCos,
    };
  };

  /**
   * (실험) 초승달 모양. 스컬류 게임의 큰 슬래시 이펙트를 참고했다.
   *
   * 얇은 선이 아니라 반지름이 살짝 다른 두 테두리(바깥·안쪽) 사이를 면으로 채운다.
   * `taperPower`로 두께 정점을 스윙 후반으로 밀어, 얇은 칼끝이 먼저 지나가고
   * 굵은 몸통이 뒤따르는 모양을 만든다. 양 끝은 아주 가느다랗게 남겨 완전히
   * 뾰족한 점이 되지 않게 한다(0이면 이음매가 튄다).
   */
  const taperHalf = (maxThickness: number, t: number) =>
    (maxThickness * (0.06 + 0.94 * Math.sin(Math.pow(t, slash.taperPower) * Math.PI))) / 2;

  /** 바깥 테두리만 따로 뽑는다. 날 선(칼날 반짝임)을 그 위에 얹기 위해서다. */
  const outerEdge = (maxThickness: number) => {
    const outer: { x: number; y: number }[] = [];
    for (let i = 0; i <= slash.segments; i += 1) {
      const t = i / slash.segments;
      outer.push(pointAt(t, radius + taperHalf(maxThickness, t)));
    }
    return outer;
  };

  const crescentPoints = (maxThickness: number) => {
    const outer = outerEdge(maxThickness);
    const inner: { x: number; y: number }[] = [];
    for (let i = 0; i <= slash.segments; i += 1) {
      const t = i / slash.segments;
      inner.push(pointAt(t, radius - taperHalf(maxThickness, t)));
    }
    return [...outer, ...inner.reverse()];
  };

  /** 같은 초승달을 여러 겹, 얇을수록 진하게 겹쳐서 부드러운 광채를 흉내 낸다. */
  const redraw = () => {
    graphics.clear();
    graphics.fillStyle(look.body, 0.16);
    graphics.fillPoints(crescentPoints(look.crescentThickness * 2.4), true);
    graphics.fillStyle(look.body, 0.32);
    graphics.fillPoints(crescentPoints(look.crescentThickness * 1.5), true);
    graphics.fillStyle(look.core, 0.55);
    graphics.fillPoints(crescentPoints(look.crescentThickness * 0.85), true);
    graphics.fillStyle(look.core, 0.9);
    graphics.fillPoints(crescentPoints(look.crescentThickness * 0.4), true);

    /**
     * 날 선. 면만 채우면 부드러운 덩어리로만 보여 무엇으로 베었는지 안 읽힌다.
     * 몸통보다 얇고 훨씬 밝은 테두리 하나를 바깥쪽 가장자리에 얹어야
     * 칼날이 지나간 자리라는 게 또렷해진다.
     */
    graphics.lineStyle(2, 0xffffff, 0.95);
    graphics.strokePoints(outerEdge(look.crescentThickness * 0.55), false);
  };

  graphics.setBlendMode(Phaser.BlendModes.ADD);
  redraw();

  /**
   * 칼이 실제로 지나가는 시간. 전체 수명(`slash.lifeMs`)의 앞부분만 쓰고,
   * 나머지는 다 그어진 자국이 옅어지는 잔상 구간이다.
   */
  const revealMs = Math.min(90, slash.lifeMs * 0.55);
  const carrier = { p: 0 };

  scene.tweens.add({
    targets: carrier,
    p: 1,
    duration: revealMs,
    ease: "power1.out",
    onUpdate: () => {
      revealTo = Phaser.Math.Linear(sweep.from, sweep.to, carrier.p);
      redraw();
    },
    onComplete: () => {
      // 다 그어진 순간, 칼날 가장자리를 따라 작은 불티가 튄다 — 면만 채워서는
      // 밋밋했던 부분을 스컬류 슬래시처럼 잔불이 흩날리는 느낌으로 채운다.
      const edge = outerEdge(look.crescentThickness * 0.55);
      const sparkPoints = [edge[Math.round(edge.length * 0.35)], edge[Math.round(edge.length * 0.65)]];
      for (const local of sparkPoints) {
        if (!local) continue;
        // graphics는 setScale(facing,1)로 뒤집혀 있다 — 로컬 좌표를 월드 좌표로 직접 환산한다.
        const worldX = x + facing * local.x;
        const worldY = y + local.y;
        for (let i = 0; i < 3; i += 1) {
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const dist = Phaser.Math.FloatBetween(10, 26);
          const spark = scene.add.circle(worldX, worldY, 1.4, look.core, 1);
          spark.setDepth(VFX.depth + 1);
          spark.setBlendMode(Phaser.BlendModes.ADD);
          scene.tweens.add({
            targets: spark,
            x: worldX + Math.cos(angle) * dist,
            y: worldY + Math.sin(angle) * dist,
            alpha: 0,
            duration: Phaser.Math.Between(120, 200),
            ease: "power2.out",
            onComplete: () => spark.destroy(),
          });
        }
      }

      scene.tweens.add({
        targets: graphics,
        alpha: 0,
        duration: Math.max(1, slash.lifeMs - revealMs),
        ease: "power2.in",
        onComplete: () => graphics.destroy(),
      });
    },
  });
};

/**
 * (실험) 발도(拔刀) 이펙트 — 검 1타 전용.
 *
 * 초승달 채우기(`slashArc`)와 달리 곧게 뻗는 한 줄기 섬광이다. 자라나는 리빌 없이
 * 한 번에 다 그어지고, 대시 잔상처럼 같은 선을 살짝씩 어긋나게 여러 겹 쌓아
 * "그은 자리에 잔상이 남는" 속도감을 낸다. 짧게 버티다 빠르게 사라진다 —
 * 든 자세를 오래 보여준 뒤(애니메이션 쪽에서 처리) 벤 순간은 최대한 짧아야 한다.
 */
export const slashFlash = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  facing: 1 | -1,
  reach: number,
  reforged = false,
): void => {
  const { slash } = VFX;
  const look = reforged ? slash.reforged : slash;

  // 부호를 직접 곱해 좌우를 뒤집는 방식(dx *= facing)에서 반복해서 버그가 났다
  // (사용자가 두 번 확인). 대신 `beamLine`과 똑같은 방식을 쓴다 — 좌표는 항상
  // "오른쪽으로 향하는" 고정값으로만 계산하고, 그래픽스 오브젝트 자체를
  // `setScale(facing, 1)`로 통째로 뒤집는다. Phaser의 스프라이트 좌우반전과 같은
  // 메커니즘이라(이미 총 조준선에서 검증됨) 부호 계산을 헷갈릴 여지가 없다.
  // "직선 일자로, 더 길게" 요청대로 세로 기울기는 작게, 가로는 더 길게 뻗는다.
  const dx = reach * 1.3;
  const dy = -10;

  // 총 조준선(beamLine)처럼 가늘고 흐릿하게, 순식간에 끝까지 그어지는 "칭" 한 번.
  // 몸통을 채우지 않는다 — 두꺼우면 광선검이 되고, 얇아야 검이 스친 자국으로 읽힌다.
  const draw = (graphics: Phaser.GameObjects.Graphics, t: number) => {
    graphics.clear();
    const ex = dx * t;
    const ey = dy * t;
    graphics.lineStyle(5, look.body, 0.16);
    graphics.lineBetween(0, 0, ex, ey);
    graphics.lineStyle(1.5, look.core, 0.75);
    graphics.lineBetween(0, 0, ex, ey);
  };

  const echoes = 2;
  for (let i = 0; i <= echoes; i += 1) {
    const isMain = i === echoes;
    const graphics = scene.add.graphics();
    graphics.setPosition(x, y);
    graphics.setScale(facing, 1);
    graphics.setDepth(VFX.depth);
    graphics.setBlendMode(Phaser.BlendModes.ADD);
    // 잔상일수록 시작점 쪽으로 당겨져 있어, 방금 지나간 자국처럼 겹쳐 보인다.
    graphics.setAlpha(isMain ? 1 : 0.35);

    const carrier = { t: 0 };
    scene.tweens.add({
      targets: carrier,
      t: 1,
      duration: 55,
      delay: i * 14,
      ease: "power1.out",
      onUpdate: () => draw(graphics, carrier.t),
      onComplete: () => {
        scene.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 70,
          ease: "power2.in",
          onComplete: () => graphics.destroy(),
        });
      },
    });
  }
};

/**
 * 총 궤적 — 레이저사이트 조준선.
 *
 * 투사체가 날아가는 것과 별개로, 쏜 순간 총구에서 사거리 끝(보통 벽)까지 뻗는
 * 얇고 흐릿한 선을 남긴다. 총알을 눈으로 좇지 않아도 어느 방향으로 쐈는지 즉시 읽힌다.
 *
 * 세 박자로 움직인다: 순식간에 끝까지 그어지는 "찌잉"(reveal) → 옅게 시작해 점점
 * 밝아지며 버티는 "예고"(hold, `BEAM_WINDUP_MS` 동안 실제 발사가 미뤄진다) → 발사와
 * 함께 옅어지는 "여운"(fade). 총알처럼 채워서 그리지 않고 매 프레임 길이만 다시
 * 그린다 — 짧은 선이라 매 틱 다시 그려도 비용이 크지 않다.
 */
export const beamLine = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  facing: 1 | -1,
  /** 총구에서 사거리 끝(벽 또는 최대 사거리)까지의 거리. */
  length: number,
  /**
   * 연사 단계에 따른 굵기 배율. 1이 기본. 매번 같은 두께로 그어지면 3연사가
   * 다 똑같아 보인다 — 1·2발째는 가볍게, 마무리는 두껍게 갈라준다.
   * 지속 시간은 건드리지 않는다 — 실제 발사 지연(BEAM_WINDUP_MS)과 묶여 있어서,
   * 여기서 늘리면 총알이 나간 뒤에도 조준선이 안 꺼진 것처럼 보인다.
   */
  power = 1,
): void => {
  const { beam } = VFX;
  // 굵기뿐 아니라 색도 단계마다 바꾼다 — 마무리로 갈수록 겉겹이 뜨거운 주황으로 옮겨간다.
  const heat = Phaser.Math.Clamp((power - 0.75) / 1.35, 0, 1);
  const glowColor = lerpColor(beam.glow, 0xff5320, heat);

  const graphics = scene.add.graphics();
  graphics.setDepth(VFX.depth);
  graphics.setBlendMode(Phaser.BlendModes.ADD);

  const draw = (current: number) => {
    graphics.clear();
    const right = current;
    // 흐릿한 바깥 겹 + 얇은 안쪽 심. 두 겹 다 옅어야 "레이저사이트"로 읽힌다 — 진하면 광선이 된다.
    graphics.lineStyle(beam.thickness * beam.glowScale * power, glowColor, beam.glowAlpha);
    graphics.lineBetween(0, 0, right, 0);
    graphics.lineStyle(beam.thickness * power, beam.core, beam.coreAlpha);
    graphics.lineBetween(0, 0, right, 0);
  };

  graphics.setPosition(x, y);
  graphics.setScale(facing, 1);
  // 전체 세기를 곱하는 겉겹 알파. 그어지는 순간엔 거의 안 보이다가 예고 구간에서 밝아진다.
  graphics.setAlpha(beam.startAlphaScale);
  draw(0);

  const carrier = { extend: 0 };
  scene.tweens.add({
    targets: carrier,
    extend: length,
    duration: beam.revealMs,
    ease: "power2.out",
    onUpdate: () => draw(carrier.extend),
    onComplete: () => {
      scene.tweens.add({
        targets: graphics,
        alpha: 1,
        duration: beam.holdMs,
        ease: "sine.in",
        onComplete: () => {
          scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: beam.fadeMs,
            ease: "power2.in",
            onComplete: () => graphics.destroy(),
          });
        },
      });
    },
  });
};

/** 조준선이 다 그어진 뒤 실제 총알이 나가기까지의 시간. 발사 지연은 이 값을 그대로 쓴다. */
export const BEAM_WINDUP_MS = VFX.beam.revealMs + VFX.beam.holdMs;

/**
 * 총구 섬광 — beam의 "팡".
 *
 * 발사 순간 총구에서 한 번 번쩍이는 흰 점 + 짧게 뻗는 불꽃 가닥. 조준선(beam)이
 * "그어지는" 연출이라면 이건 그 시작점에서 "터지는" 연출이다. 둘이 같이 있어야
 * 찌잉(그어짐)과 팡(터짐)이 한 세트로 읽힌다.
 */
export const muzzleFlash = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  facing: 1 | -1,
  /**
   * 연사 단계에 따른 세기. 1이 기본, 2~3발째로 갈수록 키운다.
   * 매번 같은 크기로 터지면 3연사인데 한 발처럼 밋밋하게 읽힌다.
   */
  power = 1,
): void => {
  const { muzzle } = VFX;
  // 0(약함)~1(마무리)로 정규화. 크기만 커지면 "같은 총이 세게 나간다"로 보이지만,
  // 색까지 살구색 → 뜨거운 주황으로 옮겨가야 "다른 발"로 읽힌다.
  const heat = Phaser.Math.Clamp((power - 0.75) / 1.35, 0, 1);
  const sparkColor = lerpColor(muzzle.spark, 0xff5320, heat);

  const graphics = scene.add.graphics({ x, y });
  graphics.setDepth(VFX.depth + 1);
  graphics.setBlendMode(Phaser.BlendModes.ADD);

  graphics.fillStyle(sparkColor, 0.9);
  graphics.fillCircle(0, 0, muzzle.coreRadius * 1.6 * power);
  graphics.fillStyle(muzzle.core, 1);
  graphics.fillCircle(0, 0, muzzle.coreRadius * power);

  // 총구 방향(전방 반원)으로만 불꽃 가닥을 뻗는다. 뒤로 뻗으면 반동처럼 보여 어색하다.
  // heat가 클수록 가닥도 늘어난다 — 마무리 발이 확실히 더 터지는 인상을 준다.
  const rays = Math.round(muzzle.rays + heat * 5);
  graphics.lineStyle(2, sparkColor, 0.85);
  for (let i = 0; i < rays; i += 1) {
    const spread = Phaser.Math.FloatBetween(-0.5, 0.5);
    const rayX = facing * muzzle.rayLength * power * (0.7 + Phaser.Math.FloatBetween(0, 0.4));
    const rayY = spread * muzzle.rayLength * power * 0.5;
    graphics.lineBetween(0, 0, rayX, rayY);
  }

  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    scale: 1.3 + heat * 0.8,
    duration: muzzle.lifeMs * (1 + heat * 0.6),
    ease: "power2.out",
    onComplete: () => graphics.destroy(),
  });

  // 세지는 발일수록 튀는 불티 조각과 확장하는 충격 링을 더 얹는다.
  if (heat > 0.3) {
    const sparkCount = Math.round(2 + heat * 5);
    for (let i = 0; i < sparkCount; i += 1) {
      const angle =
        facing > 0
          ? Phaser.Math.FloatBetween(-0.7, 0.7)
          : Math.PI + Phaser.Math.FloatBetween(-0.7, 0.7);
      const dist = (10 + heat * 26) * Phaser.Math.FloatBetween(0.6, 1);
      const dot = scene.add.graphics({ x, y });
      dot.setDepth(VFX.depth + 1);
      dot.setBlendMode(Phaser.BlendModes.ADD);
      dot.fillStyle(sparkColor, 1);
      dot.fillCircle(0, 0, 1.5);
      scene.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 130 + heat * 90,
        ease: "power2.out",
        onComplete: () => dot.destroy(),
      });
    }

    const ring = scene.add.graphics({ x, y });
    ring.setDepth(VFX.depth + 1);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.lineStyle(1.5, muzzle.core, 0.75);
    ring.strokeCircle(0, 0, muzzle.coreRadius);
    scene.tweens.add({
      targets: ring,
      scale: 1 + heat * 2.6,
      alpha: 0,
      duration: 150 + heat * 90,
      ease: "power2.out",
      onComplete: () => ring.destroy(),
    });
  }
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
  /** 총열을 개조했는가. 꼬리가 길고 두꺼워져 강화가 화면에 드러난다. */
  reforged = false,
): Phaser.GameObjects.Graphics => {
  const { tail } = VFX;
  const look = reforged ? { ...tail, ...tail.reforged } : tail;

  const graphics = scene.add.graphics();
  graphics.setDepth(VFX.depth - 1);
  graphics.setBlendMode(Phaser.BlendModes.ADD);

  /**
   * (실험) 계단식 사각형 대신 뾰족한 삼각형 두 겹으로 혜성 꼬리를 그린다.
   * 머리 쪽(0)은 두껍고 꼬리 끝은 한 점으로 모인다 — 도트가 아니라 매끈한 쐐기꼴이다.
   */
  const half = look.headHeight / 2;
  const tailX = -facing * look.length;

  graphics.fillStyle(look.glow, 0.55);
  graphics.fillTriangle(0, -half, 0, half, tailX, 0);
  graphics.fillStyle(look.core, 0.9);
  graphics.fillTriangle(0, -half * 0.4, 0, half * 0.4, tailX * 0.65, 0);

  /**
   * 총알 머리. 예전엔 점 하나뿐이라 밋밋하고 못생겨 보였다.
   * 진짜 셰이더 없이도, 반지름이 다른 원을 옅은 것부터 겹쳐 쌓으면(값싼 블룸) 빛나 보인다.
   * 십자 플레어를 하나 더 얹어 "반짝인다"는 인상을 확실히 준다.
   */
  const headRadius = half * 0.6;
  graphics.fillStyle(look.glow, 0.18);
  graphics.fillCircle(0, 0, headRadius * 3.2);
  graphics.fillStyle(look.glow, 0.35);
  graphics.fillCircle(0, 0, headRadius * 2);
  graphics.fillStyle(look.core, 0.6);
  graphics.fillCircle(0, 0, headRadius * 1.35);
  graphics.fillStyle(look.core, 1);
  graphics.fillCircle(0, 0, headRadius);

  const flare = headRadius * 2.8;
  graphics.lineStyle(1, 0xffffff, 0.8);
  graphics.lineBetween(-flare, 0, flare, 0);
  graphics.lineBetween(0, -flare, 0, flare);

  return graphics;
};

/** 적중 지점에서 튀는 도트 파편. 사각형만 써야 스프라이트와 같은 결로 보인다. */
export const hitBurst = (scene: Phaser.Scene, x: number, y: number): void => {
  const { burst } = VFX;

  // 링보다도 먼저, 아주 짧게 켜졌다 꺼지는 흰 섬광 — "팡" 하고 터지는 인상은
  // 파편이 아니라 이 한 프레임짜리 밝은 점에서 온다. 카메라 플래시처럼 순간적이어야 한다.
  const flash = scene.add.circle(x, y, burst.size * 2.2, 0xffffff, 1);
  flash.setDepth(VFX.depth + 1);
  flash.setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: flash,
    scale: 2.4,
    alpha: 0,
    duration: 90,
    ease: "power3.out",
    onComplete: () => flash.destroy(),
  });

  // 파편보다 먼저 아주 짧게 터지는 작은 링. 파편은 흩어지는 잔해고, 링은 충격 그 자체다.
  const ring = scene.add.graphics({ x, y });
  ring.setDepth(VFX.depth);
  ring.setBlendMode(Phaser.BlendModes.ADD);
  ring.fillStyle(burst.color, 1);
  for (let i = 0; i < burst.ring.points; i += 1) {
    const a = (i / burst.ring.points) * Math.PI * 2;
    ring.fillRect(
      Math.cos(a) * burst.ring.radius - 1.5,
      Math.sin(a) * burst.ring.radius - 1.5,
      3,
      3,
    );
  }
  scene.tweens.add({
    targets: ring,
    // 팽창 폭을 키워 링이 확실히 화면을 가로지르며 "펑" 퍼지는 인상을 준다.
    scale: burst.ring.growTo * 1.5,
    alpha: 0,
    duration: burst.ring.lifeMs,
    ease: "power2.out",
    onComplete: () => ring.destroy(),
  });

  for (let i = 0; i < burst.count; i += 1) {
    // 크기를 들쭉날쭉하게 둬야 정갈한 패턴이 아니라 터져 흩어지는 파편처럼 보인다.
    const size = burst.size * Phaser.Math.FloatBetween(0.6, 1.8);
    const shard = scene.add.rectangle(x, y, size, size, burst.color);
    shard.setDepth(VFX.depth);
    shard.setBlendMode(Phaser.BlendModes.ADD);
    shard.setAngle(Phaser.Math.Between(0, 360));

    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const speed = Phaser.Math.Between(burst.speed.min, burst.speed.max);
    const life = burst.lifeMs * Phaser.Math.FloatBetween(0.75, 1.15);

    scene.tweens.add({
      targets: shard,
      x: x + Math.cos(angle) * speed * (life / 1000),
      // 위로 튄 뒤 떨어지는 것처럼 보이도록 세로에만 낙차를 더한다.
      y: y + Math.sin(angle) * speed * (life / 1000) + 24,
      angle: shard.angle + Phaser.Math.Between(-180, 180),
      alpha: 0,
      duration: life,
      ease: "power2.out",
      onComplete: () => shard.destroy(),
    });
  }
};

/**
 * 발밑 흙먼지. 점프로 뛰어오르거나 착지할 때 부른다.
 * 타격 파편과 같은 방사형 흩어짐을 쓰되, 위쪽 반원으로만 퍼지게 해 "발밑에서 튀는" 모양을 낸다.
 */
export const groundDust = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  variant: "jump" | "land" | "run",
): void => {
  const { dust } = VFX;
  const spec = dust[variant];

  for (let i = 0; i < spec.count; i += 1) {
    const size = dust.size * Phaser.Math.FloatBetween(0.7, 1.6);
    const puff = scene.add.rectangle(x, y, size, size, dust.color, dust.alpha);
    puff.setDepth(VFX.depth - 2);

    // 표준 각도 기준 207°~333° — 정확히 위쪽을 중심으로 좌우로 퍼진다. 아래로는 안 튄다.
    const angle = Phaser.Math.FloatBetween(Math.PI * 1.15, Math.PI * 1.85);
    const speed = Phaser.Math.Between(spec.speed.min, spec.speed.max);
    const life = spec.lifeMs * Phaser.Math.FloatBetween(0.8, 1.2);

    scene.tweens.add({
      targets: puff,
      x: x + Math.cos(angle) * speed * (life / 1000),
      // 세로 이동을 눌러 낮게 깔리게 한다 — 그대로 두면 불꽃 파편처럼 위로 튄다.
      y: y + Math.sin(angle) * speed * (life / 1000) * 0.4,
      alpha: 0,
      scale: 1.6,
      duration: life,
      ease: "power2.out",
      onComplete: () => puff.destroy(),
    });
  }
};

/**
 * 총알이 맞았을 때 튀는 파편 — hitBurst의 가벼운 버전.
 *
 * 근접타는 몸으로 부딪히는 무게가 있지만, 총알은 스치듯 지나간다.
 * 조각 수를 줄이고 사각형 대신 짧은 선(빗금)으로 그려 "관통해 지나간" 느낌을 낸다.
 * 검 쪽 hitBurst와 같은 자리에서 부르되, 색과 모양을 다르게 둬 두 무기가 구분되게 한다.
 */
export const rangedSpark = (scene: Phaser.Scene, x: number, y: number, facing: 1 | -1): void => {
  const { rangedSpark: spark } = VFX;

  for (let i = 0; i < spark.count; i += 1) {
    // 총알이 지나온 방향을 중심으로 좁게 흩어진다 — 원형 파편이면 근접타와 구분이 안 된다.
    const angle = Math.PI + Phaser.Math.FloatBetween(-0.6, 0.6) * facing;
    const speed = Phaser.Math.Between(spark.speed.min, spark.speed.max);
    const life = spark.lifeMs * Phaser.Math.FloatBetween(0.7, 1.1);
    const len = spark.length * Phaser.Math.FloatBetween(0.6, 1);

    const line = scene.add.graphics({ x, y });
    line.setDepth(VFX.depth);
    line.setBlendMode(Phaser.BlendModes.ADD);
    line.lineStyle(2, spark.color, 0.95);
    line.lineBetween(0, 0, Math.cos(angle) * len, Math.sin(angle) * len);
    line.setRotation(angle);

    scene.tweens.add({
      targets: line,
      x: x + Math.cos(angle) * speed * (life / 1000),
      y: y + Math.sin(angle) * speed * (life / 1000),
      alpha: 0,
      duration: life,
      ease: "power2.out",
      onComplete: () => line.destroy(),
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
/**
 * 재로 산화. 몸이 빙글 도는 스핀 대신, 타고 남은 재가 떠오르며 흩어지는 쪽이
 * "죽었다"보다 "산화했다"에 더 맞는다는 지적 — `deathBurst`(터짐)와 짝을 이뤄 쓴다.
 * 조각마다 위로 뜨는 속도·좌우 흔들림(sin)·크기를 다르게 흔들어야 재처럼 보인다.
 */
export const ashRise = (scene: Phaser.Scene, x: number, y: number, color: number): void => {
  const count = 20;
  for (let i = 0; i < count; i += 1) {
    const size = Phaser.Math.FloatBetween(2, 5);
    const flake = scene.add.rectangle(
      x + Phaser.Math.FloatBetween(-10, 10),
      y + Phaser.Math.FloatBetween(-6, 6),
      size,
      size,
      color,
      Phaser.Math.FloatBetween(0.55, 0.9),
    );
    flake.setDepth(VFX.depth);
    flake.setAngle(Phaser.Math.Between(0, 360));

    // 너무 빨리 끝나 잘 안 보인다는 지적 — 수명을 두 배 가까이 늘려 재가 떠오르는
    // 순간이 눈에 담기게 한다. 페이드는 수명 비율로 걸려 있어 같이 늘어난다.
    const rise = Phaser.Math.FloatBetween(70, 150);
    const life = Phaser.Math.Between(950, 1500);
    const swayAmp = Phaser.Math.FloatBetween(6, 16);
    const swayFreq = Phaser.Math.FloatBetween(2, 4);
    const startX = flake.x;

    const carrier = { t: 0 };
    scene.tweens.add({
      targets: carrier,
      t: 1,
      duration: life,
      ease: "sine.out",
      onUpdate: () => {
        flake.y = y - rise * carrier.t;
        flake.x = startX + Math.sin(carrier.t * Math.PI * swayFreq) * swayAmp * carrier.t;
        flake.setScale(1 - carrier.t * 0.5);
      },
      onComplete: () => flake.destroy(),
    });
    scene.tweens.add({
      targets: flake,
      alpha: 0,
      delay: life * 0.35,
      duration: life * 0.65,
      ease: "power1.in",
    });
  }
};

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

/**
 * (실험) 방 전체에 떠다니는 잔불/먼지 입자.
 *
 * 타격 파편·흙먼지와 달리 아주 느리게, 오래 떠 있다가 사라진다 — 분위기용이라
 * 존재감은 옅게 둔다. 방 전체 폭에 걸쳐 계속 하나씩 새로 생기고, 위로 떠오르며
 * 옅게 좌우로 흔들리다 사라진다. 붉은 톤이라 배경과 어울린다.
 */
const AMBIENT = {
  color: 0xff8a4a,
  size: PIXEL,
  spawnIntervalMs: 260,
  lifeMs: { min: 4000, max: 8000 },
  maxAlpha: 0.45,
  riseSpeed: { min: 8, max: 24 },
  swayPx: { min: -30, max: 30 },
} as const;

/**
 * 방 시작 시 한 번 불러 반복 스폰 타이머를 건다.
 * 씬이 꺼지거나 재시작되면 Phaser가 씬에 딸린 타이머를 알아서 정리한다.
 */
export const startAmbientParticles = (
  scene: Phaser.Scene,
  roomWidth: number,
  floorY: number,
): void => {
  const spawnOne = () => {
    const x = Phaser.Math.Between(0, roomWidth);
    const y = Phaser.Math.Between(0, floorY);
    const size = AMBIENT.size * Phaser.Math.FloatBetween(0.6, 1.3);

    const particle = scene.add.rectangle(x, y, size, size, AMBIENT.color);
    // 배경보다는 앞, 바닥 타일·캐릭터·장식보다는 뒤 — 안개처럼 스치듯 지나가게 한다.
    particle.setDepth(0);
    particle.setBlendMode(Phaser.BlendModes.ADD);
    particle.setAlpha(0);

    const life = Phaser.Math.Between(AMBIENT.lifeMs.min, AMBIENT.lifeMs.max);
    const rise = Phaser.Math.Between(AMBIENT.riseSpeed.min, AMBIENT.riseSpeed.max);
    const sway = Phaser.Math.FloatBetween(AMBIENT.swayPx.min, AMBIENT.swayPx.max);

    scene.tweens.add({
      targets: particle,
      y: y - (rise * life) / 1000,
      x: x + sway,
      duration: life,
      ease: "sine.inOut",
    });
    // 알파를 yoyo로 왕복시키면 절반 지점에서 가장 밝았다가 서서히 꺼진다 —
    // 갑자기 나타나거나 갑자기 사라지지 않는다.
    scene.tweens.add({
      targets: particle,
      alpha: AMBIENT.maxAlpha,
      duration: life / 2,
      yoyo: true,
      ease: "sine.inOut",
      onComplete: () => particle.destroy(),
    });
  };

  scene.time.addEvent({ delay: AMBIENT.spawnIntervalMs, loop: true, callback: spawnOne });
};

/**
 * 배경의 핏빛 비. 화면 위에서 비스듬히 떨어지는 가는 붉은 줄기들 — 분위기용이라
 * 캐릭터·장식보다 뒤(depth 0)에서, 가산 없이 어둡고 옅게 내린다.
 * 바닥에 닿으면 이따금 작게 튀는 물자국을 남긴다.
 */
const BLOOD_RAIN = {
  color: 0xa01824,
  spawnIntervalMs: 70,
  lengthPx: { min: 10, max: 24 },
  alpha: { min: 0.14, max: 0.34 },
  fallMs: { min: 650, max: 1050 },
  /** 낙하 동안 옆으로 흐르는 거리. 수직으로만 내리면 정지 화면처럼 심심하다. */
  driftPx: -46,
} as const;

export const startBloodRain = (scene: Phaser.Scene, roomWidth: number, floorY: number): void => {
  // 낙하 벡터에 맞춰 눕힌다 — 줄기가 떨어지는 방향과 어긋나면 붙여넣은 선으로 보인다.
  // (세로 막대의 로컬 +y가 (−sinθ, cosθ)로 돌므로 drift 부호를 뒤집어야 방향이 맞는다)
  const angle = Math.atan2(-BLOOD_RAIN.driftPx, floorY);

  const spawnOne = () => {
    const x = Phaser.Math.Between(0, roomWidth - BLOOD_RAIN.driftPx);
    const length = Phaser.Math.FloatBetween(BLOOD_RAIN.lengthPx.min, BLOOD_RAIN.lengthPx.max);
    const alpha = Phaser.Math.FloatBetween(BLOOD_RAIN.alpha.min, BLOOD_RAIN.alpha.max);
    const startY = Phaser.Math.Between(-floorY, -20);

    const drop = scene.add.rectangle(x, startY, 1.5, length, BLOOD_RAIN.color, alpha);
    drop.setDepth(0);
    drop.setRotation(angle);

    const fallMs = Phaser.Math.Between(BLOOD_RAIN.fallMs.min, BLOOD_RAIN.fallMs.max);
    scene.tweens.add({
      targets: drop,
      y: floorY,
      x: x + BLOOD_RAIN.driftPx,
      duration: fallMs * ((floorY - startY) / floorY),
      ease: "linear",
      onComplete: () => {
        drop.destroy();
        // 셋에 하나만 튄다 — 전부 튀기면 바닥이 계속 반짝여 시끄럽다.
        if (Phaser.Math.Between(0, 2) !== 0) return;
        const splash = scene.add.ellipse(x + BLOOD_RAIN.driftPx, floorY, 4, 1.4, BLOOD_RAIN.color, alpha);
        splash.setDepth(0);
        scene.tweens.add({
          targets: splash,
          scaleX: 2.4,
          alpha: 0,
          duration: 260,
          ease: "power2.out",
          onComplete: () => splash.destroy(),
        });
      },
    });
  };

  scene.time.addEvent({ delay: BLOOD_RAIN.spawnIntervalMs, loop: true, callback: spawnOne });
};

/**
 * 데미지 숫자. 맞은 자리에서 살짝 떠오르며 곧 사라진다.
 * 좌우로 조금씩 흩어 연타 시 숫자가 겹쳐 안 읽히는 것을 막는다.
 */
export const damageNumber = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  amount: number,
): void => {
  const text = scene.add.text(
    x + Phaser.Math.Between(-10, 10),
    y - 16,
    String(amount),
    {
      fontFamily: "monospace",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#ffe9e0",
      stroke: "#4a0d12",
      strokeThickness: 3,
      // 캔버스가 창 크기로 확대되므로 2배 해상도로 그려야 확대 후에도 선명하다.
      resolution: 2,
    },
  );
  text.setOrigin(0.5, 1);
  text.setDepth(VFX.depth + 1);

  scene.tweens.add({
    targets: text,
    y: y - 44,
    alpha: 0,
    duration: 550,
    ease: "power1.out",
    onComplete: () => text.destroy(),
  });
};

/**
 * 적(고블린)의 베기 이펙트. 플레이어 슬래시와 같은 문법(초승달 호)이되
 * 적 팔레트(어두운 몸통 + 붉은 심)로 그려 누가 벤 건지 색으로 구분된다.
 * 좌표는 오른쪽 기준으로만 계산하고 graphics 자체를 setScale로 뒤집는다(플레이어와 동일 기법).
 */
export const enemySlash = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  facing: 1 | -1,
  reach: number,
): void => {
  const graphics = scene.add.graphics();
  graphics.setPosition(x, y);
  graphics.setScale(facing, 1);
  graphics.setDepth(VFX.depth);
  graphics.setBlendMode(Phaser.BlendModes.ADD);

  const segments = 26;
  const from = Phaser.Math.DegToRad(-55);
  const to = Phaser.Math.DegToRad(55);
  const carrier = { t: 0 };

  const draw = (t: number) => {
    graphics.clear();
    const revealTo = Phaser.Math.Linear(from, to, t);
    for (let i = 0; i < segments; i += 1) {
      const p = i / (segments - 1);
      const angle = Phaser.Math.Linear(from, revealTo, p);
      // sin 두께 곡선 — 스윙 정점에서 가장 두껍고 양 끝이 점으로 모인다.
      const thickness = Math.sin(p * Math.PI) * 12;
      if (thickness < 0.5) continue;
      const px = Math.cos(angle) * reach;
      const py = Math.sin(angle) * reach * 0.7;
      graphics.fillStyle(0x8c1f2c, 0.5);
      graphics.fillCircle(px, py, thickness);
      graphics.fillStyle(0xff5560, 0.85);
      graphics.fillCircle(px, py, thickness * 0.4);
    }
  };

  scene.tweens.add({
    targets: carrier,
    t: 1,
    duration: 120,
    ease: "power2.out",
    onUpdate: () => draw(carrier.t),
    onComplete: () => {
      scene.tweens.add({
        targets: graphics,
        alpha: 0,
        duration: 130,
        ease: "power2.in",
        onComplete: () => graphics.destroy(),
      });
    },
  });
};

/**
 * 적 투사체의 꼬리. 밋밋한 사각형 대신 사인파로 출렁이는 침(스팅어) 궤적을 그린다.
 *
 * 투사체 물리는 그대로 직선으로 날고, 꼬리 그림만 진행 방향과 수직으로 sin 진동한다 —
 * 판정은 예측 가능하게 유지하면서(DEC-004) 그림만 살아있게 하는 절충이다.
 * 투사체가 파괴되면 스스로 정리된다.
 */
/**
 * 검기(마무리 타격 특수기술) 궤적. 벌 침 궤적과 달리 출렁이지 않는다 —
 * 칼날이 날아가는 것이므로 얇고 곧은 빛의 조각을 남기며 지나가야 한다.
 */
/**
 * 검기용 초승달 면. `slashArc`의 3타 궤적과 같은 문법이다 — 양 끝이 가늘고
 * 몸통이 부풀어, 사각형/칼날 조각이 아니라 "휘두른 궤적"으로 읽힌다.
 */
const waveCrescent = (radius: number, thickness: number): { x: number; y: number }[] => {
  const SEGMENTS = 18;
  // 3타 슬래시(SLASH_SWEEPS[2])와 같은 대각선 스윕.
  const FROM = -150;
  const TO = 46;
  const outer: { x: number; y: number }[] = [];
  const inner: { x: number; y: number }[] = [];
  for (let i = 0; i <= SEGMENTS; i += 1) {
    const t = i / SEGMENTS;
    const angle = Phaser.Math.DegToRad(Phaser.Math.Linear(FROM, TO, t));
    const half = (thickness * (0.08 + 0.92 * Math.sin(t * Math.PI))) / 2;
    outer.push({ x: Math.cos(angle) * (radius + half), y: Math.sin(angle) * (radius + half) });
    inner.push({ x: Math.cos(angle) * (radius - half), y: Math.sin(angle) * (radius - half) });
  }
  return [...outer, ...inner.reverse()];
};

/**
 * 검기(마무리 타격 특수기술) 궤적.
 *
 * 빔/총알처럼 보인다는 지적 — 3타 슬래시와 같은 초승달 참격이 통째로 날아가고,
 * 지나간 자리에 옅은 초승달 잔상이 겹겹이 남는 "베기 모션이 날아가는" 그림으로 바꾼다.
 * 투사체 물리는 그대로 직선으로 날고, 그림만 얹는다.
 */
export const swordWaveTrail = (
  scene: Phaser.Scene,
  // physics.add.image()로 만든 투사체를 그대로 받는다 — Sprite가 아니라 Image다.
  projectile: Phaser.GameObjects.Image,
  facing: 1 | -1,
): void => {
  // 본체 — 투사체를 따라다니는 초승달 참격. 3타 슬래시가 그대로 날아가는 그림이다.
  const head = scene.add.graphics({ x: projectile.x, y: projectile.y });
  head.setDepth(VFX.depth + 1);
  head.setBlendMode(Phaser.BlendModes.ADD);
  head.setScale(facing, 1);
  head.fillStyle(0x8fd7ff, 0.18);
  head.fillPoints(waveCrescent(26, 16), true);
  head.fillStyle(0xcfeeff, 0.42);
  head.fillPoints(waveCrescent(26, 10), true);
  head.fillStyle(0xffffff, 0.92);
  head.fillPoints(waveCrescent(26, 4), true);

  let tick = 0;
  const event = scene.time.addEvent({
    delay: 24,
    loop: true,
    callback: () => {
      if (!projectile.active) {
        event.remove(false);
        scene.tweens.add({
          targets: head,
          alpha: 0,
          duration: 120,
          ease: "power2.out",
          onComplete: () => head.destroy(),
        });
        return;
      }
      tick += 1;
      head.setPosition(projectile.x, projectile.y);
      // 날아가며 천천히 앞으로 기운다 — 회전이 있어야 "휘두른 검이 날아간다"로 읽힌다.
      head.setRotation(facing * tick * 0.05);

      // 잔상 — 방금 자리에 옅은 초승달을 남긴다. 대시 잔상과 같은 문법으로,
      // 진행 반대로 살짝 밀리며 사라져 궤적이 이어져 보인다.
      const ghost = scene.add.graphics({ x: projectile.x, y: projectile.y });
      ghost.setDepth(VFX.depth);
      ghost.setBlendMode(Phaser.BlendModes.ADD);
      ghost.setScale(facing, 1);
      ghost.setRotation(head.rotation);
      ghost.fillStyle(0x8fd7ff, 0.3);
      ghost.fillPoints(waveCrescent(24, 9), true);
      scene.tweens.add({
        targets: ghost,
        alpha: 0,
        x: projectile.x - facing * 18,
        duration: 240,
        ease: "power2.out",
        onComplete: () => ghost.destroy(),
      });

      // 매 틱 찍으면 빽빽해져 뭉개진다 — 세 틱에 한 번만 불티를 흩뿌린다.
      if (tick % 3 === 0) {
        for (let i = 0; i < 2; i += 1) {
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const dist = Phaser.Math.FloatBetween(8, 20);
          const spark = scene.add.circle(projectile.x, projectile.y, 1.3, 0xcfeeff, 1);
          spark.setDepth(VFX.depth + 1);
          spark.setBlendMode(Phaser.BlendModes.ADD);
          scene.tweens.add({
            targets: spark,
            x: projectile.x + Math.cos(angle) * dist,
            y: projectile.y + Math.sin(angle) * dist,
            alpha: 0,
            duration: Phaser.Math.Between(140, 220),
            ease: "power2.out",
            onComplete: () => spark.destroy(),
          });
        }
      }
    },
  });
};

export const attachStingerTrail = (
  scene: Phaser.Scene,
  projectile: Phaser.GameObjects.Sprite,
): void => {
  const graphics = scene.add.graphics();
  graphics.setDepth(VFX.depth);
  graphics.setBlendMode(Phaser.BlendModes.ADD);

  // 최근 위치 기록으로 꼬리를 그린다. 위치 자체는 직선이고 흔들림은 그릴 때만 더한다.
  const history: { x: number; y: number }[] = [];
  let elapsed = 0;

  const event = scene.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      if (!projectile.active) {
        event.remove(false);
        scene.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 90,
          onComplete: () => graphics.destroy(),
        });
        return;
      }

      elapsed += 16;
      history.unshift({ x: projectile.x, y: projectile.y });
      if (history.length > 9) history.pop();

      const body = projectile.body as Phaser.Physics.Arcade.Body | null;
      const angle = body ? Math.atan2(body.velocity.y, body.velocity.x) : 0;
      // 진행 방향과 수직인 축으로 sin 진동을 얹는다.
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);

      graphics.clear();
      history.forEach((point, i) => {
        const p = i / history.length;
        const wave = Math.sin(elapsed * 0.03 - i * 0.9) * 5 * p;
        const size = (1 - p) * 5 + 1;
        graphics.fillStyle(0xff8a5f, (1 - p) * 0.7);
        graphics.fillCircle(point.x + nx * wave, point.y + ny * wave, size);
      });
      // 머리는 밝게 — 어디가 탄인지 읽혀야 피할 수 있다.
      graphics.fillStyle(0xffd9a8, 1);
      graphics.fillCircle(projectile.x, projectile.y, 4);
    },
  });
};

/**
 * 패링 방어 자세. S를 누른 순간부터 방어 창이 끝날 때까지 몸 앞에 얇은 호를 띄운다.
 * 퍼펙트 성공 시 `perfectParryBurst`로 교체되므로, 호출한 쪽이 반환된 오브젝트를
 * 들고 있다가 직접 지워야 한다(자동으로 사라지지 않음 — 방어 창 길이가 상황마다 다르다).
 */
export const parryGuard = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  facing: 1 | -1,
): Phaser.GameObjects.Container => {
  const container = scene.add.container(x, y);
  container.setDepth(VFX.depth + 1);
  container.setScale(facing, 1);

  const arcs = scene.add.graphics();
  arcs.setBlendMode(Phaser.BlendModes.ADD);
  arcs.lineStyle(2.5, 0xffe066, 0.9);
  arcs.beginPath();
  arcs.arc(0, -4, 28, Phaser.Math.DegToRad(-65), Phaser.Math.DegToRad(65));
  arcs.strokePath();
  arcs.lineStyle(1, 0xfff6c8, 0.5);
  arcs.beginPath();
  arcs.arc(0, -4, 23, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(60));
  arcs.strokePath();
  container.add(arcs);

  // 룬 고리 — 파선 원이 천천히 돈다. "발동 중인 술식"처럼 보이게 하는 바닥판이다.
  const rune = scene.add.graphics();
  rune.setBlendMode(Phaser.BlendModes.ADD);
  const RUNE_SEGMENTS = 10;
  for (let i = 0; i < RUNE_SEGMENTS; i += 1) {
    const a0 = (i / RUNE_SEGMENTS) * Math.PI * 2;
    rune.lineStyle(1.5, 0xffe066, 0.45);
    rune.beginPath();
    rune.arc(0, -4, 31, a0, a0 + Math.PI * 0.11);
    rune.strokePath();
  }
  container.add(rune);

  // 점 대신 빛나는 검 조각 4개가 궤도를 돈다. 궤도 접선 방향으로 눕고 짧은 꼬리를
  // 달아, 정적인 호 하나만 있을 때보다 "지금 뭔가 버티고 있다"가 한눈에 보인다.
  const shards = [0, 1, 2, 3].map(() => {
    const shard = scene.add.graphics();
    shard.setBlendMode(Phaser.BlendModes.ADD);
    shard.fillStyle(0xfff6c8, 0.95);
    shard.fillPoints(
      [
        { x: 6, y: 0 },
        { x: 0, y: -2.2 },
        { x: -4, y: 0 },
        { x: 0, y: 2.2 },
      ],
      true,
    );
    // 꼬리 — 도는 방향 반대로 빛이 끌린다.
    shard.lineStyle(1, 0xffe066, 0.55);
    shard.lineBetween(-4, 0, -13, 0);
    container.add(shard);
    return shard;
  });

  const clock = { t: 0 };
  const orbit = scene.tweens.add({
    targets: clock,
    t: Math.PI * 2,
    duration: 1100,
    repeat: -1,
    ease: "linear",
    onUpdate: () => {
      rune.setRotation(clock.t * 0.6);
      shards.forEach((shard, i) => {
        const speed = 1 + i * 0.28;
        const radius = 27 - i * 3;
        const angle = clock.t * speed + (i * Math.PI * 2) / shards.length;
        shard.setPosition(Math.cos(angle) * radius, -4 + Math.sin(angle) * radius * 0.55);
        // 타원 궤도의 접선을 향해 눕는다 — 조각이 항상 진행 방향을 보고 돈다.
        shard.setRotation(Math.atan2(Math.cos(angle) * 0.55, -Math.sin(angle)));
        // 궤도 뒤쪽(아래)을 돌 때 살짝 옅어져 입체감이 생긴다.
        shard.setAlpha(0.65 + 0.35 * Math.sin(angle));
      });
    },
  });

  // 숨쉬듯 깜빡여야 "지금 막는 중"이라는 상태가 눈에 들어온다.
  const breathe = scene.tweens.add({
    targets: arcs,
    alpha: { from: 0.55, to: 1 },
    duration: 180,
    yoyo: true,
    repeat: -1,
  });

  container.setData("tweens", [orbit, breathe]);
  return container;
};

/** 방어 창이 그냥 끝났을 때(퍼펙트 실패) 호를 걷어낸다. */
export const clearParryGuard = (scene: Phaser.Scene, guard: Phaser.GameObjects.Container): void => {
  const tweens = guard.getData("tweens") as Phaser.Tweens.Tween[] | undefined;
  tweens?.forEach((tween) => tween.remove());
  scene.tweens.add({
    targets: guard,
    alpha: 0,
    duration: 90,
    onComplete: () => guard.destroy(),
  });
};

/**
 * 퍼펙트 패링 성공. 방어 호 대신 방패가 팡 터져나가는 그림으로 확실히 교체된다 —
 * 그냥 막았을 때와 같은 그림이면 "반사가 됐다"는 게 안 읽힌다.
 * 원형 방패 실루엣이 빠르게 부풀었다 갈라지고, 조각과 스파크가 sin/cos로 흩어진다.
 */
export const perfectParryBurst = (scene: Phaser.Scene, x: number, y: number): void => {
  // 방패 본체 — 확 부풀었다 갈라지듯 사라진다.
  const shield = scene.add.graphics({ x, y });
  shield.setDepth(VFX.depth + 2);
  shield.setBlendMode(Phaser.BlendModes.ADD);
  shield.lineStyle(3, 0xfff6c8, 1);
  shield.strokeCircle(0, 0, 10);
  shield.lineStyle(1.5, 0xffe066, 0.6);
  shield.strokeCircle(0, 0, 16);
  scene.tweens.add({
    targets: shield,
    scale: 3.2,
    alpha: 0,
    duration: 220,
    ease: "power3.out",
    onComplete: () => shield.destroy(),
  });

  const flash = scene.add.circle(x, y, 6, 0xffffff, 1);
  flash.setDepth(VFX.depth + 2);
  flash.setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: flash,
    scale: 5,
    alpha: 0,
    duration: 160,
    ease: "power3.out",
    onComplete: () => flash.destroy(),
  });

  // 방패가 깨져 흩어지는 조각들 — 길이·속도를 조금씩 흔들어 규칙적으로 보이지 않게 한다.
  const shardCount = 12;
  for (let i = 0; i < shardCount; i += 1) {
    const angle = (i / shardCount) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.15, 0.15);
    const dist = 40 + Phaser.Math.FloatBetween(-8, 14);
    const shard = scene.add.graphics({ x, y });
    shard.setDepth(VFX.depth + 2);
    shard.setBlendMode(Phaser.BlendModes.ADD);
    shard.lineStyle(2, i % 2 === 0 ? 0xffe066 : 0xfff6c8, 0.9);
    shard.lineBetween(0, 0, Math.cos(angle) * 6, Math.sin(angle) * 6);
    shard.setRotation(angle);
    scene.tweens.add({
      targets: shard,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      duration: 260 + Phaser.Math.Between(-40, 60),
      ease: "power2.out",
      onComplete: () => shard.destroy(),
    });
  }
};

/**
 * 게이트를 넘어갈 때의 화면 전환. 위·아래에서 검은 막이 부딪히듯 닫혀 화면을 덮는다.
 * 다 덮이면 `onCovered`를 불러 실제 방 전환(`scene.restart`/`scene.start`)을 그 순간에 실행한다 —
 * 덮이기 전에 다음 방으로 넘어가면 전환 중간 상태가 그대로 보인다.
 * 새 방 진입 쪽의 페이드인은 각 씬 `create()`의 `cameras.main.fadeIn`이 맡는다.
 */
export const portalWipeOut = (scene: Phaser.Scene, onCovered: () => void): void => {
  const cam = scene.cameras.main;
  const halfHeight = cam.height / 2 + 4;

  const top = scene.add.rectangle(0, -halfHeight, cam.width, halfHeight, 0x000000, 1).setOrigin(0, 0);
  const bottom = scene.add
    .rectangle(0, cam.height + halfHeight, cam.width, halfHeight, 0x000000, 1)
    .setOrigin(0, 1);
  for (const curtain of [top, bottom]) {
    curtain.setScrollFactor(0);
    curtain.setDepth(1000);
  }

  let closed = 0;
  const onCurtainClosed = () => {
    closed += 1;
    if (closed === 2) onCovered();
  };
  scene.tweens.add({ targets: top, y: 0, duration: 220, ease: "power2.in", onComplete: onCurtainClosed });
  scene.tweens.add({
    targets: bottom,
    y: cam.height,
    duration: 220,
    ease: "power2.in",
    onComplete: onCurtainClosed,
  });
};
