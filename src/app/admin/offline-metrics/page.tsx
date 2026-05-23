import React from 'react';

export default async function Page() {
  let rows: any[] = [];
  try {
    const res = await fetch('/api/offline/metrics_summary');
    const json = await res.json();
    rows = json && json.rows ? json.rows : [];
  } catch (e) {
    // In prerender or environments where relative fetch may fail, show empty data instead of breaking build
    console.warn('Failed to load offline metrics summary:', e);
    rows = [];
  }

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
