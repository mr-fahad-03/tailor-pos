import { Request } from 'express';
import { AuditLog, AuditAction, IAuditChange } from '../models/AuditLog';

/**
 * Field-level change tracking for orders.
 *
 * An order is flattened into a map of label -> exact string, and two snapshots
 * are compared key by key. Comparison is on the raw string, so a trailing full
 * stop, a changed letter case or an added space all register as a change —
 * that is the point of the log.
 */
export type Snapshot = Record<string, string>;

const str = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  return String(v);
};

/** Dates compare by day, so a re-save does not look like an edit. */
const day = (v: unknown): string => {
  if (!v) return '';
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

/** Numbers compare by value, so 10 and 10.00 are not a spurious change. */
const money = (v: unknown): string => {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '';
};

export function snapshotJobCard(doc: any): Snapshot {
  const s: Snapshot = {};
  if (!doc) return s;

  s['Book No'] = money(doc.bookNo);
  s['Ref'] = str(doc.ref);
  s['Date'] = day(doc.date);
  s['Delivery Date'] = day(doc.deliveryDate);
  s['Customer'] = str(doc.partyName);
  s['Phone'] = str(doc.phone);
  s['Walk-in customer'] = doc.isNewCustomer ? 'yes' : 'no';
  s['Accounts A/c'] = str(doc.accountsAc);
  s['Invoice No'] = str(doc.invoiceNo);
  s['Fabric'] = str(doc.fabric);
  s['Size'] = str(doc.size);
  s['Fabric Consumption'] = str(doc.measurements?.FABRIC_CONSUMPTION);
  s['Total'] = money(doc.total);
  s['Additional Charges'] = money(doc.additionalCharges);
  s['Discount'] = money(doc.discount);
  s['Tax'] = money(doc.tax);
  s['Net Amount'] = money(doc.netAmount);
  s['Advance'] = money(doc.advance);
  s['Balance'] = money(doc.balance);
  s['Material Total'] = money(doc.materialTotal);
  s['Job Cost'] = money(doc.jobCost);
  s['Payment Mode'] = str(doc.paymentMode);
  s['Bank'] = str(doc.bank);
  s['Credit Card No'] = str(doc.creditCardNo);
  s['Status'] = str(doc.status);

  for (const [i, it] of (doc.items ?? []).entries()) {
    const at = `Item ${i + 1}`;
    s[`${at} · Code`] = str(it?.code);
    s[`${at} · Product`] = str(it?.productName);
    s[`${at} · Qty`] = money(it?.qty);
    s[`${at} · Rate`] = money(it?.rate);
    s[`${at} · Amount`] = money(it?.amount);
  }

  for (const [i, m] of (doc.materialsUsed ?? []).entries()) {
    const at = `Material ${i + 1}`;
    s[`${at} · Code`] = str(m?.code);
    s[`${at} · Product`] = str(m?.productName);
    s[`${at} · Qty`] = money(m?.qty);
    s[`${at} · Rate`] = money(m?.rate);
  }

  for (const [i, p] of (doc.measurementSets ?? []).entries()) {
    const at = `Person ${i + 1}`;
    s[`${at} · Name`] = str(p?.name);
    s[`${at} · Fabric`] = str(p?.fabric);
    s[`${at} · Size`] = str(p?.size);
    s[`${at} · Qty`] = money(p?.qty);
    for (const [k, v] of Object.entries(p?.values ?? {})) {
      s[`${at} · ${k}`] = str(v);
    }
    for (const [j, m] of (p?.materials ?? []).entries()) {
      const mat = `${at} · Material ${j + 1}`;
      s[`${mat} · Code`] = str(m?.code);
      s[`${mat} · Product`] = str(m?.productName);
      s[`${mat} · Qty`] = money(m?.qty);
      s[`${mat} · Rate`] = money(m?.rate);
    }
  }

  return s;
}

/** Every key whose exact value differs between the two snapshots. */
export function diffSnapshots(before: Snapshot, after: Snapshot): IAuditChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: IAuditChange[] = [];
  for (const field of keys) {
    const from = before[field] ?? '';
    const to = after[field] ?? '';
    if (from !== to) changes.push({ field, from, to });
  }
  return changes.sort((a, b) => a.field.localeCompare(b.field));
}

/**
 * Write one log entry. Never throws: an audit trail must not be the reason an
 * order fails to save, so a failed write is reported and swallowed.
 */
export async function recordAudit(
  req: Request,
  entry: {
    action: AuditAction;
    doc: any;
    changes?: IAuditChange[];
    summary?: string;
  },
): Promise<void> {
  try {
    // An update that changed nothing is noise, not history.
    if (entry.action === 'update' && (entry.changes ?? []).length === 0) return;
    await AuditLog.create({
      entity: 'jobcard',
      entityId: entry.doc?._id,
      entityNo: entry.doc?.no,
      entityRef: entry.doc?.ref,
      partyName: entry.doc?.partyName,
      action: entry.action,
      summary: entry.summary,
      changes: entry.changes ?? [],
      userId: req.user?.id,
      username: req.user?.username ?? 'unknown',
      userName: req.user?.name ?? 'Unknown user',
      at: new Date(),
    });
  } catch (e) {
    console.error('[audit] could not write log entry', e);
  }
}
