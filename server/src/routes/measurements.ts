import { Router } from 'express';
import { Types } from 'mongoose';
import { MeasurementProfile } from '../models/MeasurementProfile';
import { Ledger } from '../models/Ledger';
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

/**
 * Attach the customer each person is filed under.
 *
 * Two different customers may each have a person called "Ali", so a name on
 * its own does not identify anybody — every list that spans customers carries
 * the owner's name and phone so the right one can be picked.
 */
async function withOwners(rows: any[]) {
  const ids = [...new Set(rows.map((r) => String(r.ledgerId)).filter(Boolean))];
  const owners = await Ledger.find({ _id: { $in: ids } })
    .select('name phone type')
    .lean();
  const byId = new Map(owners.map((o: any) => [String(o._id), o]));
  return rows.map((r) => {
    const owner = byId.get(String(r.ledgerId));
    return {
      ...r,
      ledgerName: owner?.name ?? '',
      ledgerPhone: owner?.phone ?? '',
      ledgerType: owner?.type ?? '',
    };
  });
}

// GET /measurements?ledgerId=&q=&page=&limit=&includeArchived=
// Without ledgerId this lists every person on file, which is what the
// Measurements screen and the name suggestions both read.
measurementRouter.get(
  '/',
  requirePerm('jobcards.view'),
  asyncHandler(async (req, res) => {
    const { ledgerId, includeArchived, q } = req.query as {
      ledgerId?: string;
      includeArchived?: string;
      q?: string;
    };

    const filter: Record<string, unknown> = {};
    if (ledgerId) {
      if (!Types.ObjectId.isValid(ledgerId)) throw new HttpError(400, 'Invalid customer');
      filter.ledgerId = ledgerId;
    }
    if (includeArchived !== 'true') filter.archived = { $ne: true };

    const search = String(q ?? '').trim();
    if (search) {
      const rx = new RegExp('^' + search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchingLedgers = await Ledger.find({
        $or: [{ name: rx }, { phone: rx }],
      }).select('_id').lean();

      const ledgerIds = matchingLedgers.map((l) => l._id);

      filter.$or = [
        { name: rx },
        { stitchingStyle: rx },
        { ledgerId: { $in: ledgerIds } },
      ];
    }

    // One customer's list is short; the global one is paged.
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || (ledgerId ? 200 : 50)));

    const [rows, total] = await Promise.all([
      MeasurementProfile.find(filter)
        .sort(ledgerId ? { name: 1 } : { lastUsedAt: -1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MeasurementProfile.countDocuments(filter),
    ]);

    res.json({ items: await withOwners(rows), total, page, limit });
  }),
);

// POST /measurements — create, or update the person of the same name
measurementRouter.post(
  '/',
  requirePerm('jobcards.create'),
  asyncHandler(async (req, res) => {
    const { ledgerId, name, stitchingStyle, fabric, size, note } = req.body ?? {};
    if (!ledgerId || !Types.ObjectId.isValid(String(ledgerId))) {
      throw new HttpError(400, 'Pick a customer before saving measurements');
    }
    const clean = String(name ?? '').trim();
    if (!clean) throw new HttpError(400, 'Give this person a name');
    const cleanStyle = stitchingStyle ? String(stitchingStyle).trim() : '';

    const filter = {
      ledgerId,
      name: clean,
      stitchingStyle: cleanStyle,
    };

    const doc = await MeasurementProfile.findOneAndUpdate(
      filter,
      {
        $set: {
          stitchingStyle: cleanStyle,
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
