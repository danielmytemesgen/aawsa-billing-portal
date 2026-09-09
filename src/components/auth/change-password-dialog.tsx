"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { changePasswordAction } from "@/lib/auth-actions";
import { useToast } from "@/hooks/use-toast";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail?: string;
}

function getPasswordStrength(password: string) {
  const hasMinLength = password.length >= 6;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumberOrSpecial = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!password) {
    return { score: 0, label: "", colorClass: "", hasMinLength, hasUppercase, hasNumberOrSpecial };
  }

  let score = 0;
  if (hasMinLength) score += 1;
  if (hasUppercase) score += 1;
  if (hasNumberOrSpecial) score += 1;

  if (password.length >= 8 && hasUppercase && hasNumberOrSpecial) {
    return { score: 3, label: "Strong", colorClass: "bg-emerald-500", hasMinLength, hasUppercase, hasNumberOrSpecial };
  } else if (score >= 2) {
    return { score: 2, label: "Fair", colorClass: "bg-amber-500", hasMinLength, hasUppercase, hasNumberOrSpecial };
  } else {
    return { score: 1, label: "Weak", colorClass: "bg-rose-500", hasMinLength, hasUppercase, hasNumberOrSpecial };
  }
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  userEmail,
}: ChangePasswordDialogProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = React.useState(true);

  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Reset form whenever modal opens or closes
  React.useEffect(() => {
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setRevokeOtherSessions(true);
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentPassword) {
      setErrorMessage("Please enter your current password.");
      return;
    }
    if (!newPassword) {
      setErrorMessage("Please enter a new password.");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirm password do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setErrorMessage("New password must be different from your current password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
        revokeOtherSessions,
      });

      if (!res.success) {
        setErrorMessage(res.message || "Failed to update password.");
        setIsSubmitting(false);
        return;
      }

      toast({
        title: "Password Changed",
        description: res.message || "Your password has been successfully updated.",
      });

      onOpenChange(false);
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const strength = getPasswordStrength(newPassword);
  const isMatching = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);
  const isMismatch = Boolean(confirmPassword && newPassword !== confirmPassword);

  return (
    <Dialog open={open} onOpenChange={(val) => !isSubmitting && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center dark:bg-blue-950 dark:text-blue-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Change Password</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {userEmail ? `Update password for ${userEmail}` : "Update your account password"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive" className="py-2.5">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm font-medium">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Current Password */}
          <div className="space-y-1.5">
            <Label htmlFor="current-password" className="text-xs font-medium text-foreground">
              Current Password <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isSubmitting}
                className="pl-9 pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showCurrent ? "Hide" : "Show"} password</span>
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="new-password" className="text-xs font-medium text-foreground">
                New Password <span className="text-destructive">*</span>
              </Label>
              <span className="text-[11px] text-muted-foreground">Min. 6 characters</span>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSubmitting}
                className="pl-9 pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showNew ? "Hide" : "Show"} password</span>
              </button>
            </div>

            {/* Strength meter and live requirements */}
            {newPassword && (
              <div className="space-y-1.5 pt-1.5 animate-in fade-in-50 duration-200">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground font-medium">Strength:</span>
                  <span
                    className={`font-semibold ${
                      strength.score === 3
                        ? "text-emerald-600 dark:text-emerald-400"
                        : strength.score === 2
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {strength.label}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex gap-1">
                  <div
                    className={`h-full flex-1 rounded-full transition-all duration-300 ${
                      strength.score >= 1 ? strength.colorClass : "bg-transparent"
                    }`}
                  />
                  <div
                    className={`h-full flex-1 rounded-full transition-all duration-300 ${
                      strength.score >= 2 ? strength.colorClass : "bg-transparent"
                    }`}
                  />
                  <div
                    className={`h-full flex-1 rounded-full transition-all duration-300 ${
                      strength.score >= 3 ? strength.colorClass : "bg-transparent"
                    }`}
                  />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px]">
                  <span
                    className={`flex items-center gap-1 ${
                      strength.hasMinLength
                        ? "text-emerald-600 dark:text-emerald-400 font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    <CheckCircle2 className={`h-3 w-3 ${strength.hasMinLength ? "opacity-100" : "opacity-40"}`} />
                    6+ characters
                  </span>
                  <span
                    className={`flex items-center gap-1 ${
                      strength.hasUppercase
                        ? "text-emerald-600 dark:text-emerald-400 font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    <CheckCircle2 className={`h-3 w-3 ${strength.hasUppercase ? "opacity-100" : "opacity-40"}`} />
                    Uppercase letter
                  </span>
                  <span
                    className={`flex items-center gap-1 ${
                      strength.hasNumberOrSpecial
                        ? "text-emerald-600 dark:text-emerald-400 font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    <CheckCircle2 className={`h-3 w-3 ${strength.hasNumberOrSpecial ? "opacity-100" : "opacity-40"}`} />
                    Number or symbol
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="confirm-password" className="text-xs font-medium text-foreground">
                Confirm New Password <span className="text-destructive">*</span>
              </Label>
              {isMatching && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Passwords match
                </span>
              )}
              {isMismatch && (
                <span className="text-[11px] font-medium text-destructive">
                  Does not match
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                className={`pl-9 pr-10 ${
                  isMismatch
                    ? "border-destructive focus-visible:ring-destructive"
                    : isMatching
                    ? "border-emerald-500 focus-visible:ring-emerald-500"
                    : ""
                }`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showConfirm ? "Hide" : "Show"} password</span>
              </button>
            </div>
          </div>

          {/* Revoke other sessions checkbox */}
          <div className="flex items-start space-x-2.5 rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/70 dark:bg-slate-900/50">
            <Checkbox
              id="revoke-sessions"
              checked={revokeOtherSessions}
              onCheckedChange={(val) => setRevokeOtherSessions(Boolean(val))}
              disabled={isSubmitting}
              className="mt-0.5"
            />
            <div className="grid gap-0.5 leading-tight">
              <Label
                htmlFor="revoke-sessions"
                className="text-xs font-semibold cursor-pointer text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Sign out of other devices
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Revokes access from all other active sessions across browsers.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
