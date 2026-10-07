'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { fmt, fmtDate } from '@/lib/format';
import { formatAddress, type Ledger } from '@/lib/types';
import { exportCsv, exportExcel, exportPdf, type ExportColumn } from '@/lib/exportTable';
import { Card, EmptyState, Field, Select, TextInput } from '@/components/ui';
import {
  LedgerFormModal,
  LEDGER_FORM_LABELS,
  type PartyType,
} from '@/components/LedgerFormModal';
import { AnchoredDropdown } from '@/components/AnchoredDropdown';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthContext';

export type { PartyType };

/**
 * The per-row Edit / Delete menu.
 *
 * The table scrolls sideways, which makes it a clipping context, so a menu
 * positioned inside a cell is cut off at the table's edge — on the last row
 * it was losing Delete entirely. It goes through a portal instead, pinned to
 * the button, where nothing can crop it.
 */
function RowActions({
  open,
  onToggle,
  onClose,
  onEdit,
  onDelete,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open, onClose]);

  return (
    <div ref={anchorRef} className="inline-block">
      <button
        className="btn-success !py-1 !px-2.5 text-[11px]"
        onClick={onToggle}
        aria-expanded={open}
      >
        Actions ▾
      </button>
      <AnchoredDropdown anchorRef={anchorRef} panelRef={panelRef} open={open} width={144}>
        <div className="p-1">
          <button
            className="block w-full rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-brand-50"
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            className="block w-full rounded-lg px-3 py-1.5 text-left text-[13px] text-rose-600 hover:bg-rose-50"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </AnchoredDropdown>
    </div>
  );
}

/** What differs between the Customers screen and the Suppliers one. */
export interface PartyConfig {
  type: PartyType;
  title: string;
  /** Singular, lower case — used inside sentences. */
  noun: string;
  sub: string;
  addressLabel: string;
}

/** A column, in the one definition the screen and all four exports share. */
interface Col {
  key: string;
  header: string;
  /** Plain text: what is searched, what is sorted, what is exported. */
  value: (l: Ledger) => string;
  /** A richer cell, when the screen wants more than the text. */
  render?: (l: Ledger) => React.ReactNode;
  numeric?: boolean;
  right?: boolean;
}

const PAGE_SIZES = [10, 25, 50, 100];

/** Pay term reads as one phrase rather than a number and a unit apart. */
const payTermText = (l: Ledger): string =>
  l.payTerm == null ? '' : `${l.payTerm} ${l.payTermUnit === 'months' ? 'Months' : 'Days'}`;

/**
 * One screen per party type: customers and suppliers are both ledgers
 * underneath, but each gets its own list, its own labels and its own exports.
 *
 * Searching, sorting and paging all happen here rather than on the server.
 * A tailor's book of parties runs to hundreds, not millions, so fetching it
 * once and working on it in the browser keeps every keystroke instant — and
 * lets an export honestly contain exactly what is on screen.
 */
