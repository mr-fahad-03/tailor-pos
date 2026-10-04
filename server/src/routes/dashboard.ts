import { Router } from 'express';
import { Sale } from '../models/Sale';
import { JobCard } from '../models/JobCard';
import { Ledger } from '../models/Ledger';
import { Product } from '../models/Product';
import { asyncHandler } from '../middleware';
import { r2 } from '../utils/money';
import { requireAuth, requirePerm } from '../auth/guard';

export const dashboardRouter = Router();

// Every endpoint below requires a signed-in user.
dashboardRouter.use(requireAuth);

function dayRange(d: Date) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// GET /dashboard/summary
dashboardRouter.get(
  '/summary',
  requirePerm('dashboard.view'),
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const { start: todayStart, end: todayEnd } = dayRange(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayAgg, monthAgg, openJobCards, totalCustomers, recentJobCards, lowStock] =
      await Promise.all([
        Sale.aggregate([
          { $match: { billDate: { $gte: todayStart, $lte: todayEnd }, isReturn: false } },
          { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
        ]),
        Sale.aggregate([
          { $match: { billDate: { $gte: monthStart }, isReturn: false } },
          { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
        ]),
        JobCard.countDocuments({ status: 'open' }),
        Ledger.countDocuments({ type: 'customer' }),
        JobCard.find({}).sort({ no: -1 }).limit(8).lean(),
        Product.find({ stockQty: { $lt: 10 } }).sort({ stockQty: 1 }).limit(8).lean(),
      ]);

    res.json({
      todaySales: r2(todayAgg[0]?.total ?? 0),
      todayBills: todayAgg[0]?.count ?? 0,
      monthSales: r2(monthAgg[0]?.total ?? 0),
      monthBills: monthAgg[0]?.count ?? 0,
      openJobCards,
      totalCustomers,
      recentJobCards,
      lowStock,
    });
  }),
);
