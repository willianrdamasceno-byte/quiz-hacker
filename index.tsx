
import React, { useReducer, useEffect, useCallback, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES & INTERFACES ---
enum Difficulty {
  BASIC = 'BASIC',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED'
}

interface Question {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizState {
  currentQuestionIndex: number;
  score: number;
  questions: Question[];
  difficulty: Difficulty | null;
  isFinished: boolean;
  isLoading: boolean;
  error: string | null;
}

type QuizAction = 
  | { type: 'START_QUIZ'; difficulty: Difficulty; questions: Question[] }
  | { type: 'ANSWER_QUESTION'; isCorrect: boolean }
  | { type: 'NEXT_QUESTION' }
  | { type: 'RESTART' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_LOADING'; loading: boolean };

// --- AUDIO SERVICE ---
class AudioService {
  private ctx: AudioContext | null = null;

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playClick() {
    const ctx = this.initContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  playCorrect() {
    const ctx = this.initContext();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.1, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.3);
    });
  }

  playIncorrect() {
    const ctx = this.initContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.3);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(now + 0.3);
  }

  playProcessing() {
    const ctx = this.initContext();
    const now = ctx.currentTime;
    const playTick = (time: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200 + Math.random() * 200, time);
      gain.gain.setValueAtTime(0.02, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.02);
    };
    for(let i = 0; i < 5; i++) playTick(now + i * 0.1);
  }

  playFinish() {
    const ctx = this.initContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.5);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(now + 1);
  }
}

const audio = new AudioService();

// --- GEMINI SERVICE ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const fetchQuestions = async (difficulty: Difficulty): Promise<Question[]> => {
  const schema = {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 4, maxItems: 4 },
            correctIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING }
          },
          required: ["id", "question", "options", "correctIndex", "explanation"]
        }
      }
    },
    required: ["questions"]
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate 5 computer science multiple choice questions in Portuguese for a ${difficulty} level quiz. Format as JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    return JSON.parse(response.text).questions;
  } catch (error) {
    console.error(error);
    return getFallbacks(difficulty);
  }
};

const getFallbacks = (diff: Difficulty): Question[] => {
  const data: Record<string, Question[]> = {
    [Difficulty.BASIC]: [{ id: "b1", question: "O que é CPU?", options: ["Cérebro", "Memória", "Mouse", "Teclado"], correctIndex: 0, explanation: "Unidade Central de Processamento." }],
    [Difficulty.INTERMEDIATE]: [{ id: "i1", question: "O que é HTTP?", options: ["Protocolo", "Hardware", "Cabo", "Monitor"], correctIndex: 0, explanation: "Protocolo de transferência de hipertexto." }],
    [Difficulty.ADVANCED]: [{ id: "a1", question: "Qual a complexidade do QuickSort?", options: ["O(n)", "O(n log n)", "O(n^2)", "O(1)"], correctIndex: 1, explanation: "Média de O(n log n)." }]
  };
  return data[diff] || data[Difficulty.BASIC];
};

// --- COMPONENTS ---
const GlitchText: React.FC<{ text: string, className?: string, as?: any }> = ({ text, className = "", as: Tag = 'span' }) => (
  <div className={`relative inline-block ${className}`}>
    <Tag className="relative z-10">{text}</Tag>
    <Tag className="absolute top-0 left-0 -z-10 text-hacker-glitch1 opacity-70 animate-glitch-text translate-x-[2px]" aria-hidden="true">{text}</Tag>
    <Tag className="absolute top-0 left-0 -z-10 text-hacker-glitch2 opacity-70 animate-glitch-text -translate-x-[2px]" aria-hidden="true">{text}</Tag>
  </div>
);

const ProgressBar: React.FC<{ current: number, total: number }> = ({ current, total }) => {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between mb-1 text-[10px] text-hacker-green/70 uppercase font-mono">
        <span>Progress: {current}/{total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-hacker-dark border border-hacker-green relative overflow-hidden">
        <div className="h-full bg-hacker-green transition-all duration-500 shadow-[0_0_8px_#00ff41]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// --- APP LOGIC ---
const initialState: QuizState = { currentQuestionIndex: 0, score: 0, questions: [], difficulty: null, isFinished: false, isLoading: false, error: null };

function reducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, isLoading: action.loading, error: null };
    case 'SET_ERROR': return { ...state, error: action.error, isLoading: false };
    case 'START_QUIZ': return { ...state, difficulty: action.difficulty, questions: action.questions, isLoading: false, currentQuestionIndex: 0, score: 0, isFinished: false };
    case 'ANSWER_QUESTION': return { ...state, score: action.isCorrect ? state.score + 1 : state.score };
    case 'NEXT_QUESTION': 
      if (state.currentQuestionIndex + 1 >= state.questions.length) return { ...state, isFinished: true };
      return { ...state, currentQuestionIndex: state.currentQuestionIndex + 1 };
    case 'RESTART': return initialState;
    default: return state;
  }
}

