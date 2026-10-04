'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Ledger } from '@/lib/types';
import { Modal } from './Modal';
import { TextInput } from './ui';
import { useToast } from './Toast';

export function LedgerSearchModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (ledger: Ledger) => void;
}) {
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Ledger[]>([]);
  const [picked, setPicked] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setPicked(null);
    void load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  async function load(query: string) {
    setLoading(true);
    try {
      const r = await api.ledgers.list(query, 1, 100);
      setRows(r.items);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load ledgers', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Find Ledger"
      sub="Search by name or phone, then press OK"
      wide
      footer={
        <>
          <button className="btn-soft" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-success"
            disabled={!picked}
            onClick={() => {
              if (picked) {
                onSelect(picked);
                onClose();
              }
            }}
          >
            OK
          </button>
        </>
      }
    >
      <TextInput
        autoFocus
        placeholder="Type name or phone…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4"
      />
      <div className="overflow-hidden rounded-xl border border-ink-200">
        <div className="overflow-x-auto"><table className="w-full min-w-[420px]">
          <thead className="bg-ink-50">
            <tr>
              <th className="th">Phone</th>
              <th className="th">Ledger Name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {loading && (
              <tr>
                <td colSpan={2} className="td text-center text-ink-400">
                  Searching…
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((l) => (
                <tr
                  key={l._id}
                  onClick={() => setPicked(l)}
                  onDoubleClick={() => {
                    onSelect(l);
                    onClose();
                  }}
                  className={`cursor-pointer transition ${
                    picked?._id === l._id ? 'bg-brand-50' : 'hover:bg-ink-50'
                  }`}
                >
                  <td className="td font-mono text-[13px]">{l.phone || '—'}</td>
                  <td className="td font-semibold">{l.name}</td>
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={2} className="td text-center text-ink-400">
                  No ledgers found
                </td>
              </tr>
            )}
          </tbody>
        </table></div>
      </div>
    </Modal>
  );
}
