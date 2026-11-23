/**
 * How the app vibrates under a touch, as a setting: which kinds of moment
 * vibrate at all, and how strongly. Nothing here knows about a phone, so it
 * can be tested; `haptics.ts` puts the settings table and the motor behind it.
 *
 * Every vibration belongs to one group, and somebody chooses by the group:
 * all of them, the few that say most, none, or their own pick. The phone's
 * own switch for touch feedback is above all of this, and the native side
 * heeds it whatever is chosen here.
 */

/** The kinds of moment there are to feel, each a switch of its own under Custom. */
export const HAPTIC_GROUPS = ['holds', 'choices', 'notches', 'results', 'player', 'fun'] as const;
export type HapticGroup = (typeof HAPTIC_GROUPS)[number];

/**
 *  - `holds`: a long press taking, a row lifted and dragged, a finger run down the checkboxes;
 *  - `choices`: switches, tabs of a choice, an option picked;
 *  - `notches`: the places a slider stops — normal speed, nought decibels, the middle — and a chart's columns;
 *  - `results`: something asked for has worked, or has not;
 *  - `player`: the player's own buttons;
 *  - `fun`: the game's keys, and the shuffle button pressed and pressed again.
 */
export type HapticMode = 'off' | 'essential' | 'all' | 'custom';
export const HAPTIC_MODES: readonly HapticMode[] = ['off', 'essential', 'all', 'custom'];

/** The ones that say most for what they cost: what a hold did, what came of something, and the game. */
const ESSENTIAL: ReadonlySet<HapticGroup> = new Set(['holds', 'results', 'fun']);

export type HapticSettings = {
  mode: HapticMode;
  /** Under Custom, the groups that are on. */
  groups: Record<HapticGroup, boolean>;
  /** From nought to one. Only a phone whose motor can be made lighter or stronger takes any notice. */
  strength: number;
};

/**
 * How strong a touch is felt, as a share of the recommended (1): up to three
 * times it, past which a motor has nothing more to give. Past 1 the same
 * feels are made heavier and then the motor driven at its fullest, in
 * `JukeboxAudioModule.kt` (`composed`, `forced`).
 */
export const RECOMMENDED_STRENGTH = 1;
export const STRONGEST = 3;

export const DEFAULT_HAPTICS: HapticSettings = {
  mode: 'all',
  groups: { holds: true, choices: true, notches: true, results: true, player: true, fun: true },
  strength: 0.7,
};

/** Whether a vibration of [group] is felt, under [settings]. */
export function feels(settings: HapticSettings, group: HapticGroup): boolean {
  switch (settings.mode) {
    case 'off':
      return false;
    case 'essential':
      return ESSENTIAL.has(group);
    case 'all':
      return true;
    case 'custom':
      return settings.groups[group];
  }
}

/** The settings a stored string says, anything missing or unreadable as it comes. */
export function hapticsFrom(words: string | null): HapticSettings {
  if (!words) return DEFAULT_HAPTICS;
  try {
    const kept = JSON.parse(words) as Partial<HapticSettings> | null;
    const mode = HAPTIC_MODES.includes(kept?.mode as HapticMode) ? (kept!.mode as HapticMode) : DEFAULT_HAPTICS.mode;
    const groups = { ...DEFAULT_HAPTICS.groups };
    for (const group of HAPTIC_GROUPS) {
      const said = kept?.groups?.[group];
      if (typeof said === 'boolean') groups[group] = said;
    }
    const strength =
      typeof kept?.strength === 'number' && Number.isFinite(kept.strength)
        ? Math.min(STRONGEST, Math.max(0.1, kept.strength))
        : DEFAULT_HAPTICS.strength;
    return { mode, groups, strength };
  } catch {
    return DEFAULT_HAPTICS;
  }
}
