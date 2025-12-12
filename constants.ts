import { ColorKey, Direction } from './types';

export const COLOR_TO_DIRECTION: Record<ColorKey, Direction> = {
  'RED': 'UP',
  'BLUE': 'LEFT',
  'GREEN': 'DOWN',
  'YELLOW': 'RIGHT'
};

export const COLORS = Object.keys(COLOR_TO_DIRECTION) as ColorKey[];

export const CSS_COLORS: Record<ColorKey, string> = {
  'RED': '#ff5f52',
  'BLUE': '#2a8bff',
  'GREEN': '#00ff88',
  'YELLOW': '#ffd700'
};

export const SUPABASE_URL = 'https://jhzsyzeiojuahoeqptvj.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoenN5emVpb2p1YWhvZXFwdHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNjY1NjcsImV4cCI6MjA4MDk0MjU2N30.4bUWDsZYo-pT4_K5uiby6q12RmtY1prSwHG54GknC-4';
export const SUPABASE_TABLE = 'scores';

export const BASE_HIGH_SCORE_KEY = 'ColorSwipeMatch_HighScore_';
export const USERNAME_KEY = 'ColorSwipe_Username';

export const SWIPE_THRESHOLD = 50;

// Time in ms
export const INITIAL_TIME_LIMIT_NORMAL = 1500;
export const INITIAL_TIME_LIMIT_HARD = 1200;
export const INITIAL_TIME_LIMIT_INSANE = 1300;
export const MIN_TIME_LIMIT = 300; // Hard cap