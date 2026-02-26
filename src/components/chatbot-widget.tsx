'use client';

import * as React from 'react';
import { Bot, Send, X, Loader2, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { askChatbot } from '@/ai/flows/chatbot-flow';
import type { ChatbotRequest, ChatbotResponse } from '@/ai/flows/chatbot-flow-types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';


import { usePermissions } from '@/hooks/use-permissions';


interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [query, setQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { permissions } = usePermissions();

  const handleToggle = () => {
    setIsOpen(prev => {
        // Add welcome message if opening for the first time
        if (!prev && messages.length === 0) {
            setMessages([
                { id: 'welcome', role: 'assistant', text: "Hello! How can I help you with the AAWSA Billing Portal today?" }
            ]);
        }
        return !prev;
    });
  };

  React.useEffect(() => {
    // Auto-scroll to the bottom when new messages are added
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMessage: Message = { id: `user-${Date.now()}`, role: 'user', text: query };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);

    try {
      const response = await askChatbot({ query, permissions: Array.from(permissions) });
      const assistantMessage: Message = { id: `assistant-${Date.now()}`, role: 'assistant', text: response.answer };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
        console.error("Chatbot query failed:", error);
        const errorMessage: Message = { id: `error-${Date.now()}`, role: 'assistant', text: "Sorry, I couldn't connect to the assistant. Please try again later." };
        setMessages(prev => [...prev, errorMessage]);
        toast({ variant: 'destructive', title: 'Chatbot Error', description: 'Failed to get a response.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className={cn("fixed bottom-4 right-4 z-50 transition-all duration-300", 
         isOpen ? "opacity-0 scale-90 pointer-events-none" : "opacity-100 scale-100"
      )}>
        <Button onClick={handleToggle} className="rounded-full h-16 w-16 shadow-lg" aria-label="Open Chatbot">
          <MessageSquareText className="h-8 w-8" />
        </Button>
      </div>

      <div className={cn("fixed bottom-4 right-4 z-50 transition-all duration-300", 
        !isOpen ? "opacity-0 scale-90 pointer-events-none" : "opacity-100 scale-100"
      )}>
        <Card className="w-[350px] h-[500px] shadow-2xl flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b p-4">
            <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2"><Bot className="h-5 w-5"/> AAWSA Support Bot</CardTitle>
                <CardDescription className="text-xs">Ask me questions about the portal.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleToggle} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={cn(
                    "flex items-start gap-3",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}>
                    {message.role === 'assistant' && (
                        <Avatar className="h-8 w-8">
                            <AvatarFallback>A</AvatarFallback>
                        </Avatar>
                    )}
                    <div className={cn(
                      "max-w-[80%] rounded-lg p-3 text-sm break-words",
                      message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}>
                      <p className="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: message.text.replace(/\n/g, '<br />') }} />
                    </div>
                  </div>
                ))}
                {isLoading && (
                     <div className="flex items-start gap-3 justify-start">
                        <Avatar className="h-8 w-8"><AvatarFallback>A</AvatarFallback></Avatar>
                        <div className="bg-muted p-3 rounded-lg"><Loader2 className="h-5 w-5 animate-spin"/></div>
                    </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <div className="border-t p-4">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !query.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </>
  );
}
