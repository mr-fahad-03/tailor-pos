import { connectDb } from './db';
import mongoose from 'mongoose';
import { Ledger } from './models/Ledger';
import { Product } from './models/Product';
import { Counter } from './models/Counter';
import { User, hashPassword } from './models/User';
import { ROLE_DEFAULTS } from './auth/permissions';
import { config } from './config';

/**
 * Seed reference data: ledgers (from the old PAC "Find Ledger" screen),
 * core products, and the auto-number counters so numbering continues
 * where the old system left off (stitching orders at 13258, bills at 85934).
 *
 * Run with: npm run seed   (from server/)
 */
async function seed() {
  await connectDb();

  const ledgers: { name: string; phone?: string; type?: string }[] = [
    { name: 'BLISS TEXTILE TRADING L.L.C.', phone: '+971 4 3513529', type: 'supplier' },
    { name: 'KEWALRAM & SONS L.L.C', phone: '+971 4 3535627', type: 'supplier' },
    { name: 'NOJOOM AL MARWA GENERAL TRADING', phone: '+971 6 7310531', type: 'supplier' },
    { name: 'jumah', phone: '050227677' },
    { name: 'ALI AWOD', phone: '0554445400' },
    { name: 'AMER MONSOORI', phone: '00504226697' },
    { name: 'BADER ALI', phone: '00911533249449' },
    { name: 'DHAWI', phone: '0096650535365259' },
    { name: 'MAJID', phone: '00966504592877' },
    { name: 'TARAK', phone: '0543810304' },
    { name: 'AMU BOKHIT', phone: '0552272274' },
    { name: 'ZAINULLA', phone: '05453528' },
  ];

  for (const l of ledgers) {
    await Ledger.updateOne(
      { name: l.name },
      { $setOnInsert: { name: l.name, phone: l.phone, type: l.type || 'customer', openingBalance: 0 } },
      { upsert: true },
    );
  }

  const products = [
    { code: '5001', name: 'ARABI BIG', rate: 138.1, wholesaleRate: 130, category: 'stitching', unit: 'PCS', stockQty: 100 },
    { code: '5002', name: 'KUWAITI BIG', rate: 119.05, wholesaleRate: 112, category: 'stitching', unit: 'PCS', stockQty: 100 },
    { code: '936', name: 'LUBBAN', rate: 119.05, wholesaleRate: 110, category: 'fabric', unit: 'MTR', stockQty: 250 },
  ];

  for (const p of products) {
    await Product.updateOne({ code: p.code }, { $setOnInsert: p }, { upsert: true });
  }

  // Continue numbering from the old system
  await Counter.updateOne({ _id: 'jobcard' }, { $set: { seq: 13258 } }, { upsert: true });
  await Counter.updateOne({ _id: 'sale' }, { $set: { seq: 85934 } }, { upsert: true });

  // --- Users -------------------------------------------------------------
  // Only ever created, never overwritten: re-running the seed must not reset
  // a password someone has already changed.
  const seedUsers: { username: string; name: string; role: 'super_admin' | 'admin' | 'salesman'; password: string }[] = [
    {
      username: config.seedAdminUser.toLowerCase(),
      name: 'Super Admin',
      role: 'super_admin',
      password: config.seedAdminPass,
    },
    { username: 'admin', name: 'Shop Admin', role: 'admin', password: 'Admin@12345' },
    { username: 'salesman', name: 'Counter Salesman', role: 'salesman', password: 'Sales@12345' },
  ];

  const created: string[] = [];
  for (const u of seedUsers) {
    const exists = await User.findOne({ username: u.username }).lean();
    if (exists) continue;
    await User.create({
      username: u.username,
      name: u.name,
      role: u.role,
      permissions: ROLE_DEFAULTS[u.role],
      active: true,
      passwordHash: await hashPassword(u.password),
    });
    created.push(`${u.username} (${u.role})`);
  }

  /* eslint-disable no-console */
  console.log('[seed] done: ledgers, products, counters (jobcard=13258, sale=85934)');
  if (created.length) {
    console.log(`[seed] users created: ${created.join(', ')}`);
    console.log('[seed] CHANGE THESE PASSWORDS after first sign-in.');
  } else {
    console.log('[seed] users already present — left untouched');
  }
  /* eslint-enable no-console */
  await mongoose.disconnect();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed:fatal]', err);
  process.exit(1);
});
