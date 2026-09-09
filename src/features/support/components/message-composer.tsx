'use client';

import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, 
  Paperclip, 
  X, 
  FileText, 
  Lock, 
  Loader2, 
  Sparkles,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MessageComposerProps {
  onSendMessage: (data: {
    message: string;
    isInternalNote: boolean;
    attachments: Array<{ fileUrl: string; fileName: string; fileSize?: number; fileType?: string }>;
  }) => Promise<boolean>;
  isStaffViewer?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const CANNED_TEMPLATES = [
  {
    title: 'Meter Inspection Dispatched',
    text: 'Dear Customer, a field technician from your local AAWSA branch has been dispatched to inspect your water meter. Please ensure access is available to the meter box.',
  },
  {
    title: 'Billing Recalculation In Progress',
    text: 'Dear Customer, our billing department is reviewing your historical consumption readings and recalculating the disputed bill. An adjusted statement will be issued shortly.',
  },
  {
    title: 'Payment Verified & Credited',
    text: 'Dear Customer, your recent payment transaction has been successfully verified and posted to your customer account ledger. Thank you for choosing AAWSA.',
  },
  {
    title: 'Request Current Meter Photo',
    text: 'Dear Customer, to expedite the investigation of your inquiry, please provide a clear photograph of your water meter dial showing the current reading and serial number.',
  },
  {
    title: 'Resolution Confirmation',
    text: 'Dear Customer, this ticket has been addressed and resolved. If you require further clarification, feel free to reply to this thread or rate your service experience below.',
  },
];

export function MessageComposer({
  onSendMessage,
  isStaffViewer = false,
  disabled = false,
  placeholder = 'Type your reply here...',
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ fileUrl: string; fileName: string; fileSize?: number; fileType?: string }>>([]);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
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

  const handleSelectTemplate = (text: string) => {
    setMessage(prev => (prev ? `${prev}\n\n${text}` : text));
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast({ title: 'Validation', description: 'Please enter a message', variant: 'destructive' });
      return;
    }

    setIsSending(true);
    const ok = await onSendMessage({
      message: message.trim(),
      isInternalNote: isStaffViewer ? isInternalNote : false,
      attachments,
    });
    setIsSending(false);

    if (ok) {
      setMessage('');
      setAttachments([]);
      setIsInternalNote(false);
    }
  };

  return (
    <div className={`p-4 rounded-xl border ${isInternalNote ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-gray-200'} shadow-sm space-y-3`}>
      {/* Staff controls toolbar */}
      {isStaffViewer && (
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <Switch
              id="internal-note"
              checked={isInternalNote}
              onCheckedChange={setIsInternalNote}
            />
            <Label htmlFor="internal-note" className="text-xs font-semibold cursor-pointer flex items-center gap-1.5 text-gray-700">
              <Lock className="h-3.5 w-3.5 text-amber-600" />
              <span>Internal Note (Hidden from Customer)</span>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            {/* Canned Response Template Dropdown */}
            {!isInternalNote && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-blue-700 hover:text-blue-800 hover:bg-blue-50 px-2">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    <span>Quick Responses</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel className="text-xs">Standard AAWSA Templates</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {CANNED_TEMPLATES.map((tmpl, idx) => (
                    <DropdownMenuItem
                      key={idx}
                      onClick={() => handleSelectTemplate(tmpl.text)}
                      className="text-xs cursor-pointer flex flex-col items-start gap-0.5 py-1.5"
                    >
                      <span className="font-semibold text-gray-800">{tmpl.title}</span>
                      <span className="text-[11px] text-gray-500 line-clamp-1">{tmpl.text}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {isInternalNote && (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                Staff Only
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Message textarea */}
      <Textarea
        rows={3}
        placeholder={isInternalNote ? 'Write an internal note for staff members...' : placeholder}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={disabled || isSending}
        className={`w-full text-sm border-0 focus-visible:ring-0 p-1 resize-y bg-transparent ${
          isInternalNote ? 'placeholder:text-amber-800/60' : ''
        }`}
      />

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
          {attachments.map((att, idx) => (
            <Badge key={idx} variant="secondary" className="gap-1.5 py-1 px-2.5 text-xs bg-slate-100 text-slate-800">
              <FileText className="h-3 w-3" />
              <span className="max-w-[140px] truncate">{att.fileName}</span>
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

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition border border-gray-200">
          <Paperclip className="h-3.5 w-3.5 text-gray-500" />
          <span>Attach</span>
          <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx" />
        </label>

        <Button
          type="button"
          onClick={handleSend}
          disabled={disabled || isSending || !message.trim()}
          size="sm"
          className={`gap-1.5 ${
            isInternalNote
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          } shadow-sm`}
        >
          {isSending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              <span>{isInternalNote ? 'Save Note' : 'Send Message'}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
