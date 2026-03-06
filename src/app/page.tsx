
"use client";

import { AuthForm } from "@/components/auth/auth-form";

export default function HomePage() {
  return (
    <div className="glass-container flex items-center justify-center min-h-screen">
      <div className="bokeh">
        <div className="bokeh-circle" style={{ width: '400px', height: '400px', top: '10%', left: '10%', opacity: 0.1 }}></div>
        <div className="bokeh-circle" style={{ width: '300px', height: '300px', bottom: '20%', right: '15%', opacity: 0.15 }}></div>
        <div className="bokeh-circle" style={{ width: '500px', height: '500px', top: '40%', right: '10%', opacity: 0.08 }}></div>
        <div className="bokeh-circle" style={{ width: '250px', height: '250px', bottom: '10%', left: '20%', opacity: 0.12 }}></div>
      </div>
      <div className="relative z-10 w-full flex justify-center px-4">
        <AuthForm />
      </div>
    </div>
  );
}
