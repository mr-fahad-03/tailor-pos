import { Router } from 'express';
import { Types } from 'mongoose';
import { MeasurementProfile } from '../models/MeasurementProfile';
import { asyncHandler, HttpError } from '../middleware';
import { requireAuth, requirePerm } from '../auth/guard';

export const measurementRouter = Router();

measurementRouter.use(requireAuth);

/** Keep only plain string values, so a stray object cannot land in the grid. */
function cleanValues(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) out[k] = s;
  }
  return out;
}

// GET /measurements?ledgerId=...&includeArchived=
measurementRouter.get(
  '/',
  requirePerm('jobcards.view'),
  asyncHandler(async (req, res) => {
    const { ledgerId, includeArchived } = req.query as {
      ledgerId?: string;
      includeArchived?: string;
    };
    if (!ledgerId) throw new HttpError(400, 'A customer is required to list measurements');
    if (!Types.ObjectId.isValid(ledgerId)) throw new HttpError(400, 'Invalid customer');

    const filter: Record<string, unknown> = { ledgerId };
    if (includeArchived !== 'true') filter.archived = { $ne: true };

    const items = await MeasurementProfile.find(filter).sort({ name: 1 }).lean();
    res.json({ items, total: items.length });
  }),
);

// POST /measurements — create, or update the person of the same name
measurementRouter.post(
  '/',
  requirePerm('jobcards.create'),
  asyncHandler(async (req, res) => {
    const { ledgerId, name, fabric, size, note } = req.body ?? {};
    if (!ledgerId || !Types.ObjectId.isValid(String(ledgerId))) {
      throw new HttpError(400, 'Pick a customer before saving measurements');
    }
    const clean = String(name ?? '').trim();
    if (!clean) throw new HttpError(400, 'Give this person a name');

    const doc = await MeasurementProfile.findOneAndUpdate(
      { ledgerId, name: clean },
      {
        $set: {
          fabric,
          size,
          note,
          values: cleanValues(req.body?.values),
          archived: false,
          lastUsedAt: new Date(),
        },
        $setOnInsert: { ledgerId, name: clean },
      },
      { new: true, upsert: true, runValidators: true },
    );
    res.status(201).json(doc);
  }),
);

// PUT /measurements/:id
measurementRouter.put(
  '/:id',
  requirePerm('jobcards.edit'),
  asyncHandler(async (req, res) => {
    const { name, fabric, size, note, archived } = req.body ?? {};
    const doc = await MeasurementProfile.findByIdAndUpdate(
      req.params.id,
      {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(fabric !== undefined ? { fabric } : {}),
        ...(size !== undefined ? { size } : {}),
        ...(note !== undefined ? { note } : {}),
        ...(archived !== undefined ? { archived: Boolean(archived) } : {}),
        ...(req.body?.values !== undefined ? { values: cleanValues(req.body.values) } : {}),
      },
      { new: true, runValidators: true },
    );
    if (!doc) throw new HttpError(404, 'Measurements not found');
    res.json(doc);
  }),
);

// DELETE /measurements/:id
measurementRouter.delete(
  '/:id',
  requirePerm('jobcards.edit'),
  asyncHandler(async (req, res) => {
    const doc = await MeasurementProfile.findByIdAndDelete(req.params.id);
    if (!doc) throw new HttpError(404, 'Measurements not found');
    res.json({ ok: true });
  }),
);
