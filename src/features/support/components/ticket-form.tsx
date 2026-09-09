'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { createTicketAction, getTicketCategoriesAction } from '@/lib/support-actions';
import { getKnowledgeBaseArticles, initializeKnowledgeBaseArticles } from '@/lib/data-store';
import type { TicketCategory, TicketPriority } from '../types';
import { 
  Send, 
  Paperclip, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  X,
  ExternalLink,
  BookOpen,
  Sparkles,
  Loader2
} from 'lucide-react';

interface TicketFormProps {
  customerKey: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerType?: string;
  branchId?: string;
  branchName?: string;
  onSuccessRedirect?: string;
}

export function TicketForm({
  customerKey,
  customerName = '',
  customerPhone = '',
  customerEmail = '',
  customerType = 'individual',
  branchId,
  branchName,
  onSuccessRedirect = '/customer/support'
}: TicketFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState(customerPhone);
  const [email, setEmail] = useState(customerEmail);
  const [attachments, setAttachments] = useState<Array<{ fileUrl: string; fileName: string; fileSize?: number; fileType?: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Knowledge Base Deflection Suggestions (Phase 5)
  const [kbArticles, setKbArticles] = useState<any[]>([]);
  const [suggestedArticles, setSuggestedArticles] = useState<any[]>([]);
  const [autoSuggestedCategory, setAutoSuggestedCategory] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const catRes = await getTicketCategoriesAction();
      if (catRes.data) {
        setCategories(catRes.data);
        if (catRes.data.length > 0) setSelectedCategoryId(catRes.data[0].id);
      }

      await initializeKnowledgeBaseArticles();
      const articles = getKnowledgeBaseArticles();
      setKbArticles(articles);
    }
    loadData();
  }, []);

  // Smart suggestions & auto-categorization based on keywords in subject & description
  useEffect(() => {
    const text = `${subject} ${description}`.toLowerCase().trim();
    if (text.length < 5) {
      setSuggestedArticles([]);
      setAutoSuggestedCategory(null);
      return;
    }

    // Smart deflection matching
    const matched = kbArticles.filter(art => {
      const titleMatch = art.title?.toLowerCase().includes(text) || text.includes(art.title?.toLowerCase());
      const tagMatch = art.tags?.some((t: string) => text.includes(t.toLowerCase()));
      const contentMatch = art.content?.toLowerCase().includes(text.slice(0, 20));
      return titleMatch || tagMatch || contentMatch;
    }).slice(0, 3);

    setSuggestedArticles(matched);

    // Auto Category inference
    if (text.includes('bill') || text.includes('tariff') || text.includes('charge') || text.includes('payment') || text.includes('dispute')) {
      const cat = categories.find(c => c.name.toLowerCase().includes('billing'));
      if (cat && selectedCategoryId !== cat.id) setAutoSuggestedCategory(cat.name);
    } else if (text.includes('leak') || text.includes('meter') || text.includes('broken') || text.includes('reading') || text.includes('dial')) {
      const cat = categories.find(c => c.name.toLowerCase().includes('meter'));
      if (cat && selectedCategoryId !== cat.id) setAutoSuggestedCategory(cat.name);
    } else if (text.includes('quality') || text.includes('dirty') || text.includes('smell') || text.includes('pressure') || text.includes('color')) {
      const cat = categories.find(c => c.name.toLowerCase().includes('quality'));
      if (cat && selectedCategoryId !== cat.id) setAutoSuggestedCategory(cat.name);
    } else {
      setAutoSuggestedCategory(null);
    }
  }, [subject, description, kbArticles, categories, selectedCategoryId]);

  const handleApplySuggestedCategory = (catName: string) => {
    const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
    if (cat) {
      setSelectedCategoryId(cat.id);
      setAutoSuggestedCategory(null);
      toast({ title: 'Category Updated', description: `Set to ${cat.name}` });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Simulate file upload or use existing upload handler
    const file = files[0];
    const fakeUrl = URL.createObjectURL(file);
    setAttachments(prev => [
      ...prev,
      {
        fileUrl: fakeUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
      }
    ]);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) {
      toast({ title: 'Validation Error', description: 'Please select a ticket category', variant: 'destructive' });
      return;
    }
    if (subject.trim().length < 3) {
      toast({ title: 'Validation Error', description: 'Subject must be at least 3 characters', variant: 'destructive' });
      return;
    }
    if (description.trim().length < 10) {
      toast({ title: 'Validation Error', description: 'Description must be at least 10 characters', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const selectedCategory = categories.find(c => c.id === selectedCategoryId);

    const raw = typeof window !== 'undefined' ? localStorage.getItem('customer') : null;
    const sessionObj = raw ? JSON.parse(raw) : null;
    const sessionId = sessionObj?.sessionId;

    const res = await createTicketAction({
      customerKey,
      customerName,
      customerPhone: phone || undefined,
      customerEmail: email || undefined,
      customerType,
      branchId,
      branchName,
      categoryId: selectedCategoryId,
      categoryName: selectedCategory?.name,
      priority,
      subject,
      description,
      attachments,
    }, sessionId);

    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: 'Submission Failed',
        description: res.error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Ticket Submitted Successfully!',
        description: `Your ticket #${res.data?.ticketNumber} has been logged. Our support team will respond shortly.`,
      });
      router.push(onSuccessRedirect);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Ticket Form */}
      <div className="lg:col-span-2">
        <Card className="shadow-lg border-blue-100 bg-white">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-lg">
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-200" />
              Submit Customer Support Ticket
            </CardTitle>
            <CardDescription className="text-blue-100">
              Report billing issues, meter faults, service requests, or water quality complaints directly to AAWSA support.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 pt-6">
              {/* Customer summary banner */}
              <div className="bg-blue-50/60 p-4 rounded-lg border border-blue-200 flex flex-wrap items-center justify-between gap-3 text-sm text-blue-900">
                <div>
                  <span className="font-semibold">Customer:</span> {customerName || 'Registered Customer'} ({customerKey})
                </div>
                {branchName && (
                  <div>
                    <span className="font-semibold">Branch:</span> {branchName}
                  </div>
                )}
                {customerPhone && (
                  <div>
                    <span className="font-semibold">Phone:</span> {customerPhone}
                  </div>
                )}
              </div>

              {/* Category and Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category" className="font-semibold text-gray-700">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={selectedCategoryId ? String(selectedCategoryId) : ''}
                    onValueChange={(val) => setSelectedCategoryId(Number(val))}
                  >
                    <SelectTrigger id="category" className="bg-gray-50 border-gray-300">
                      <SelectValue placeholder="Select Issue Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {autoSuggestedCategory && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-indigo-600 font-medium">
                      <Sparkles className="h-3.5 w-3.5" />
                      Suggested: <strong>{autoSuggestedCategory}</strong>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-indigo-700 underline"
                        onClick={() => handleApplySuggestedCategory(autoSuggestedCategory)}
                      >
                        Apply
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority" className="font-semibold text-gray-700">
                    Priority Level
                  </Label>
                  <Select value={priority} onValueChange={(val) => setPriority(val as TicketPriority)}>
                    <SelectTrigger id="priority" className="bg-gray-50 border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low (General Inquiry)</SelectItem>
                      <SelectItem value="Medium">Medium (Standard Request)</SelectItem>
                      <SelectItem value="High">High (Service Disruption)</SelectItem>
                      <SelectItem value="Urgent">Urgent (Major Leak / Emergency)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contact Information (Phone & Email) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="callback-phone" className="font-semibold text-gray-700">
                    Contact Phone (for SMS / Call Updates)
                  </Label>
                  <Input
                    id="callback-phone"
                    placeholder="e.g. 0911234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-gray-50 border-gray-300 focus:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="callback-email" className="font-semibold text-gray-700">
                    Email Address (Optional)
                  </Label>
                  <Input
                    id="callback-email"
                    type="email"
                    placeholder="e.g. customer@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-gray-50 border-gray-300 focus:bg-white"
                  />
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject" className="font-semibold text-gray-700">
                  Subject / Summary <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="subject"
                  placeholder="e.g. Disputed high consumption bill for Meskerem 2018"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="bg-gray-50 border-gray-300 focus:bg-white"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="font-semibold text-gray-700">
                  Detailed Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  rows={6}
                  placeholder="Please describe the issue in detail (e.g. date observed, meter number, meter reading value, specific location, or previous reference numbers)..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-gray-50 border-gray-300 focus:bg-white resize-y"
                  required
                />
              </div>

              {/* Attachments */}
              <div className="space-y-3">
                <Label className="font-semibold text-gray-700 flex items-center justify-between">
                  <span>Attachments (Photos of meter, bill copy, or receipts)</span>
                  <span className="text-xs text-gray-500">Optional</span>
                </Label>

                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition">
                    <Paperclip className="h-4 w-4 text-gray-500" />
                    <span>Choose File</span>
                    <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx" />
                  </label>
                  <span className="text-xs text-gray-500">PNG, JPG, PDF up to 10MB</span>
                </div>

                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {attachments.map((att, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-2 py-1 px-3 bg-blue-50 text-blue-800 border-blue-200">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="max-w-[180px] truncate">{att.fileName}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(idx)}
                          className="hover:text-red-600 ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="bg-gray-50 border-t px-6 py-4 flex justify-between items-center rounded-b-lg">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting Ticket...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit Ticket
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      {/* Right Sidebar: Knowledge Base Deflection & Help */}
      <div className="space-y-6">
        {suggestedArticles.length > 0 && (
          <Card className="border-indigo-200 bg-indigo-50/40 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-indigo-900 font-semibold text-sm">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                Helpful Articles Before Submitting
              </div>
              <CardDescription className="text-xs text-indigo-700">
                You might find an instant answer in our knowledge base:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {suggestedArticles.map((art) => (
                <div key={art.id} className="p-3 bg-white rounded-md border border-indigo-100 shadow-xs">
                  <div className="font-semibold text-sm text-gray-900 line-clamp-1">{art.title}</div>
                  <p className="text-xs text-gray-600 line-clamp-2 mt-1">{art.summary || art.content}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-blue-100 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-blue-600" />
              Service Level Agreement (SLA)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-3 text-gray-600">
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-red-600">Urgent:</span>
              <span>1 hr response / 8 hrs resolution</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-orange-600">High:</span>
              <span>2 hrs response / 16 hrs resolution</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-blue-600">Medium:</span>
              <span>4 hrs response / 24 hrs resolution</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-600">Low:</span>
              <span>8 hrs response / 48 hrs resolution</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 bg-gray-50/70">
          <CardContent className="p-4 text-xs text-gray-600 space-y-2">
            <div className="font-semibold text-gray-800 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              What happens next?
            </div>
            <p>1. An automatic SMS & portal acknowledgment is issued.</p>
            <p>2. The ticket is assigned to a customer service officer in your branch.</p>
            <p>3. You can track progress and reply to staff in the <strong>My Tickets</strong> section.</p>
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-blue-50/40">
          <CardContent className="p-4 text-xs text-blue-900 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              24/7 Emergency Hotline
            </div>
            <p className="text-[11px] text-blue-800">For major pipe bursts, main line leakage, or urgent emergencies, call <strong>906</strong> toll-free.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
