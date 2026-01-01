import { COLORS, COLOR_TO_DIRECTION, CSS_COLORS } from '../constants';
import type { Challenge, GameMode, Direction, ColorKey } from '../types';

export interface SwipeRequirement {
  direction: Direction;
  id: string;
}

export interface GeneratedChallenge {
  challenge: Challenge;
  requiredSwipes: SwipeRequirement[];
  timerBarColor: string;
}

export function generateChallenge(mode: GameMode): GeneratedChallenge {
  let requiredSwipes: SwipeRequirement[] = [];
  let nextChallenge: Challenge;
  let nextTimerColor = '#fff';

  if (mode === 'INSANE') {
    const seq = [0, 1].map((i) => {
      const c: ColorKey = COLORS[Math.floor(Math.random() * COLORS.length)];
      return {
        color: c,
        direction: COLOR_TO_DIRECTION[c],
        id: `insane-${Date.now()}-${i}`
      };
    });

    nextChallenge = {
      blockColor: seq[0].color, // placeholder to satisfy type
      textColor: seq[0].color,
      requiredDirection: seq[0].direction,
      sequence: seq
    };

    requiredSwipes = seq.map((s) => ({ direction: s.direction, id: s.id }));

    const randomColorIdx = Math.floor(Math.random() * COLORS.length);
    nextTimerColor = CSS_COLORS[COLORS[randomColorIdx]];
  } else {
    const blockColorIdx = Math.floor(Math.random() * COLORS.length);
    const blockColor = COLORS[blockColorIdx];

    let textColor: ColorKey = blockColor;
    nextTimerColor = CSS_COLORS[blockColor];

    if (mode === 'HARD') {
      if (Math.random() < 0.6) {
        let conflictingColor: ColorKey;
        do {
          conflictingColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        } while (conflictingColor === blockColor);
        textColor = conflictingColor;
      }
      const randomColorIdx = Math.floor(Math.random() * COLORS.length);
      nextTimerColor = CSS_COLORS[COLORS[randomColorIdx]];
    }

    nextChallenge = {
      blockColor,
      textColor,
      requiredDirection: COLOR_TO_DIRECTION[blockColor]
    };

    requiredSwipes = [{ direction: COLOR_TO_DIRECTION[blockColor], id: 'single' }];
  }

  return { challenge: nextChallenge, requiredSwipes, timerBarColor: nextTimerColor };
}
