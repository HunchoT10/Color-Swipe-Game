export type GameMode = 'NORMAL' | 'HARD' | 'INSANE';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type ColorKey = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW';

export interface Challenge {
  blockColor: ColorKey;
  textColor: ColorKey; // For Hard mode distraction
  requiredDirection: Direction;
  // For Insane mode sequential challenges
  sequence?: {
    color: ColorKey;
    direction: Direction;
    id: string; // unique id for rendering
  }[];
}

export interface ScoreEntry {
  username: string;
  score: number;
  mode: GameMode;
  created_at?: string;
}

export interface GameState {
  score: number;
  highScore: number;
  isGameOver: boolean;
  isPlaying: boolean;
  timeLeft: number;
  mode: GameMode;
  gameOverReason: string;
}