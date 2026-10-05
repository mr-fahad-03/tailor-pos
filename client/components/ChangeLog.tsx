'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import type { AuditAction, AuditEntry } from '@/lib/types';
import { Card, EmptyState, Seg, SectionTitle, TextInput } from '@/components/ui';
import { useToast } from '@/components/Toast';

const ACTION_STYLE: Record<AuditAction, string> = {
  create: 'bg-brand-100 text-brand-800',
  update: 'bg-ink-200 text-ink-700',
  payment: 'bg-brass-100 text-brass-800',
  close: 'bg-ink-200 text-ink-700',
  reopen: 'bg-brand-100 text-brand-800',
  convert: 'bg-brand-700 text-white',
};

/** Blank values need to read as blank, not as nothing at all. */
function Value({ text, tone }: { text: string; tone: 'from' | 'to' }) {
  const empty = text === '';
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[12px] ${
        empty ? 'italic text-ink-400' : tone === 'from' ? 'bg-rose-50 text-rose-700' : 'bg-brand-50 text-brand-800'
      }`}
    >
      {empty ? 'empty' : text}
    </span>
  );
}

function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${fmtDate(iso)} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * The Super Admin change log: who touched which order, and exactly which field
 * went from what to what. Rendered only where the caller has already checked
 * the role — the API refuses anyone else regardless.
 */
export function ChangeLog() {
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (query: string, act: string) => {
      setLoading(true);
      try {
        const r = await api.audit.list(query, act, 1, 100);
        setRows(r.items);
        setTotal(r.total);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not load the change log', 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(q, action), 300);
    return () => clearTimeout(t);
  }, [q, action, load]);

  return (
    <Card className="mt-6 p-5">
      <SectionTitle
        title="Change Log"
        sub={`${total} recorded change${total === 1 ? '' : 's'} · visible to Super Admin only`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search order no, ref, customer or who changed it…"
          className="max-w-sm"
        />
        <Seg
          options={[
            { value: '', label: 'All' },
            { value: 'create', label: 'Created' },
            { value: 'update', label: 'Edited' },
            { value: 'payment', label: 'Payments' },
            { value: 'convert', label: 'Converted' },
          ]}
          value={action}
          onChange={setAction}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-ink-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          sub="Every order created, edited, paid or converted from now on is logged here."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((e) => (
            <li key={e._id} className="rounded-xl border border-ink-200 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${ACTION_STYLE[e.action] ?? 'bg-ink-100 text-ink-600'}`}>
                  {e.action}
                </span>
                <span className="text-sm font-bold text-ink-900">
                  Order {e.entityNo ?? '—'}
                </span>
                <span className="font-mono text-xs text-ink-500">{e.entityRef}</span>
                {e.partyName && (
                  <span className="text-xs font-medium text-ink-500">· {e.partyName}</span>
                )}
                <span className="ml-auto whitespace-nowrap text-xs text-ink-500">
                  {e.userName}{' '}
                  <span className="text-ink-400">({e.username})</span> · {stamp(e.at)}
                </span>
              </div>

              {e.summary && <p className="mt-2 text-sm text-ink-600">{e.summary}</p>}

              {e.changes.length > 0 && (
                <ul className="mt-2.5 space-y-1.5">
                  {e.changes.map((c) => (
                    <li key={c.field} className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="min-w-[9rem] font-semibold text-ink-700">{c.field}</span>
                      <Value text={c.from} tone="from" />
                      <span className="text-ink-400">→</span>
                      <Value text={c.to} tone="to" />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