export function PartyPage({ config }: { config: PartyConfig }) {
  const { can } = useAuth();
  const canManage = can('ledgers.manage');
  const { toast } = useToast();
  const labels = LEDGER_FORM_LABELS[config.type];
  const groupLabel = `${config.noun === 'supplier' ? 'Supplier' : 'Customer'} Group`;

  const [rows, setRows] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ledger | null>(null);

  // ---- table controls ----
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc',
  });
  const [hidden, setHidden] = useState<string[]>([]);
  const [colsOpen, setColsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  // ---- filters ----
  const [fGroup, setFGroup] = useState('');
  const [fBalance, setFBalance] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.ledgers.listByType('', config.type, 1, 500);
      setRows(r.items);
    } catch (e) {
      toast(e instanceof Error ? e.message : `Could not load ${config.title}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast, config.type, config.title]);

  useEffect(() => {
    void load();
  }, [load]);

  // Any menu or popover closes when the click lands outside it.
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (shellRef.current?.contains(e.target as Node)) return;
      setMenuFor(null);
      setColsOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const columns: Col[] = useMemo(
    () => [
      { key: 'contactId', header: 'Contact ID', value: (l) => l.contactId ?? '' },
      {
        key: 'secondary',
        header: labels.secondary.label,
        value: (l) => l[labels.secondary.key] ?? '',
      },
      {
        key: 'name',
        header: 'Name',
        value: (l) => l.name,
        render: (l) => <span className="font-bold text-ink-900">{l.name}</span>,
      },
      { key: 'email', header: 'Email', value: (l) => l.email ?? '' },
      { key: 'trn', header: 'Tax number', value: (l) => l.trn ?? '' },
      {
        key: 'creditLimit',
        header: 'Credit Limit',
        // Blank is not zero: it is the absence of a limit, and saying so in
        // words stops anyone reading an empty cell as "nothing allowed".
        value: (l) => (l.creditLimit == null ? 'No limit' : `${fmt(l.creditLimit)} AED`),
        numeric: true,
        right: true,
      },
      { key: 'payTerm', header: 'Pay term', value: payTermText },
      {
        key: 'openingBalance',
        header: 'Opening Balance',
        value: (l) => `${fmt(l.openingBalance)} AED`,
        numeric: true,
        right: true,
      },
      {
        key: 'due',
        header: 'Advance Balance',
        value: (l) => `${fmt(l.due ?? 0)} AED`,
        numeric: true,
        right: true,
        render: (l) => {
          const d = l.due ?? 0;
          return (
            <span
              className={`font-bold tabular-nums ${
                d > 0 ? 'text-rose-600' : d < 0 ? 'text-brand-700' : 'text-ink-400'
              }`}
              title={d > 0 ? 'Owed to you' : d < 0 ? 'Paid ahead' : 'Settled'}
            >
              {fmt(d)} AED
            </span>
          );
        },
      },
      { key: 'createdAt', header: 'Added On', value: (l) => fmtDate(l.createdAt) },
      { key: 'customerGroup', header: groupLabel, value: (l) => l.customerGroup ?? '' },
      {
        key: 'address',
        header: config.addressLabel,
        value: (l) => formatAddress(l),
        render: (l) => <div className="max-w-[16rem] break-words">{formatAddress(l) || '—'}</div>,
      },
      {
        key: 'phone',
        header: 'Mobile',
        value: (l) => l.phone ?? '',
        render: (l) => <span className="font-mono text-xs">{l.phone || '—'}</span>,
      },
    ],
    [labels.secondary.key, labels.secondary.label, config.addressLabel, groupLabel],
  );

  const shown = useMemo(() => columns.filter((c) => !hidden.includes(c.key)), [columns, hidden]);

  /** Every group actually in use, so the filter never offers an empty one. */
  const groups = useMemo(
    () => Array.from(new Set(rows.map((r) => r.customerGroup).filter(Boolean))).sort() as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((l) => {
      if (fGroup && (l.customerGroup ?? '') !== fGroup) return false;
      if (fBalance === 'owing' && (l.due ?? 0) <= 0) return false;
      if (fBalance === 'credit' && (l.due ?? 0) >= 0) return false;
      if (fBalance === 'settled' && (l.due ?? 0) !== 0) return false;
      const added = (l.createdAt ?? '').slice(0, 10);
      if (fFrom && added && added < fFrom) return false;
      if (fTo && added && added > fTo) return false;
      // Searched across the columns on show, so a hidden column cannot
      // produce a match the reader has no way to see.
      if (!term) return true;
      return shown.some((c) => c.value(l).toLowerCase().includes(term));
    });
  }, [rows, search, shown, fGroup, fBalance, fFrom, fTo]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (col.numeric) {
        const na = Number(String(col.value(a)).replace(/[^\d.-]/g, '')) || 0;
        const nb = Number(String(col.value(b)).replace(/[^\d.-]/g, '')) || 0;
        return (na - nb) * dir;
      }
      return col.value(a).localeCompare(col.value(b), undefined, { numeric: true }) * dir;
    });
  }, [filtered, columns, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = sorted.slice((current - 1) * pageSize, current * pageSize);

  // A narrowed list can be shorter than the page someone is standing on.
  useEffect(() => setPage(1), [search, pageSize, fGroup, fBalance, fFrom, fTo]);

  /** What the exports write: the visible columns, in the order on screen. */
  const exportCols: ExportColumn<Ledger>[] = shown.map((c) => ({
    key: c.key,
    header: c.header,
    value: c.value,
  }));
  const fileName = config.title.toLowerCase().replace(/\s+/g, '-');

  async function runExport(kind: 'csv' | 'excel' | 'pdf') {
    if (!sorted.length) {
      toast('Nothing to export', 'info');
      return;
    }
    try {
      if (kind === 'csv') exportCsv(sorted, exportCols, fileName);
      else if (kind === 'excel') await exportExcel(sorted, exportCols, fileName);
      else await exportPdf(sorted, exportCols, fileName, `All your ${config.title}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', 'error');
    }
  }

  async function remove(l: Ledger) {
    if (!window.confirm(`Delete ${config.noun} "${l.name}"? This cannot be undone.`)) return;
    try {
      await api.ledgers.remove(l._id);
      toast(`${l.name} deleted`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete', 'error');
    }
  }

  const activeFilters = [fGroup, fBalance, fFrom, fTo].filter(Boolean).length;

  return (
    <div ref={shellRef}>
      <div className="mb-5 flex flex-wrap items-baseline gap-3">
        <h1 className="page-title">{config.title}</h1>
        <p className="page-sub !mt-0">Manage your {config.title}</p>
      </div>

      {/* filters, folded away until wanted */}
      <Card className="no-print mb-5">
        <button
          className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-bold text-brand-700"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          <span className={`transition ${filtersOpen ? 'rotate-90' : ''}`}>▸</span>
          Filters
          {activeFilters > 0 && (
            <span className="badge bg-brand-100 text-brand-800">{activeFilters} active</span>
          )}
        </button>
        {filtersOpen && (
          <div className="grid grid-cols-1 gap-4 border-t border-ink-100 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={groupLabel}>
              <Select value={fGroup} onChange={(e) => setFGroup(e.target.value)}>
                <option value="">All</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Balance">
              <Select value={fBalance} onChange={(e) => setFBalance(e.target.value)}>
                <option value="">All</option>
                <option value="owing">Owing money</option>
                <option value="credit">In credit</option>
                <option value="settled">Settled</option>
              </Select>
            </Field>
            <Field label="Added from">
              <TextInput type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
            </Field>
            <Field label="Added to">
              <TextInput type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
            </Field>
            {activeFilters > 0 && (
              <div className="lg:col-span-4">
                <button
                  className="btn-soft !py-1.5 text-xs"
                  onClick={() => {
                    setFGroup('');
                    setFBalance('');
                    setFFrom('');
                    setFTo('');
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-visible">
        <div className="flex flex-wrap items-center gap-3 p-5 pb-0">
          <h2 className="text-lg font-extrabold tracking-tight text-ink-900">
            All your {config.title}
          </h2>
          {canManage && (
            <button
              className="btn-primary ml-auto !rounded-full !px-5"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              ＋ Add
            </button>
          )}
        </div>

        {/* toolbar */}
        <div className="no-print flex flex-wrap items-center gap-2 p-5">
          <label className="flex items-center gap-2 text-[13px] text-ink-600">
            Show
            <Select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="!w-20"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            entries
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-success !py-1.5 text-xs" onClick={() => void runExport('csv')}>
              Export CSV
            </button>
            <button className="btn-success !py-1.5 text-xs" onClick={() => void runExport('excel')}>
              Export Excel
            </button>
            <button className="btn-success !py-1.5 text-xs" onClick={() => window.print()}>
              Print
            </button>
            <div className="relative">
              <button
                className="btn-success !py-1.5 text-xs"
                onClick={() => setColsOpen((v) => !v)}
                aria-expanded={colsOpen}
              >
                Column visibility
              </button>
              {colsOpen && (
                <div className="absolute left-0 z-50 mt-1 w-56 rounded-xl border border-ink-200 bg-white p-2 shadow-lg">
                  {columns.map((c) => (
                    <label
                      key={c.key}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-brand-50"
                    >
                      <input
                        type="checkbox"
                        checked={!hidden.includes(c.key)}
                        onChange={() =>
                          setHidden((h) =>
                            h.includes(c.key) ? h.filter((k) => k !== c.key) : [...h, c.key],
                          )
                        }
                        className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                      />
                      {c.header}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-success !py-1.5 text-xs" onClick={() => void runExport('pdf')}>
              Export PDF
            </button>
          </div>

          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search …"
            className="ml-auto !w-52"
          />
        </div>

        {loading ? (
          <div className="space-y-2 px-5 pb-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={rows.length === 0 ? `No ${config.title.toLowerCase()} yet` : 'Nothing matches'}
              sub={
                rows.length === 0
                  ? canManage
                    ? 'Press Add to create the first one.'
                    : 'Ask an admin to add one.'
                  : 'Try a different search, or clear the filters.'
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border-y border-ink-100">
              <table className="w-full">
                <thead>
                  <tr className="bg-ink-50/60">
                    {canManage && <th className="th">Action</th>}
                    {shown.map((c) => {
                      const on = sort.key === c.key;
                      return (
                        <th key={c.key} className={`th ${c.right ? 'text-right' : ''}`}>
                          <button
                            className="inline-flex items-center gap-1 hover:text-brand-700"
                            onClick={() =>
                              setSort((s) =>
                                s.key === c.key
                                  ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
                                  : { key: c.key, dir: 'asc' },
                              )
                            }
                            title={`Sort by ${c.header}`}
                          >
                            {c.header}
                            <span className={on ? 'text-brand-700' : 'text-ink-300'}>
                              {on ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {pageRows.map((l) => (
                    <tr key={l._id} className="transition hover:bg-brand-50/50">
                      {canManage && (
                        <td className="td">
                          <RowActions
                            open={menuFor === l._id}
                            onToggle={() => setMenuFor(menuFor === l._id ? null : l._id)}
                            onClose={() => setMenuFor(null)}
                            onEdit={() => {
                              setMenuFor(null);
                              setEditing(l);
                              setOpen(true);
                            }}
                            onDelete={() => {
                              setMenuFor(null);
                              void remove(l);
                            }}
                          />
                        </td>
                      )}
                      {shown.map((c) => (
                        <td
                          key={c.key}
                          className={`td ${c.right ? 'text-right tabular-nums' : ''} ${
                            c.key === 'address' ? 'whitespace-normal' : ''
                          }`}
                        >
                          {c.render ? c.render(l) : c.value(l) || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="no-print flex flex-wrap items-center gap-3 p-5 text-[13px] text-ink-500">
              <span>
                Showing {(current - 1) * pageSize + 1} to{' '}
                {Math.min(current * pageSize, sorted.length)} of {sorted.length} entries
                {sorted.length !== rows.length && ` (filtered from ${rows.length})`}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  className="btn-soft !py-1 !px-3 text-xs"
                  onClick={() => setPage(current - 1)}
                  disabled={current <= 1}
                >
                  Previous
                </button>
                <span className="font-semibold text-ink-700">
                  {current} / {pageCount}
                </span>
                <button
                  className="btn-soft !py-1 !px-3 text-xs"
                  onClick={() => setPage(current + 1)}
                  disabled={current >= pageCount}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      <LedgerFormModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => void load()}
        type={config.type}
        editing={editing}
        noun={config.noun}
        sub={config.sub}
      />
    </div>
  );
}
