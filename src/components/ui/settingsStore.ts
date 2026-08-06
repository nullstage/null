/**
 * 설정 저장. 지금은 소리 값만 다룬다.
 *
 * 마스터와 효과음은 아직 연결할 대상이 없다. 값만 보관하고, 소리가 붙으면 그때 읽어 쓴다.
 * 런 데이터가 아니므로 `localStorage`에 남긴다. (CLAUDE.md 배포 규칙)
 */

const AUDIO_KEY = "null:audio";

export interface AudioSettings {
  /** 전체 음량. 다른 값에 곱해서 쓴다. 0~1 */
  master: number;
  /** 배경음악. 0~1 */
  bgm: number;
  /** 효과음. 아직 재생하는 곳이 없다. 0~1 */
  sfx: number;
}

export const DEFAULT_AUDIO: AudioSettings = { master: 0.8, bgm: 0.45, sfx: 0.7 };

const clamp01 = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;

export const loadAudioSettings = (): AudioSettings => {
  try {
    const raw = window.localStorage.getItem(AUDIO_KEY);
    if (!raw) return DEFAULT_AUDIO;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_AUDIO;

    const record = parsed as Partial<Record<keyof AudioSettings, unknown>>;
    return {
      master: clamp01(record.master, DEFAULT_AUDIO.master),
      bgm: clamp01(record.bgm, DEFAULT_AUDIO.bgm),
      sfx: clamp01(record.sfx, DEFAULT_AUDIO.sfx),
    };
  } catch {
    // 접근이 막히거나 값이 깨졌으면 기본값으로 시작한다.
    return DEFAULT_AUDIO;
  }
};

export const saveAudioSettings = (settings: AudioSettings): void => {
  try {
    window.localStorage.setItem(AUDIO_KEY, JSON.stringify(settings));
  } catch {
    // 저장에 실패해도 이번 세션의 값은 그대로 적용된다.
  }
};
