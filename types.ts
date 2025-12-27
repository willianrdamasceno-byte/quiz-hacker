
export enum Difficulty {
  BASIC = 'BASIC',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED'
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizState {
  currentQuestionIndex: number;
  score: number;
  questions: Question[];
  difficulty: Difficulty | null;
  isFinished: boolean;
  isLoading: boolean;
  error: string | null;
}

export type QuizAction = 
  | { type: 'START_QUIZ'; difficulty: Difficulty; questions: Question[] }
  | { type: 'ANSWER_QUESTION'; isCorrect: boolean }
  | { type: 'NEXT_QUESTION' }
  | { type: 'RESTART' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_LOADING'; loading: boolean };
