import { Router } from 'express';
import { Product } from '../models/Product';
import { asyncHandler, HttpError } from '../middleware';
import { num } from '../utils/money';
import { requireAuth, requirePerm } from '../auth/guard';

export const productRouter = Router();

// Every endpoint below requires a signed-in user.
productRouter.use(requireAuth);

function searchFilter(q?: string) {
  if (!q) return null;
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return { $or: [{ name: rx }, { code: rx }] };
}

/**
 * Narrow the catalogue to what a given picker may offer: the order's line
 * items take products marked `item`, the materials table takes `material`,
 * and `both` shows up in either. Products saved before `usage` existed have
 * no value for it and count as `both`, matching the model's default.
 */
function usageFilter(usableAs?: string) {
  if (usableAs !== 'item' && usableAs !== 'material') return null;
  return { $or: [{ usage: { $in: [usableAs, 'both'] } }, { usage: { $exists: false } }] };
}

// GET /products?q=&category=&usableAs=&page=&limit=
productRouter.get(
  '/',
  requirePerm('products.view'),
  asyncHandler(async (req, res) => {
    const { q, category, usableAs } = req.query as { q?: string; category?: string; usableAs?: string };
    const page = Math.max(num(req.query.page, 1), 1);
    const limit = Math.min(Math.max(num(req.query.limit, 50), 1), 500);
    // Both halves are `$or`s, so they have to be combined under `$and` rather
    // than spread into one object, where the second would clobber the first.
    const clauses = [searchFilter(q), usageFilter(usableAs)].filter(Boolean);
    const filter: Record<string, unknown> = clauses.length ? { $and: clauses } : {};
    if (category) filter.category = category;
    const [items, total] = await Promise.all([
      Product.find(filter).sort({ code: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  }),
);

// POST /products
productRouter.post(
  '/',
  requirePerm('products.manage'),
  asyncHandler(async (req, res) => {
    const { code, name, rate, wholesaleRate, category, usage, unit, stockQty } = req.body ?? {};
    if (!code || !String(code).trim()) throw new HttpError(400, 'Product code is required');
    if (!name || !String(name).trim()) throw new HttpError(400, 'Product name is required');
    const product = await Product.create({
      code: String(code).trim(),
      name: String(name).trim(),
      rate: num(rate),
      wholesaleRate: num(wholesaleRate),
      category: category || 'stitching',
      usage: usage || 'both',
      unit: unit || 'PCS',
      stockQty: num(stockQty),
    });
    res.status(201).json(product);
  }),
);

// GET /products/:id
productRouter.get(
  '/:id',
  requirePerm('products.view'),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id).lean();
    if (!product) throw new HttpError(404, 'Product not found');
    res.json(product);
  }),
);

// PUT /products/:id
productRouter.put(
  '/:id',
  requirePerm('products.manage'),
  asyncHandler(async (req, res) => {
    const { code, name, rate, wholesaleRate, category, usage, unit, stockQty } = req.body ?? {};
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        ...(code !== undefined ? { code: String(code).trim() } : {}),
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(rate !== undefined ? { rate: num(rate) } : {}),
        ...(wholesaleRate !== undefined ? { wholesaleRate: num(wholesaleRate) } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(usage !== undefined ? { usage } : {}),
        ...(unit !== undefined ? { unit } : {}),
        ...(stockQty !== undefined ? { stockQty: num(stockQty) } : {}),
      },
      { new: true, runValidators: true },
    );
    if (!product) throw new HttpError(404, 'Product not found');
    res.json(product);
  }),
);

// DELETE /products/:id
productRouter.delete(
  '/:id',
  requirePerm('products.manage'),
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw new HttpError(404, 'Product not found');
    res.json({ ok: true });
  }),
);
