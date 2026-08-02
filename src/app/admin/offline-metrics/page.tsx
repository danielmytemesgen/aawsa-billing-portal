"use client";
import React, { useEffect, useState } from 'react';

export default function Page() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/offline/metrics_summary')
      .then(res => res.json())
      .then(json => {
        if (json && json.rows) {
          setRows(json.rows);
        }
      })
      .catch(e => console.warn('Failed to load offline metrics summary:', e));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Offline Sync Metrics (last 7 days)</h1>
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="text-left font-medium">Event</th>
            <th className="text-right font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.event} className="border-t">
              <td className="py-2">{r.event}</td>
              <td className="py-2 text-right">{r.cnt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
