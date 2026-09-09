'use client';

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { submitFeedbackAction } from '@/lib/support-actions';
import { Star, ThumbsUp, ThumbsDown, CheckCircle2, Loader2 } from 'lucide-react';

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  ticketNumber: number;
  onFeedbackSubmitted?: () => void;
}

export function FeedbackDialog({
  isOpen,
  onClose,
  ticketId,
  ticketNumber,
  onFeedbackSubmitted,
}: FeedbackDialogProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [wasResolved, setWasResolved] = useState<boolean>(true);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const raw = typeof window !== 'undefined' ? localStorage.getItem('customer') : null;
    const sessionObj = raw ? JSON.parse(raw) : null;
    const sessionId = sessionObj?.sessionId;

    const res = await submitFeedbackAction({
      ticketId,
      rating,
      wasResolved,
      comment: comment.trim() || undefined,
    }, sessionId);
    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: 'Error',
        description: res.error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Thank you for your feedback!',
        description: 'Your rating helps us improve AAWSA customer service quality.',
      });
      if (onFeedbackSubmitted) onFeedbackSubmitted();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            Support Satisfaction Survey (Ticket #{ticketNumber})
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-600">
            Please take a moment to rate the service you received from AAWSA support.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="text-center space-y-2">
            <Label className="text-sm font-semibold text-gray-700">How satisfied were you with the support?</Label>
            <div className="flex justify-center items-center gap-2 pt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-1 transition transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 ${
                      (hoverRating ?? rating) >= star
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="text-xs font-medium text-amber-700">
              {rating === 5 && '⭐️⭐️⭐️⭐️⭐️ Outstanding service!'}
              {rating === 4 && '⭐️⭐️⭐️⭐️ Good service'}
              {rating === 3 && '⭐️⭐️⭐️ Average'}
              {rating === 2 && '⭐️⭐️ Poor'}
              {rating === 1 && '⭐️ Very dissatisfied'}
            </div>
          </div>

          {/* Was Issue Resolved? */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Was your issue completely resolved?</Label>
            <div className="flex gap-4">
              <label
                onClick={() => setWasResolved(true)}
                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer transition ${
                  wasResolved
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold'
                    : 'border-gray-200 bg-gray-50 text-gray-700'
                }`}
              >
                <ThumbsUp className={`h-4 w-4 ${wasResolved ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span>Yes, Resolved</span>
              </label>

              <label
                onClick={() => setWasResolved(false)}
                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer transition ${
                  !wasResolved
                    ? 'border-red-500 bg-red-50 text-red-900 font-semibold'
                    : 'border-gray-200 bg-gray-50 text-gray-700'
                }`}
              >
                <ThumbsDown className={`h-4 w-4 ${!wasResolved ? 'text-red-600' : 'text-gray-400'}`} />
                <span>No, Still an Issue</span>
              </label>
            </div>
          </div>

          {/* Optional Comments */}
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-xs font-semibold text-gray-700">
              Additional Comments / Suggestions (Optional)
            </Label>
            <Textarea
              id="comment"
              rows={3}
              placeholder="Tell us what went well or how we can improve..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between items-center sm:justify-between">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Skip
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Submit Feedback</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
