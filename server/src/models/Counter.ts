import { Schema, model, models } from 'mongoose';

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

/**
 * Atomic auto-increment. The returned value is the number to use
 * (e.g. after seeding jobcard -> 13258, the next call returns 13259).
 */
export async function nextSeq(name: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean<{ seq: number }>();
  if (!doc) throw new Error(`Counter "${name}" could not be incremented`);
  return doc.seq;
}

/** Peek at the next value WITHOUT incrementing (for "next no" previews). */
export async function peekSeq(name: string, fallback = 0): Promise<number> {
  const doc = await Counter.findOne({ _id: name }).lean<{ seq: number }>();
  return (doc?.seq ?? fallback) + 1;
}

export const Counter = models.Counter || model('Counter', counterSchema);
