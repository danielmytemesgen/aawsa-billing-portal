'use client';

import React, { useRef, useEffect } from 'react';
import type { TicketMessage } from '../types';
import { Badge } from '@/components/ui/badge';
import { User, ShieldAlert, Bot, Paperclip, FileText, CheckCircle, Info } from 'lucide-react';
import { format } from 'date-fns';

interface MessageThreadProps {
  messages: TicketMessage[];
  currentUserId?: string;
  isStaffViewer?: boolean;
}

export function MessageThread({
  messages,
  currentUserId,
  isStaffViewer = false,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <p className="text-sm font-medium">No messages yet in this conversation.</p>
      </div>
    );
  }

  return (
    <div 
      ref={scrollRef} 
      className="space-y-4 max-h-[550px] overflow-y-auto p-4 bg-slate-50/50 rounded-lg border border-slate-200"
    >
      {messages.map((msg) => {
        // System event messages (centered pills)
        if (msg.senderType === 'system') {
          return (
            <div key={msg.id} className="flex justify-center my-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-200/80 text-slate-700 text-xs font-medium border border-slate-300 shadow-xs">
                <Info className="h-3.5 w-3.5 text-slate-500" />
                <span>{msg.message}</span>
                <span className="text-slate-400 text-[10px]">
                  {format(new Date(msg.createdAt), 'HH:mm')}
                </span>
              </div>
            </div>
          );
        }

        // Internal note for staff (amber highlight)
        if (msg.isInternalNote) {
          if (!isStaffViewer) return null; // Hide internal notes from customer
          return (
            <div key={msg.id} className="p-3.5 rounded-lg bg-amber-50/90 border border-amber-300 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-amber-900 font-semibold border-b border-amber-200/60 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <span>Internal Staff Note — {msg.senderName || 'Staff'}</span>
                </div>
                <span className="text-amber-700 font-normal">
                  {format(new Date(msg.createdAt), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              <p className="text-sm text-amber-950 whitespace-pre-wrap">{msg.message}</p>
            </div>
          );
        }

        const isCustomer = msg.senderType === 'customer';
        const formattedDate = format(new Date(msg.createdAt), 'MMM d, h:mm a');

        return (
          <div
            key={msg.id}
            className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
          >
            <div className="flex items-center gap-2 mb-1 px-1 text-xs text-gray-500">
              <span className="font-semibold text-gray-700">
                {isCustomer ? (msg.senderName || 'Customer') : (msg.senderName || 'AAWSA Support')}
              </span>
              <span>•</span>
              <span>{formattedDate}</span>
              {msg.senderType === 'staff' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                  Staff
                </Badge>
              )}
            </div>

            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-xs text-sm ${
                isCustomer
                  ? 'bg-blue-600 text-white rounded-tl-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tr-sm'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>

              {/* Attachments if any */}
              {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                <div className="mt-3 pt-2 border-t border-white/20 space-y-1.5">
                  {msg.attachments.map((att: any, idx: number) => (
                    <a
                      key={idx}
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded text-xs transition ${
                        isCustomer
                          ? 'bg-blue-700/80 hover:bg-blue-800 text-blue-50'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                      }`}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      <span className="max-w-[200px] truncate">{att.fileName}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
