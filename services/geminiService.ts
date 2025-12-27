
import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, Question } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const QUESTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: { type: Type.STRING },
          options: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            minItems: 4,
            maxItems: 4
          },
          correctIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING }
        },
        required: ["id", "question", "options", "correctIndex", "explanation"]
      }
    }
  },
  required: ["questions"]
};

export const fetchQuizQuestions = async (difficulty: Difficulty): Promise<Question[]> => {
  try {
    const prompt = `Generate 5 challenging computer science multiple choice questions for a ${difficulty} level quiz. 
    Ensure the questions are technically accurate and cover diverse topics like hardware, programming, networking, security, and algorithms.
    Return the response strictly as JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA,
      },
    });

    const data = JSON.parse(response.text);
    return data.questions;
  } catch (error) {
    console.error("Error fetching questions:", error);
    // Fallback static questions in case of API failure
    return getFallbackQuestions(difficulty);
  }
};

function getFallbackQuestions(difficulty: Difficulty): Question[] {
  const fallbacks: Record<Difficulty, Question[]> = {
    [Difficulty.BASIC]: [
      {
        id: "b1",
        question: "O que significa CPU?",
        options: ["Central Processing Unit", "Computer Personal Unit", "Control Process Utility", "Core Programming Universal"],
        correctIndex: 0,
        explanation: "A CPU é o cérebro do computador, responsável por processar instruções."
      },
      {
        id: "b2",
        question: "Qual destes é um sistema operacional?",
        options: ["HTTP", "Linux", "HTML", "SSD"],
        correctIndex: 1,
        explanation: "Linux é um kernel que forma a base de muitos sistemas operacionais."
      }
    ],
    [Difficulty.INTERMEDIATE]: [
      {
        id: "i1",
        question: "O que é o protocolo HTTP?",
        options: ["HyperText Transfer Protocol", "High Tension Tech Process", "Home Tool Transfer Packet", "Hyper Transfer Terminal Post"],
        correctIndex: 0,
        explanation: "HTTP é a base da comunicação de dados na Web."
      }
    ],
    [Difficulty.ADVANCED]: [
      {
        id: "a1",
        question: "Qual a complexidade de tempo média de um QuickSort?",
        options: ["O(n)", "O(n log n)", "O(n^2)", "O(log n)"],
        correctIndex: 1,
        explanation: "QuickSort tem uma complexidade média de O(n log n)."
      }
    ]
  };
  return fallbacks[difficulty] || fallbacks[Difficulty.BASIC];
}
