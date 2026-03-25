
"use client";

import * as React from "react";
import { PlusCircle, BookOpen, Search, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { KnowledgeBaseArticle } from "./knowledge-base-types";
import { KnowledgeBaseFormDialog, type KnowledgeBaseFormValues } from "./knowledge-base-form-dialog";
import { KnowledgeBaseTable } from "./knowledge-base-table";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { uploadPdfFile } from "@/lib/upload";
import { 
  getKnowledgeBaseArticles,
  addKnowledgeBaseArticle,
  updateKnowledgeBaseArticle,
  deleteKnowledgeBaseArticle,
  subscribeToKnowledgeBaseArticles,
  initializeKnowledgeBaseArticles,
} from "@/lib/data-store";

export default function KnowledgeBasePage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [articles, setArticles] = React.useState<KnowledgeBaseArticle[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedArticle, setSelectedArticle] = React.useState<KnowledgeBaseArticle | null>(null);
  const [articleToDelete, setArticleToDelete] = React.useState<KnowledgeBaseArticle | null>(null);
  
  const canManage = hasPermission('knowledge_base_manage');

  React.useEffect(() => {
    setIsLoading(true);
    initializeKnowledgeBaseArticles().then(() => {
      setArticles(getKnowledgeBaseArticles());
      setIsLoading(false);
    });
    
    const unsubscribe = subscribeToKnowledgeBaseArticles((updatedArticles) => {
      setArticles(updatedArticles);
      setIsLoading(false); 
    });
    return () => unsubscribe();
  }, []);

  const handleAddArticle = () => {
    setSelectedArticle(null);
    setIsFormOpen(true);
  };

  const handleEditArticle = (article: KnowledgeBaseArticle) => {
    setSelectedArticle(article);
    setIsFormOpen(true);
  };

  const handleDeleteArticle = (article: KnowledgeBaseArticle) => {
    setArticleToDelete(article);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (articleToDelete) {
      await deleteKnowledgeBaseArticle(articleToDelete.id);
      toast({ title: "Article Deleted", description: `"${articleToDelete.title}" has been removed.` });
      setArticleToDelete(null);
    }
    setIsDeleteDialogOpen(false);
  };

  const handleSubmitArticle = async (data: KnowledgeBaseFormValues) => {
    const { pdfFile, removePdf, ...articleData } = data;
    let pdf_url = selectedArticle?.pdf_url || null;

    try {
      if (pdfFile) {
        // Upload new PDF file
        pdf_url = await uploadPdfFile(pdfFile);
        toast({ title: "PDF Uploaded", description: "The PDF file has been successfully uploaded." });
      } else if (removePdf) {
        // Explicitly clear PDF URL
        pdf_url = null;
      }
      // If neither condition is met, original pdf_url (from selectedArticle or null) is preserved.

      const articleToSave = {
        ...articleData,
        pdf_url: pdf_url, 
      };

      if (selectedArticle) {
        await updateKnowledgeBaseArticle(selectedArticle.id, articleToSave);
        toast({ title: "Article Updated", description: `"${data.title}" has been updated.` });
      } else {
        await addKnowledgeBaseArticle(articleToSave); 
        toast({ title: "Article Added", description: `"${data.title}" has been added.` });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred during article submission.",
        variant: "destructive",
      });
      return; // Prevent dialog from closing on error
    }

    setIsFormOpen(false);
    setSelectedArticle(null);
  };

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (article.category && article.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  if (!canManage) {
      return (
          <div className="space-y-6">
              <h1 className="text-2xl md:text-3xl font-bold">Knowledge Base</h1>
              <Alert variant="destructive">
                  <Lock className="h-4 w-4" />
                  <AlertTitle>Access Denied</AlertTitle>
                  <CardDescription>You do not have permission to manage the knowledge base.</CardDescription>
              </Alert>
          </div>
      )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Knowledge Base Management</h1>
        <div className="flex w-full flex-col sm:flex-row items-center gap-2">
          <div className="relative w-full sm:w-auto flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search articles..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={handleAddArticle} className="w-full sm:w-auto flex-shrink-0">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Article
          </Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Article List</CardTitle>
          <CardDescription>Manage the information used by the support chatbot.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
              Loading articles...
            </div>
          ) : articles.length === 0 && !searchTerm ? (
             <div className="mt-4 p-8 border-2 border-dashed rounded-lg bg-muted/50 text-center">
                <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold">No Articles Found</h3>
                <p className="text-muted-foreground mt-1">Click &quot;Add New Article&quot; to build your knowledge base.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
                <KnowledgeBaseTable
                    data={filteredArticles}
                    onEdit={handleEditArticle}
                    onDelete={handleDeleteArticle}
                    canEdit={canManage}
                    canDelete={canManage}
                />
            </div>
          )}
        </CardContent>
      </Card>

      <KnowledgeBaseFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmitArticle}
        defaultValues={selectedArticle}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the article &quot;{articleToDelete?.title}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setArticleToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
