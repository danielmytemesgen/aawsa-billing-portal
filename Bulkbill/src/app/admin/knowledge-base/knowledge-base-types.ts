
export interface KnowledgeBaseArticle {
  id: number;
  created_at: string;
  title: string;
  content: string;
  category?: string;
  keywords?: string[];
  pdf_url?: string;
}

export type KnowledgeBaseArticleInsert = Omit<KnowledgeBaseArticle, 'id' | 'created_at'>;
export type KnowledgeBaseArticleUpdate = Partial<KnowledgeBaseArticleInsert>;
