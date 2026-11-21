import type { Judgement, JudgeMode, ShowProfile } from '../src/core/veil';

export interface Settings {
  enabled: boolean;
  mode: JudgeMode;
}

export const DEFAULT_SETTINGS: Settings = { enabled: true, mode: 'hybrid' };

export interface Counters {
  checked: number;
  veiled: number;
  onDevice: number;
  inCloud: number;
}

/** content/popup → background */
export type ToBackground =
  | { type: 'judge'; text: string; pageTitle?: string }
  | { type: 'build'; title: string; progress: string; guide: string };

/** background → offscreen */
export type ToOffscreen =
  | { target: 'offscreen'; type: 'judge'; text: string; pageTitle?: string; shows: ShowProfile[]; settings: Settings }
  | { target: 'offscreen'; type: 'build'; title: string; progress: string; guide: string };

export type JudgeReply = { ok: true; judgement: Judgement } | { ok: false; error: string };
export type BuildReply = { ok: true; profile: ShowProfile } | { ok: false; error: string };
