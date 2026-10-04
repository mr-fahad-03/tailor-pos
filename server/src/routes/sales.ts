import { Router } from 'express';
import { Sale } from '../models/Sale';
import { nextSeq, peekSeq } from '../models/Counter';
import { asyncHandler, HttpError } from '../middleware';
import { num, r2, saleLine } from '../utils/money';
import { requireAuth, requirePerm } from '../auth/guard';

export const saleRouter = Router();

// Every endpoint below requires a signed-in user.
saleRouter.use(requireAuth);

const DEFAULT_TAX_RATE = 5;

function searchFilter(q?: string) {
  if (!q) return {};
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const or: Record<string, unknown>[] = [
    { partyName: rx },
    { phone: rx },
    { jobCardRef: rx },
  ];
  const asNum = Number(q);
  if (Number.isFinite(asNum) && q.trim() !== '') or.push({ billNo: asNum });
  return { $or: or };
}

interface SaleItemBody {
  code?: string;
  productName?: string;
  qty?: number;
  rate?: number;
  discPercent?: number;
  taxPercent?: number;
}

interface SaleBody {
  billDate?: string;
  saleType?: 'retail' | 'wholesale' | 'distributor';
  paymentType?: 'cash' | 'credit';
  category?: 'A' | 'B';
  creditCardNo?: string;
  jobCardRef?: string;
  jobCardId?: string;
  salesman?: string;
  partyName?: string;
  phone?: string;
  ledgerId?: string;
  delDate?: string;
  landmark?: string;
  trn?: string;
  vehicleNo?: string;
  items?: SaleItemBody[];
  additionalDiscount?: number;
  freight?: number;
  advanceAmount?: number;
  isReturn?: boolean;
  defaultTaxPercent?: number;
}

// GET /sales?q=&isReturn=&page=&limit=
saleRouter.get(
  '/',
  requirePerm('sales.view'),
  asyncHandler(async (req, res) => {
    const { q, isReturn } = req.query as { q?: string; isReturn?: string };
    const page = Math.max(num(req.query.page, 1), 1);
    const limit = Math.min(Math.max(num(req.query.limit, 30), 1), 200);
    const filter: Record<string, unknown> = { ...searchFilter(q) };
    if (isReturn === 'true') filter.isReturn = true;
    else if (isReturn === 'false') filter.isReturn = false;
    const [items, total] = await Promise.all([
      Sale.find(filter).sort({ billNo: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Sale.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  }),
);

// GET /sales/next -> { billNo } (peek)
saleRouter.get(
  '/next',
  requirePerm('sales.view'),
  asyncHandler(async (_req, res) => {
    res.json({ billNo: await peekSeq('sale', 85934) });
  }),
);

// POST /sales
saleRouter.post(
  '/',
  requirePerm('sales.create'),
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as SaleBody;
    const defaultTax = body.defaultTaxPercent !== undefined ? num(body.defaultTaxPercent, DEFAULT_TAX_RATE) : DEFAULT_TAX_RATE;

    const items = (body.items ?? [])
      .filter((i) => i && (i.code || i.productName || num(i.qty) || num(i.rate)))
      .map((i) => {
        const computed = saleLine({
          qty: num(i.qty),
          rate: num(i.rate),
          discPercent: num(i.discPercent),
          taxPercent: i.taxPercent !== undefined ? num(i.taxPercent) : defaultTax,
        });
        return {
          code: i.code || '',
          productName: i.productName || '',
          qty: num(i.qty),
          rate: num(i.rate),
          netRate: computed.netRate,
          discPercent: num(i.discPercent),
          discAmt: computed.discAmt,
          grossAmt: computed.grossAmt,
          taxPercent: i.taxPercent !== undefined ? num(i.taxPercent) : defaultTax,
          taxAmt: computed.taxAmt,
          netAmount: computed.netAmount,
        };
      });

    if (items.length === 0) throw new HttpError(400, 'At least one item is required');

    const totQty = r2(items.reduce((s, i) => s + i.qty, 0));
    const grossAmount = r2(items.reduce((s, i) => s + i.grossAmt, 0));
    const lineDisc = r2(items.reduce((s, i) => s + i.discAmt, 0));
    const additionalDiscount = r2(num(body.additionalDiscount));
    const discountAmt = r2(lineDisc + additionalDiscount);
    const taxAmt = r2(items.reduce((s, i) => s + i.taxAmt, 0));
    const freight = r2(num(body.freight));
    const netAmount = r2(grossAmount - additionalDiscount + taxAmt + freight);
    const advanceAmount = r2(num(body.advanceAmount));

    const billNo = await nextSeq('sale');
    const sale = await Sale.create({
      billNo,
      billDate: body.billDate ? new Date(body.billDate) : new Date(),
      saleType: body.saleType || 'retail',
      paymentType: body.paymentType || 'cash',
      category: body.category || 'A',
      creditCardNo: body.creditCardNo,
      jobCardRef: body.jobCardRef?.trim(),
      jobCardId: body.jobCardId || undefined,
      salesman: body.salesman || 'GENERAL',
      partyName: body.partyName?.trim(),
      phone: body.phone?.trim(),
      ledgerId: body.ledgerId || undefined,
      delDate: body.delDate ? new Date(body.delDate) : undefined,
      landmark: body.landmark,
      trn: body.trn,
      vehicleNo: body.vehicleNo,
      items,
      totQty,
      grossAmount,
      discountAmt,
      additionalDiscount,
      taxAmt,
      freight,
      advanceAmount,
      netAmount,
      balance: r2(netAmount - advanceAmount),
      isReturn: !!body.isReturn,
    });
    res.status(201).json(sale);
  }),
);

// GET /sales/:id
saleRouter.get(
  '/:id',
  requirePerm('sales.view'),
  asyncHandler(async (req, res) => {
    const sale = await Sale.findById(req.params.id).lean();
    if (!sale) throw new HttpError(404, 'Sale not found');
    res.json(sale);
  }),
);
