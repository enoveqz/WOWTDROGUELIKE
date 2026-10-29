export type Action =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'skill1'
  | 'skill2'
  | 'skill3'
  | 'skill4'
  | 'racial'
  | 'interact'
  | 'dodge'
  | 'build'
  | 'nextWave'
  | 'pause';

/** Belegung über KeyboardEvent.code (layoutunabhängig, z. B. QWERTZ). */
export const DEFAULT_KEYS: Record<Action, string> = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  skill1: 'Digit1',
  skill2: 'Digit2',
  skill3: 'Digit3',
  skill4: 'Digit4',
  racial: 'KeyR',
  interact: 'KeyE',
  dodge: 'Space',
  build: 'KeyB',
  nextWave: 'KeyN',
  pause: 'Escape',
};

export const ACTION_LABELS: Record<Action, string> = {
  up: 'Vorwärts',
  down: 'Rückwärts',
  left: 'Links',
  right: 'Rechts',
  skill1: 'Fähigkeit 1',
  skill2: 'Fähigkeit 2',
  skill3: 'Fähigkeit 3',
  skill4: 'Fähigkeit 4 (Signatur)',
  racial: 'Rassenfähigkeit',
  interact: 'Interagieren / Auf- & Absitzen',
  dodge: 'Ausweichen / Reittier-Ansturm',
  build: 'Baumodus',
  nextWave: 'Nächste Welle rufen',
  pause: 'Pause',
};

export const ACTION_ORDER: Action[] = ['up', 'down', 'left', 'right', 'skill1', 'skill2', 'skill3', 'skill4', 'racial', 'interact', 'dodge', 'build', 'nextWave', 'pause'];

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  const map: Record<string, string> = {
    Space: 'Leer',
    Escape: 'Esc',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift R',
    ControlLeft: 'Strg',
    ControlRight: 'Strg R',
    AltLeft: 'Alt',
    Tab: 'Tab',
    Enter: 'Enter',
    Backquote: '^',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    CapsLock: 'Caps',
  };
  return map[code] ?? code;
}
