'use server';

/**
 * @fileOverview A customer support chatbot that answers questions based on project documentation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getAllKnowledgeBaseArticlesAction } from '@/lib/actions';
import {
  ChatbotRequestSchema,
  ChatbotResponseSchema,
  type ChatbotRequest,
  type ChatbotResponse
} from './chatbot-flow-types';

// In-memory cache of knowledge-base articles. We subscribe to updates from the data-store
let kbCache: { id: number; title: string; content: string }[] = [];
let kbInitialized = false;

const initializeKbCache = async () => {
  if (kbInitialized) return;
  try {
    const { data: articles, error } = await getAllKnowledgeBaseArticlesAction();
    if (articles && !error) {
      kbCache = articles.map((a: any) => ({ id: a.id, title: a.title || '', content: a.content || '' }));
    } else {
      console.warn('Failed to fetch KB articles', error);
      kbCache = [];
    }
  } catch (e) {
    console.warn('Failed to initialize KB cache', e);
    kbCache = [];
  }
  kbInitialized = true;
};

// Simple retrieval: score articles by token overlap with query and return top N as context
const retrieveRelevantArticles = (query: string, topN = 3) => {
  if (!kbCache || kbCache.length === 0) return [];
  const q = (query || '').toLowerCase();
  const qTokens = q.split(/\W+/).filter(Boolean);

  const scored = kbCache.map(a => {
    const text = (a.title + ' ' + a.content).toLowerCase();
    let score = 0;
    for (const t of qTokens) {
      if (!t) continue;
      const safe = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const occurrences = (text.match(new RegExp(safe, 'g')) || []).length;
      score += occurrences * 2; // count exact token occurrences higher
      if (text.includes(t)) score += 1; // partial presence bonus
    }
    // small boost for title hits
    if (qTokens.some(t => (a.title || '').toLowerCase().includes(t))) score += 1;
    return { article: a, score };
  }).sort((a, b) => b.score - a.score);

  return scored.filter(s => s.score > 0).slice(0, topN);
};

// Build a compact context using the few most relevant articles for the user's query.
const getDocumentationContext = async (query?: string): Promise<string> => {
  try {
    await initializeKbCache();
    if (!kbCache || kbCache.length === 0) return 'No knowledge base articles found.';

    const relevant = query ? retrieveRelevantArticles(query, 3) : kbCache.slice(0, 3);
    if (!relevant || relevant.length === 0) return 'No relevant knowledge base articles found.';

    // `retrieveRelevantArticles` returns scored items { article, score } when a query is provided.
    const articles = (relevant as any[]).map(item => item.article ? item.article : item);
    const context = articles.map((article: any) => `Article Title: ${article.title}\nArticle Content:\n${article.content}`).join('\n\n---\n\n');
    return context;
  } catch (error) {
    console.error('Error building documentation context:', error);
    return 'The application documentation is currently unavailable.';
  }
};

const documentationChatbot = ai.definePrompt({
  name: 'documentationChatbot',
  input: { schema: z.object({ query: z.string(), context: z.string(), permissions: z.array(z.string()).optional() }) },
  output: { schema: ChatbotResponseSchema },
  system: `You are a helpful assistant for the AAWSA Billing Portal application. Your role is to answer user questions based ONLY on the provided knowledge base articles.

    - Be concise and clear in your answers.
    - If the answer is not in the knowledge base, say "I'm sorry, I don't have information about that in my knowledge base."
    - If the user has the 'knowledge_base_manage' permission, you can add this to your response when you don't know the answer: "If you have the answer, you can add it to the knowledge base to help others."
    - If the user asks about the internal workings of the company, respond with "I am sorry, I cannot answer that. I am not allowed to share information about the internal workings of the company."
    - Do not make up answers or provide information not found in the context.
    - Format your answers with markdown for readability (e.g., use bullet points for lists, bold for key terms).
    - The user is a staff member, so address them professionally.`,
  prompt: `Context from Knowledge Base Articles:
    {{{context}}}
    
    User's Question:
    "{{{query}}}"`,
});

const chatbotFlow = ai.defineFlow(
  {
    name: 'chatbotFlow',
    inputSchema: ChatbotRequestSchema,
    outputSchema: ChatbotResponseSchema,
  },
  async ({ query, permissions }) => {
    const context = await getDocumentationContext(query);

    const maxRetries = 3;
    let attempt = 0;
    let delay = 2000; // start with 2 seconds

    while (attempt < maxRetries) {
      try {
        // Quick local answer: if any relevant article contains the query text verbatim,
        // return a short snippet immediately without calling the AI model.
        try {
          const quickMatches = retrieveRelevantArticles(query, 3); // returns [{article,score}]
          if (quickMatches.length > 0 && quickMatches.some((m: any) => m.score > 0)) {
            // Build combined excerpt from top matches (prioritize highest score)
            const parts: string[] = [];
            for (const match of quickMatches) {
              if (!match || !match.article || match.score <= 0) continue;
              const art = match.article;
              const paragraphs = (art.content || '').split(/\n{1,2}/).map((p: string) => p.trim()).filter(Boolean);
              // find best paragraph by token match
              let best = '';
              let bestCount = -1;
              const tokens = query.split(/\W+/).filter(Boolean).map(t => t.toLowerCase());
              for (const p of paragraphs) {
                const lc = p.toLowerCase();
                const count = tokens.reduce((acc, t) => acc + (lc.includes(t) ? 1 : 0), 0);
                if (count > bestCount) { bestCount = count; best = p; }
              }
              if (!best) best = paragraphs[0] || (art.content || '').slice(0, 300);
              parts.push(`From Knowledge Base - ${art.title}:\n\n${best}`);
            }
            if (parts.length > 0) {
              return { answer: parts.join('\n\n---\n\n') } as any;
            }
          }
        } catch (e) {
          console.warn('Quick KB match failed:', e);
        }

        const response = await documentationChatbot({
          query,
          context,
          permissions,
        });

        if (!response || !response.output) {
          console.error("Chatbot AI response is missing output for query:", query);
          return { answer: "I'm sorry, I encountered an error and cannot answer at this time." };
        }

        return response.output;
      } catch (error: any) {
        if (error.message.includes('429')) {
          console.warn(`Rate limit exceeded. Retrying in ${delay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // exponential backoff
          attempt++;
        } else {
          throw error;
        }
      }
    }

    console.error("Chatbot AI failed after multiple retries for query:", query);
    return { answer: "I'm sorry, the service is currently busy. Please try again later." };
  }
);

// This is the exported function that the UI will call.
export async function askChatbot(input: ChatbotRequest): Promise<ChatbotResponse> {
  return chatbotFlow(input);
}