const App: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let interval: number;
    if (state.isLoading) {
      audio.playProcessing();
      interval = window.setInterval(() => audio.playProcessing(), 1200);
    }
    return () => clearInterval(interval);
  }, [state.isLoading]);

  useEffect(() => { if (state.isFinished) audio.playFinish(); }, [state.isFinished]);

  const start = async (diff: Difficulty) => {
    audio.playClick();
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const qs = await fetchQuestions(diff);
      dispatch({ type: 'START_QUIZ', difficulty: diff, questions: qs });
    } catch {
      audio.playIncorrect();
      dispatch({ type: 'SET_ERROR', error: 'Falha na conexão com o mainframe.' });
    }
  };

  const answer = (idx: number) => {
    if (revealed) return;
    const correct = idx === state.questions[state.currentQuestionIndex].correctIndex;
    correct ? audio.playCorrect() : audio.playIncorrect();
    setSelected(idx);
    setRevealed(true);
    dispatch({ type: 'ANSWER_QUESTION', isCorrect: correct });
  };

  const next = () => {
    audio.playClick();
    setRevealed(false);
    setSelected(null);
    dispatch({ type: 'NEXT_QUESTION' });
  };

  const current = state.questions[state.currentQuestionIndex];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-hacker-dark relative overflow-hidden font-mono">
      <div className="absolute inset-0 opacity-5 pointer-events-none text-[8px] animate-scanline">
        {Array.from({length: 20}).map((_,i) => <div key={i}>{Math.random().toString(2).repeat(50)}</div>)}
      </div>

      <div className="z-10 w-full max-w-xl border-2 border-hacker-green p-6 md:p-8 bg-hacker-dark/90 shadow-[0_0_30px_rgba(0,255,65,0.15)] backdrop-blur">
        <div className="flex justify-between items-center mb-6 border-b border-hacker-green/20 pb-2 text-[10px] opacity-50">
          <span>TERMINAL_ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
          <span>ROOT@CYBER_QUIZ</span>
        </div>

        {!state.difficulty && !state.isLoading && (
          <div className="text-center animate-flicker">
            <GlitchText text="CYBER_QUIZ" as="h1" className="text-4xl md:text-5xl font-bold mb-8" />
            <div className="space-y-3">
              {Object.values(Difficulty).map(d => (
                <button key={d} onClick={() => start(d)} className="w-full p-3 border border-hacker-green hover:bg-hacker-green hover:text-hacker-dark transition-all uppercase tracking-widest font-bold">
                  {d} LEVEL
                </button>
              ))}
            </div>
          </div>
        )}

        {state.isLoading && (
          <div className="text-center py-12">
            <div className="inline-block border border-hacker-green p-4 animate-pulse uppercase">Acessando Banco de Dados...</div>
          </div>
        )}

        {state.error && (
          <div className="text-center py-8">
            <div className="text-red-500 mb-4">{state.error}</div>
            <button onClick={() => dispatch({type:'RESTART'})} className="px-4 py-2 border border-red-500 text-red-500 uppercase text-xs">Reboot</button>
          </div>
        )}

        {state.difficulty && !state.isFinished && !state.isLoading && current && (
          <div className="animate-in fade-in duration-500">
            <ProgressBar current={state.currentQuestionIndex + 1} total={state.questions.length} />
            <div className="mb-6 text-lg md:text-xl border-l-2 border-hacker-green pl-4">
              <span className="text-hacker-green opacity-40 mr-2">#</span>
              {current.question}
            </div>
            <div className="space-y-2 mb-6">
              {current.options.map((opt, i) => {
                const isSel = selected === i;
                const isCor = i === current.correctIndex;
                let cls = "w-full text-left p-3 border text-sm transition-colors ";
                if (!revealed) cls += "border-hacker-green hover:bg-hacker-green/10";
                else if (isCor) cls += "border-hacker-green bg-hacker-green/20 text-hacker-green";
                else if (isSel) cls += "border-red-500 bg-red-500/10 text-red-500";
                else cls += "border-hacker-green/20 opacity-40";

                return (
                  <button key={i} disabled={revealed} onClick={() => answer(i)} className={cls}>
                    <span className="mr-3 opacity-50">[{String.fromCharCode(65+i)}]</span> {opt}
                  </button>
                );
              })}
            </div>
            {revealed && (
              <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="text-[11px] text-hacker-green/70 bg-hacker-muted/10 p-2 border border-hacker-green/20">
                  <span className="font-bold mr-1">[INFO]:</span> {current.explanation}
                </div>
                <button onClick={next} className="w-full py-3 bg-hacker-green text-hacker-dark font-bold uppercase tracking-tighter shadow-[0_0_10px_#00ff41]">Próximo Pacote &gt;</button>
              </div>
            )}
          </div>
        )}

        {state.isFinished && (
          <div className="text-center py-6 animate-in zoom-in-95 duration-500">
            <GlitchText text="SCAN COMPLETO" as="h2" className="text-3xl font-bold mb-6" />
            <div className="inline-block p-6 border-2 border-hacker-green mb-6 shadow-[0_0_20px_rgba(0,255,65,0.1)]">
              <div className="text-5xl font-bold">{state.score}/{state.questions.length}</div>
              <div className="text-[10px] opacity-50 uppercase mt-2">Score de Integridade</div>
            </div>
            <p className="mb-8 text-sm opacity-80 uppercase tracking-widest">
              {state.score === state.questions.length ? "Acesso total concedido. Nível: Elite." : "Acesso parcial. Nível: Usuário."}
            </p>
            <button onClick={() => dispatch({type:'RESTART'})} className="px-8 py-3 border border-hacker-green hover:bg-hacker-green hover:text-hacker-dark transition-all uppercase text-sm font-bold">Relogar</button>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-hacker-green/10 text-[9px] text-hacker-green/20 flex justify-between uppercase">
          <span>AES-256 SECURE</span>
          <span>© 2024 SYSTEM_V3</span>
        </div>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
