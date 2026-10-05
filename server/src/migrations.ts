import mongoose from 'mongoose';

/**
 * One-time index fixes, safe to run on every boot.
 *
 * Order numbers used to be unique at the field level. Drafts carry no number
 * at all, and Mongo counts every missing value as the same one, so that index
 * would reject the second draft ever saved. It is replaced by a partial index
 * that only polices documents which actually have a number.
 */
export async function runMigrations(): Promise<void> {
  const col = mongoose.connection.db?.collection('jobcards');
  if (!col) return;

  let existing: { name: string; key: Record<string, number>; unique?: boolean; partialFilterExpression?: unknown }[];
  try {
    existing = (await col.indexes()) as typeof existing;
  } catch {
    return; // Collection does not exist yet; Mongoose will build it correctly.
  }

  const stale = existing.find(
    (i) =>
      i.key?.no === 1 &&
      Object.keys(i.key).length === 1 &&
      i.unique &&
      !i.partialFilterExpression,
  );

  if (stale) {
    await col.dropIndex(stale.name);
    // eslint-disable-next-line no-console
    console.log(`[db] dropped stale unique index ${stale.name} on jobcards.no`);
  }
}
