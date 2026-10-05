'use client';

/**
 * Analytics Dashboard
 *
 * Provides admin-level KPI views for billing performance:
 * - Revenue trend (monthly billed vs collected)
 * - Collection rate by branch
 * - Unpaid aging breakdown (30 / 60 / 90 / 120+ days)
 * - Top defaulter customers
 *
 * Data is fetched server-side; this page renders the charts
 * using lightweight inline SVG bars and CSS — no chart library needed.
 */

import { useEffect, useState } from 'react';

interface RevenueMonth {
  month: string;
  billed: number;
  collected: number;
  collectionRate: number;
}

interface BranchRate {
  branch: string;
  totalBills: number;
  paidBills: number;
  rate: number;
}

interface AgingBucket {
  bucket: string;
  count: number;
  amount: number;
}

interface Defaulter {
  customerKey: string;
  customerName: string;
  branch: string;
  outstanding: number;
  monthsOverdue: number;
}

interface AnalyticsData {
  revenue: RevenueMonth[];
  branchRates: BranchRate[];
  aging: AgingBucket[];
  topDefaulters: Defaulter[];
  generatedAt: string;
}

// ─── Colour Palette ───────────────────────────────────────────────────────────
const BLUE    = '#3b82f6';
const GREEN   = '#22c55e';
const AMBER   = '#f59e0b';
const RED     = '#ef4444';
const CRIMSON = '#dc2626';
const CARD_BG = 'rgba(30,36,54,0.85)';
const BORDER  = '#2d3452';

// ─── Tiny Bar ─────────────────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, height: 8, background: '#1a2035', borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 12, color: '#8892b0', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 14,
      padding: '1.25rem 1.5rem', borderTop: `3px solid ${color}`,
    }}>
      <p style={{ margin: 0, fontSize: 13, color: '#8892b0', fontWeight: 500 }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#f0f4ff' }}>{value}</p>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#8892b0' }}>{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = () => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(setData)
      .catch(() => setError('Failed to load analytics data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Auto-refresh: re-fetch analytics data when DataRefreshProvider signals new data
  useEffect(() => {
    const handleDataRefreshed = () => {
      fetchAnalytics();
    };
    window.addEventListener('data-refreshed', handleDataRefreshed);
    return () => window.removeEventListener('data-refreshed', handleDataRefreshed);
  }, []);

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#8892b0' }}>
      Loading analytics…
    </div>
  );

  if (error || !data) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: RED }}>
      {error ?? 'No data available.'}
    </div>
  );

  // Summary KPIs from last month
  const last = data.revenue[data.revenue.length - 1];
  const maxBilled = Math.max(...data.revenue.map(r => r.billed), 1);
  const maxAmount = Math.max(...data.aging.map(a => a.amount), 1);

  return (
    <main style={{ padding: '1.5rem 2rem', maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 id="analytics-title" style={{ color: '#f0f4ff', fontWeight: 800, fontSize: '1.6rem', marginBottom: 4 }}>
        📊 Analytics Dashboard
      </h1>
      <p style={{ color: '#8892b0', marginTop: 0, marginBottom: '1.5rem', fontSize: 13 }}>
        Generated: {new Date(data.generatedAt).toLocaleString()}
      </p>

      {/* ── KPI Summary Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: '2rem' }}>
        <KpiCard
          label="Billed This Month"
          value={`ETB ${(last?.billed ?? 0).toLocaleString()}`}
          color={BLUE}
        />
        <KpiCard
          label="Collected This Month"
          value={`ETB ${(last?.collected ?? 0).toLocaleString()}`}
          color={GREEN}
        />
        <KpiCard
          label="Collection Rate"
          value={`${last?.collectionRate ?? 0}%`}
          sub="of bills paid on time"
          color={last?.collectionRate >= 80 ? GREEN : last?.collectionRate >= 50 ? AMBER : RED}
        />
        <KpiCard
          label="Overdue Bills"
          value={data.aging.reduce((s, a) => s + a.count, 0).toLocaleString()}
          sub={`ETB ${data.aging.reduce((s, a) => s + a.amount, 0).toLocaleString()} outstanding`}
          color={AMBER}
        />
      </div>

      {/* ── Revenue Trend ── */}
      <section style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginTop: 0 }}>
          📈 Revenue Trend (Last 6 Months)
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.revenue.map(row => (
            <div key={row.month}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>{row.month}</span>
                <span style={{ fontSize: 12, color: '#8892b0' }}>
                  ETB {row.collected.toLocaleString()} / {row.billed.toLocaleString()} ({row.collectionRate}%)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <MiniBar value={row.billed} max={maxBilled} color={BLUE} />
                <MiniBar value={row.collected} max={maxBilled} color={GREEN} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <span style={{ fontSize: 12, color: '#8892b0' }}><span style={{ color: BLUE }}>■</span> Billed</span>
          <span style={{ fontSize: 12, color: '#8892b0' }}><span style={{ color: GREEN }}>■</span> Collected</span>
        </div>
      </section>

      {/* ── Aging Breakdown ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <section style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '1.25rem 1.5rem' }}>
          <h2 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginTop: 0 }}>
            ⏰ Overdue Aging
          </h2>
          {data.aging.map((bucket, i) => {
            const colors = [AMBER, '#f97316', RED, CRIMSON];
            return (
              <div key={bucket.bucket} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: colors[i] ?? RED, fontWeight: 600 }}>{bucket.bucket}</span>
                  <span style={{ fontSize: 12, color: '#8892b0' }}>{bucket.count} bills</span>
                </div>
                <MiniBar value={bucket.amount} max={maxAmount} color={colors[i] ?? RED} />
                <div style={{ fontSize: 11, color: '#8892b0', marginTop: 2, textAlign: 'right' }}>
                  ETB {bucket.amount.toLocaleString()}
                </div>
              </div>
            );
          })}
        </section>

        {/* ── Branch Collection Rates ── */}
        <section style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '1.25rem 1.5rem' }}>
          <h2 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginTop: 0 }}>
            🏢 Collection Rate by Branch
          </h2>
          {data.branchRates.map(b => (
            <div key={b.branch} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>{b.branch}</span>
                <span style={{ fontSize: 12, color: '#8892b0' }}>{b.paidBills}/{b.totalBills}</span>
              </div>
              <MiniBar value={b.paidBills} max={b.totalBills} color={b.rate >= 80 ? GREEN : b.rate >= 50 ? AMBER : RED} />
            </div>
          ))}
        </section>
      </div>

      {/* ── Top Defaulters ── */}
      <section style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '1.25rem 1.5rem' }}>
        <h2 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginTop: 0 }}>
          ⚠️ Top Defaulters
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Customer Key', 'Name', 'Branch', 'Outstanding (ETB)', 'Months Overdue'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#8892b0', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.topDefaulters.map((d, i) => (
                <tr key={d.customerKey} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '10px 12px', color: '#60a5fa', fontFamily: 'monospace' }}>{d.customerKey}</td>
                  <td style={{ padding: '10px 12px', color: '#f0f4ff' }}>{d.customerName}</td>
                  <td style={{ padding: '10px 12px', color: '#8892b0' }}>{d.branch}</td>
                  <td style={{ padding: '10px 12px', color: RED, fontWeight: 700 }}>{d.outstanding.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      background: d.monthsOverdue >= 3 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: d.monthsOverdue >= 3 ? RED : AMBER,
                      padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    }}>
                      {d.monthsOverdue}m
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
