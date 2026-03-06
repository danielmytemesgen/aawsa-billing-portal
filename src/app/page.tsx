
"use client";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthAds } from "@/components/auth/auth-ads";

export default function HomePage() {
  return (
    <div className="glass-container flex items-center justify-center min-h-screen">
      <div className="bokeh">
        <div className="bokeh-circle" style={{ width: '400px', height: '400px', top: '10%', left: '10%', opacity: 0.1 }}></div>
        <div className="bokeh-circle" style={{ width: '300px', height: '300px', bottom: '20%', right: '15%', opacity: 0.15 }}></div>
        <div className="bokeh-circle" style={{ width: '500px', height: '500px', top: '40%', right: '10%', opacity: 0.08 }}></div>
        <div className="bokeh-circle" style={{ width: '250px', height: '250px', bottom: '10%', left: '20%', opacity: 0.12 }}></div>
      </div>
      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between px-6 lg:px-16 py-12 gap-12">
        <AuthAds />
        <div className="w-full max-w-md">
          <AuthForm />
        </div>
      </div>
    </div>
  );
}
