import { Router } from 'express';
import { AuditLog } from '../models/AuditLog';
import { asyncHandler } from '../middleware';
import { requireAuth, requireSuperAdmin } from '../auth/guard';

export const auditRouter = Router();

// The change log is Super Admin only, top to bottom.
auditRouter.use(requireAuth, requireSuperAdmin);

/**
 * GET /audit?q=&action=&entityId=&page=&limit=
 *
 * Newest first. `q` matches the order number, its ref, the customer on it, or
 * who made the change.
 */
auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const q = String(req.query.q ?? '').trim();
    const action = String(req.query.action ?? '').trim();
    const entityId = String(req.query.entityId ?? '').trim();

    const filter: Record<string, unknown> = {};
    if (entityId) filter.entityId = entityId;
    if (action) filter.action = action;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const asNo = Number(q);
      filter.$or = [
        { entityRef: rx },
        { partyName: rx },
        { userName: rx },
        { username: rx },
        ...(Number.isFinite(asNo) ? [{ entityNo: asNo }] : []),
      ];
    }

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ items, total, page, limit });
  }),
);
