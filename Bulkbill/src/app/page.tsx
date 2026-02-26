
"use client";

import { AuthForm } from "@/components/auth/auth-form";

export default function HomePage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <AuthForm />
    </div>
  );
}
