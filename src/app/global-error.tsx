'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Layout Error Boundary caught error]:', error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center p-6 bg-slate-50 font-sans">
        <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto text-red-600 text-2xl font-bold">
            !
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Application Error</h2>
            <p className="text-sm text-slate-600">
              A critical error occurred. Please refresh or try again.
            </p>
          </div>

          <button
            onClick={() => reset()}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
