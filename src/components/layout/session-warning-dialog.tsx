
import * as React from 'react';
import { Timer, LogOut, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SessionWarningDialogProps {
  open: boolean;
  secondsLeft: number;
  onExtend: () => void;
  onLogout: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

export function SessionWarningDialog({
  open,
  secondsLeft,
  onExtend,
  onLogout,
}: SessionWarningDialogProps) {
  // Derive urgency colour: red under 30 s, amber under 60 s, else blue
  const urgency =
    secondsLeft <= 30 ? 'text-red-500' :
    secondsLeft <= 60 ? 'text-amber-500' :
    'text-blue-500';

  const ringColour =
    secondsLeft <= 30 ? 'ring-red-200 dark:ring-red-900' :
    secondsLeft <= 60 ? 'ring-amber-200 dark:ring-amber-900' :
    'ring-blue-200 dark:ring-blue-900';

  return (
    <Dialog open={open} onOpenChange={() => {/* prevent accidental close */}}>
      <DialogContent
        className="sm:max-w-sm rounded-2xl shadow-2xl border-0 animate-in zoom-in-95 duration-300"
        // Prevent closing by clicking outside or pressing Escape
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center gap-3">
          {/* Animated countdown ring */}
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full ring-4 ${ringColour} bg-slate-50 dark:bg-slate-900 transition-all duration-500`}
          >
            <Timer className={`h-8 w-8 ${urgency} transition-colors duration-500`} />
          </div>

          <DialogTitle className="text-xl font-bold leading-tight">
            Your session is about to expire
          </DialogTitle>

          <DialogDescription className="text-base text-center leading-relaxed">
            You will be automatically logged out in{' '}
            <span className={`font-bold text-lg tabular-nums ${urgency} transition-colors duration-500`}>
              {formatTime(secondsLeft)}
            </span>
            {' '}due to inactivity.
            <br />
            Do you want to extend your session?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-2">
          <Button
            variant="outline"
            className="w-full rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive transition-all duration-200"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout Now
          </Button>
          <Button
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/30 transition-all duration-200"
            onClick={onExtend}
            autoFocus
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Extend Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
