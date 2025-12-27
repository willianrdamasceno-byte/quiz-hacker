
import React, { useReducer, useCallback } from 'react';
import { Difficulty, QuizState, QuizAction } from './types';
import { fetchQuizQuestions } from './services/geminiService';
import { GlitchText } from './components/GlitchText';
import { ProgressBar } from './components/ProgressBar';

const initialState: QuizState = {
  currentQuestionIndex: 0,
  score: 0,
  questions: [],
  difficulty: null,
  isFinished: false,
  isLoading: false,
  error: null,
};

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.loading, error: null };
    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false };
    case 'START_QUIZ':
      return { 
        ...state, 
        difficulty: action.difficulty, 
        questions: action.questions, 
        isLoading: false,
        currentQuestionIndex: 0,
        score: 0,
        isFinished: false
      };
    case 'ANSWER_QUESTION':
      return {
        ...state,
        score: action.isCorrect ? state.score + 1 : state.score
      };
    case 'NEXT_QUESTION':
      if (state.currentQuestionIndex + 1 >= state.questions.length) {
        return { ...state, isFinished: true };
      }
      return { ...state, currentQuestionIndex: state.currentQuestionIndex + 1 };
    case 'RESTART':
      return initialState;
    default:
      return state;
  }
}

const App: React.FC = () => {
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const [selectedOption, setSelectedOption] = React.useState<number | null>(null);
  const [isRevealed, setIsRevealed] = React.useState(false);

  const startQuiz = async (diff: Difficulty) => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const questions = await fetchQuizQuestions(diff);
      dispatch({ type: 'START_QUIZ', difficulty: diff, questions });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: 'System connection failure. Retrying...' });
    }
  };

  const handleAnswer = (index: number) => {
    if (isRevealed) return;
    setSelectedOption(index);
    setIsRevealed(true);
    const isCorrect = index === state.questions[state.currentQuestionIndex].correctIndex;
    dispatch({ type: 'ANSWER_QUESTION', isCorrect });
  };

  const handleNext = () => {
    setIsRevealed(false);
    setSelectedOption(null);
    dispatch({ type: 'NEXT_QUESTION' });
  };

  const currentQuestion = state.questions[state.currentQuestionIndex];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-hacker-dark relative overflow-hidden">
      {/* Background Matrix-like Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none text-[8px] leading-[8px] overflow-hidden whitespace-pre">
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} className="animate-scanline" style={{ animationDelay: `${i * 0.2}s` }}>
            {Math.random().toString(2).repeat(100)}
          </div>
        ))}
      </div>

      <div className="z-10 w-full max-w-2xl bg-hacker-dark/80 border-2 border-hacker-green p-6 md:p-10 shadow-[0_0_20px_rgba(0,255,65,0.2)] backdrop-blur-sm relative">
        {/* Terminal Header */}
        <div className="flex items-center justify-between mb-8 border-b border-hacker-green/30 pb-4">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/50 shadow-[0_0_8px_#00ff41]" />
          </div>
          <div className="text-hacker-green font-mono text-sm tracking-widest uppercase opacity-70">
            Node: 127.0.0.1 // User: Admin
          </div>
        </div>

        {/* Home Screen */}
        {!state.difficulty && !state.isLoading && (
          <div className="text-center animate-flicker">
            <GlitchText text="CYBER_QUIZ.v3" as="h1" className="text-4xl md:text-6xl font-bold mb-4" />
            <p className="mb-10 text-hacker-green/80 italic">Select difficulty to initialize terminal...</p>
            
            <div className="grid grid-cols-1 gap-4">
              {Object.values(Difficulty).map((diff) => (
                <button
                  key={diff}
                  onClick={() => startQuiz(diff)}
                  className="group relative p-4 border border-hacker-green hover:bg-hacker-green hover:text-hacker-dark transition-all duration-300 overflow-hidden"
                >
                  <span className="relative z-10 font-bold tracking-widest">{diff} LEVEL</span>
                  <div className="absolute inset-0 bg-hacker-green transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
                </button>
              ))}
            </div>
            
            <div className="mt-12 text-xs text-hacker-green/40 font-mono">
              [WARNING: ACCESSING PROTECTED DATAFRAME]
            </div>
          </div>
        )}

        {/* Loading State */}
        {state.isLoading && (
          <div className="text-center py-20">
            <div className="inline-block border-2 border-hacker-green p-4 animate-pulse">
              <GlitchText text="DECRYPTING DATA..." className="text-2xl" />
            </div>
            <div className="mt-8 flex justify-center gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div 
                  key={i} 
                  className="w-4 h-4 bg-hacker-green animate-bounce" 
                  style={{ animationDelay: `${i * 0.1}s` }} 
                />
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {state.error && (
          <div className="text-center py-20">
            <GlitchText text="SYSTEM ERROR" className="text-3xl text-red-500 mb-6" />
            <p className="text-red-400 mb-8">{state.error}</p>
            <button 
              onClick={() => dispatch({ type: 'RESTART' })}
              className="px-6 py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
            >
              RESET TERMINAL
            </button>
          </div>
        )}

        {/* Quiz In Progress */}
        {state.difficulty && !state.isFinished && !state.isLoading && currentQuestion && (
          <div>
            <ProgressBar 
              current={state.currentQuestionIndex + 1} 
              total={state.questions.length} 
            />
            
            <div className="mb-8 p-4 bg-hacker-muted/20 border-l-4 border-hacker-green">
              <h2 className="text-xl md:text-2xl leading-relaxed">
                <span className="text-hacker-green mr-2 opacity-50">&gt;</span>
                {currentQuestion.question}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-8">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = idx === currentQuestion.correctIndex;
                let btnClass = "text-left p-4 border transition-all duration-200 group flex items-center";
                
                if (!isRevealed) {
                  btnClass += " border-hacker-green hover:bg-hacker-green/10";
                } else {
                  if (isCorrect) {
                    btnClass += " border-hacker-green bg-hacker-green/20 text-hacker-green";
                  } else if (isSelected) {
                    btnClass += " border-red-500 bg-red-500/20 text-red-500";
                  } else {
                    btnClass += " border-hacker-green/20 opacity-50";
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={isRevealed}
                    onClick={() => handleAnswer(idx)}
                    className={btnClass}
                  >
                    <span className="w-8 h-8 flex items-center justify-center border border-current mr-4 shrink-0 font-mono">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="flex-grow">{option}</span>
                    {isRevealed && isCorrect && <span className="ml-2">✓</span>}
                    {isRevealed && isSelected && !isCorrect && <span className="ml-2">✗</span>}
                  </button>
                );
              })}
            </div>

            {isRevealed && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-4 bg-hacker-muted/10 border border-hacker-green/30 mb-6 text-sm italic">
                  <span className="font-bold text-hacker-green uppercase mr-2">Explanation:</span>
                  {currentQuestion.explanation}
                </div>
                <button
                  onClick={handleNext}
                  className="w-full py-4 bg-hacker-green text-hacker-dark font-bold tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all uppercase"
                >
                  {state.currentQuestionIndex + 1 === state.questions.length ? 'Finalize Scan' : 'Next Packet >'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results Screen */}
        {state.isFinished && (
          <div className="text-center py-8">
            <GlitchText text="SCAN_COMPLETE" as="h2" className="text-4xl font-bold mb-8" />
            
            <div className="inline-block relative p-10 border-4 border-hacker-green mb-10">
              <div className="text-6xl font-bold mb-2">
                {state.score}<span className="text-hacker-green/50 text-2xl">/{state.questions.length}</span>
              </div>
              <div className="text-sm tracking-widest uppercase opacity-70">Integrity Score</div>
              
              {/* Decorative corners */}
              <div className="absolute top-[-8px] left-[-8px] w-4 h-4 border-t-4 border-l-4 border-hacker-green" />
              <div className="absolute top-[-8px] right-[-8px] w-4 h-4 border-t-4 border-r-4 border-hacker-green" />
              <div className="absolute bottom-[-8px] left-[-8px] w-4 h-4 border-b-4 border-l-4 border-hacker-green" />
              <div className="absolute bottom-[-8px] right-[-8px] w-4 h-4 border-b-4 border-r-4 border-hacker-green" />
            </div>

            <div className="mb-10 text-hacker-green/80">
              {state.score === state.questions.length ? (
                <div className="text-xl font-bold text-hacker-green animate-pulse">SYSTEM ACCESS GRANTED. YOU ARE A PRO.</div>
              ) : state.score > state.questions.length / 2 ? (
                <div>PARTIAL ACCESS GRANTED. GOOD PROFICIENCY.</div>
              ) : (
                <div className="text-red-400">ACCESS DENIED. REBOOT AND RE-STUDY.</div>
              )}
            </div>

            <button
              onClick={() => dispatch({ type: 'RESTART' })}
              className="px-10 py-4 border border-hacker-green hover:bg-hacker-green hover:text-hacker-dark transition-all duration-300 font-bold uppercase tracking-widest"
            >
              Relog System
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-hacker-green/20 text-[10px] text-hacker-green/30 flex justify-between font-mono">
          <span>SECURE_CONNECTION: AES-256</span>
          <span>© 2024 CYBER_LABS</span>
        </div>
      </div>
    </div>
  );
};

export default App;
