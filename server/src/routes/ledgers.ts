import { Router } from 'express';
import { Ledger } from '../models/Ledger';
import { asyncHandler, HttpError } from '../middleware';
import { num } from '../utils/money';
import { requireAuth, requirePerm } from '../auth/guard';

export const ledgerRouter = Router();

// Every endpoint below requires a signed-in user.
ledgerRouter.use(requireAuth);

function searchFilter(q?: string) {
  if (!q) return {};
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return { $or: [{ name: rx }, { phone: rx }] };
}

// GET /ledgers?q=&type=&page=&limit=
ledgerRouter.get(
  '/',
  requirePerm('ledgers.view'),
  asyncHandler(async (req, res) => {
    const { q, type } = req.query as { q?: string; type?: string };
    const page = Math.max(num(req.query.page, 1), 1);
    const limit = Math.min(Math.max(num(req.query.limit, 50), 1), 500);
    const filter: Record<string, unknown> = { ...searchFilter(q) };
    if (type) filter.type = type;
    const [items, total] = await Promise.all([
      Ledger.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Ledger.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  }),
);

// POST /ledgers
ledgerRouter.post(
  '/',
  requirePerm('ledgers.manage'),
  asyncHandler(async (req, res) => {
    const { name, phone, address, trn, openingBalance, type } = req.body ?? {};
    if (!name || !String(name).trim()) throw new HttpError(400, 'Ledger name is required');
    const ledger = await Ledger.create({
      name: String(name).trim(),
      phone,
      address,
      trn,
      openingBalance: num(openingBalance),
      type: type || 'customer',
    });
    res.status(201).json(ledger);
  }),
);

// GET /ledgers/:id
ledgerRouter.get(
  '/:id',
  requirePerm('ledgers.view'),
  asyncHandler(async (req, res) => {
    const ledger = await Ledger.findById(req.params.id).lean();
    if (!ledger) throw new HttpError(404, 'Ledger not found');
    res.json(ledger);
  }),
);

// PUT /ledgers/:id
ledgerRouter.put(
  '/:id',
  requirePerm('ledgers.manage'),
  asyncHandler(async (req, res) => {
    const { name, phone, address, trn, openingBalance, type } = req.body ?? {};
    const ledger = await Ledger.findByIdAndUpdate(
      req.params.id,
      {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(trn !== undefined ? { trn } : {}),
        ...(openingBalance !== undefined ? { openingBalance: num(openingBalance) } : {}),
        ...(type !== undefined ? { type } : {}),
      },
      { new: true, runValidators: true },
    );
    if (!ledger) throw new HttpError(404, 'Ledger not found');
    res.json(ledger);
  }),
);

// DELETE /ledgers/:id
ledgerRouter.delete(
  '/:id',
  requirePerm('ledgers.manage'),
  asyncHandler(async (req, res) => {
    const ledger = await Ledger.findByIdAndDelete(req.params.id);
    if (!ledger) throw new HttpError(404, 'Ledger not found');
    res.json({ ok: true });
  }),
);
