
import React, { useReducer, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// ==========================================
// 1. TIPAGEM E INTERFACES
// ==========================================
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

// ==========================================
// 2. SERVIÇO DE ÁUDIO (SINTETIZADO)
// ==========================================
class AudioService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  playClick() {
    const ctx = this.init();
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
    const ctx = this.init();
    const now = ctx.currentTime;
    [523, 659, 783].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(f, now + i * 0.08);
      gain.gain.setValueAtTime(0.1, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.3);
    });
  }

  playIncorrect() {
    const ctx = this.init();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  }

  playProcessing() {
    const ctx = this.init();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(1200 + Math.random() * 200, ctx.currentTime);
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.02);
  }

  playFinish() {
    const ctx = this.init();
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 1);
  }
}

const audio = new AudioService();

// ==========================================
// 3. INTEGRAÇÃO COM GEMINI API
// ==========================================
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const fetchQuizQuestions = async (difficulty: Difficulty): Promise<Question[]> => {
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
      contents: `Gere 5 perguntas de informática nível ${difficulty} em Português. Formato JSON estrito. Temas: hardware, redes, segurança, algoritmos.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    return JSON.parse(response.text).questions;
  } catch (error) {
    console.error("API Error:", error);
    return getFallbacks(difficulty);
  }
};

const getFallbacks = (diff: Difficulty): Question[] => {
  const fallbacks: Record<string, Question[]> = {
    [Difficulty.BASIC]: [{ id: "b1", question: "O que é CPU?", options: ["Unidade de Processamento", "Placa de Vídeo", "Monitor", "Memória RAM"], correctIndex: 0, explanation: "CPU é o cérebro do computador." }],
    [Difficulty.INTERMEDIATE]: [{ id: "i1", question: "Qual o porto padrão do HTTP?", options: ["443", "21", "80", "22"], correctIndex: 2, explanation: "HTTP usa a porta 80 por padrão." }],
    [Difficulty.ADVANCED]: [{ id: "a1", question: "Complexidade média do Merge Sort?", options: ["O(n)", "O(n log n)", "O(n^2)", "O(1)"], correctIndex: 1, explanation: "Merge Sort é O(n log n) em todos os casos." }]
  };
  return fallbacks[diff] || fallbacks[Difficulty.BASIC];
};

// ==========================================
// 4. COMPONENTES DE UI
// ==========================================
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
    <div className="w-full mb-8">
      <div className="flex justify-between text-[10px] text-hacker-green/60 uppercase mb-1 font-mono">
        <span>Pacote: {current}/{total}</span>
        <span>Integridade: {pct}%</span>
      </div>
      <div className="h-2 bg-hacker-dark border border-hacker-green relative">
        <div className="h-full bg-hacker-green shadow-[0_0_10px_#00ff41] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ==========================================
// 5. LÓGICA DA APLICAÇÃO (APP)
// ==========================================
const initialState: QuizState = {
  currentQuestionIndex: 0, score: 0, questions: [], difficulty: null, isFinished: false, isLoading: false, error: null
};

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
      interval = window.setInterval(() => audio.playProcessing(), 1000);
    }
    return () => clearInterval(interval);
  }, [state.isLoading]);

  useEffect(() => { if (state.isFinished) audio.playFinish(); }, [state.isFinished]);

  const startQuiz = async (diff: Difficulty) => {
    audio.playClick();
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const questions = await fetchQuizQuestions(diff);
      dispatch({ type: 'START_QUIZ', difficulty: diff, questions });
    } catch {
      audio.playIncorrect();
      dispatch({ type: 'SET_ERROR', error: 'ERRO NA MATRIZ DE DADOS.' });
    }
  };

  const handleAnswer = (idx: number) => {
    if (revealed) return;
    const isCorrect = idx === state.questions[state.currentQuestionIndex].correctIndex;
    isCorrect ? audio.playCorrect() : audio.playIncorrect();
    setSelected(idx);
    setRevealed(true);
    dispatch({ type: 'ANSWER_QUESTION', isCorrect });
  };

  const handleNext = () => {
    audio.playClick();
    setRevealed(false);
    setSelected(null);
    dispatch({ type: 'NEXT_QUESTION' });
  };

  const current = state.questions[state.currentQuestionIndex];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-hacker-dark relative overflow-hidden font-mono">
      {/* Scanline & Glitch Background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none animate-scanline">
        {Array.from({length: 40}).map((_, i) => (
          <div key={i} className="whitespace-nowrap text-[8px] leading-[8px]">{Math.random().toString(2).repeat(10)}</div>
        ))}
      </div>

      <div className="z-10 w-full max-w-xl border-2 border-hacker-green bg-hacker-dark/90 p-6 md:p-8 shadow-[0_0_40px_rgba(0,255,65,0.15)] backdrop-blur-sm relative">
        <div className="flex justify-between items-center mb-6 border-b border-hacker-green/20 pb-2 text-[10px] opacity-40">
          <span>SESSÃO: {Math.random().toString(36).substring(7).toUpperCase()}</span>
          <span>ROOT@CYBER_LABS</span>
        </div>

        {/* HOME */}
        {!state.difficulty && !state.isLoading && (
          <div className="text-center py-6">
            <GlitchText text="CYBER_QUIZ.v4" as="h1" className="text-4xl md:text-5xl font-bold mb-8" />
            <p className="text-hacker-green/60 text-sm mb-10 italic">Inicie o protocolo de teste para prosseguir...</p>
            <div className="space-y-4">
              {Object.values(Difficulty).map(d => (
                <button key={d} onClick={() => startQuiz(d)} className="w-full group relative p-4 border border-hacker-green hover:bg-hacker-green hover:text-hacker-dark transition-all duration-300 overflow-hidden font-bold tracking-widest uppercase">
                  <span className="relative z-10">{d} LEVEL</span>
                  <div className="absolute inset-0 bg-hacker-green transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LOADING */}
        {state.isLoading && (
          <div className="text-center py-16 animate-pulse">
            <div className="inline-block border border-hacker-green p-4 uppercase tracking-[0.3em]">Descriptografando...</div>
            <div className="mt-4 text-[10px] opacity-40">Acessando mainframe remoto...</div>
          </div>
        )}

        {/* ERROR */}
        {state.error && (
          <div className="text-center py-10">
            <GlitchText text="FALHA CRÍTICA" className="text-2xl text-red-500 mb-6" />
            <button onClick={() => dispatch({type: 'RESTART'})} className="px-6 py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white uppercase transition-colors">Reiniciar Terminal</button>
          </div>
        )}

        {/* QUIZ */}
        {state.difficulty && !state.isFinished && !state.isLoading && current && (
          <div className="animate-in fade-in duration-700">
            <ProgressBar current={state.currentQuestionIndex + 1} total={state.questions.length} />
            <div className="mb-8 p-4 bg-hacker-muted/20 border-l-2 border-hacker-green">
              <h2 className="text-lg md:text-xl leading-relaxed">
                <span className="text-hacker-green/40 mr-2">#&gt;</span>
                {current.question}
              </h2>
            </div>
            <div className="space-y-3 mb-8">
              {current.options.map((opt, i) => {
                const isCorrect = i === current.correctIndex;
                const isSelected = selected === i;
                let cls = "w-full text-left p-4 border transition-all text-sm group flex items-center ";
                if (!revealed) cls += "border-hacker-green hover:bg-hacker-green/10";
                else if (isCorrect) cls += "border-hacker-green bg-hacker-green/20 text-hacker-green shadow-[0_0_10px_#00ff41]";
                else if (isSelected) cls += "border-red-500 bg-red-500/10 text-red-500";
                else cls += "border-hacker-green/10 opacity-30";

                return (
                  <button key={i} disabled={revealed} onClick={() => handleAnswer(i)} className={cls}>
                    <span className="w-8 h-8 flex items-center justify-center border border-current mr-4 shrink-0 opacity-60 text-xs">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {revealed && (
              <div className="animate-in slide-in-from-bottom-4 duration-500">
                <div className="p-3 bg-hacker-muted/10 border border-hacker-green/20 text-[11px] mb-6 italic">
                  <span className="font-bold text-hacker-green uppercase mr-2">[INFO]:</span>
                  {current.explanation}
                </div>
                <button onClick={handleNext} className="w-full py-4 bg-hacker-green text-hacker-dark font-black tracking-widest uppercase hover:brightness-110 active:scale-[0.98] transition-all">
                  Próximo Bloco &gt;
                </button>
              </div>
            )}
          </div>
        )}

        {/* RESULTS */}
        {state.isFinished && (
          <div className="text-center py-6 animate-in zoom-in-95 duration-500">
            <GlitchText text="TESTE FINALIZADO" as="h2" className="text-3xl font-bold mb-8" />
            <div className="inline-block p-10 border-4 border-hacker-green mb-8 relative">
              <div className="text-6xl font-black">{state.score}/{state.questions.length}</div>
              <div className="text-[10px] tracking-[0.2em] uppercase mt-2 opacity-60">SCORE DE ACURÁCIA</div>
              <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-hacker-green" />
              <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-hacker-green" />
            </div>
            <p className="text-sm uppercase tracking-widest mb-10 text-hacker-green/80 leading-loose">
              {state.score === state.questions.length 
                ? "Acesso Total Concedido. Nível de Usuário: ELITE." 
                : state.score >= state.questions.length / 2 
                  ? "Acesso Parcial. Recomendado Reforço na Matriz." 
                  : "Acesso Negado. Reinicie o Módulo de Aprendizado."}
            </p>
            <button onClick={() => dispatch({type: 'RESTART'})} className="px-10 py-4 border border-hacker-green hover:bg-hacker-green hover:text-hacker-dark transition-all font-bold uppercase tracking-widest text-xs">Resetar Terminal</button>
          </div>
        )}

        <div className="mt-10 pt-4 border-t border-hacker-green/10 flex justify-between text-[9px] text-hacker-green/30 font-mono">
          <span>CONEXÃO SEGURA: AES-256</span>
          <span>© 2024 CYBER_SECURITY_SYSTEM</span>
        </div>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
