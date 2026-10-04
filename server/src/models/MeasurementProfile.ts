import { Schema, model, models, Document, Model, Types } from 'mongoose';

/**
 * A saved set of measurements belonging to one person, filed under the
 * customer who brings the work in.
 *
 * One customer (say a father paying the bill) often has several people on
 * file — himself, his sons, a brother. Each order picks whichever of them is
 * being stitched for this time, so next visit he can order two thobes instead
 * of four without re-measuring anyone.
 */
export interface IMeasurementProfile extends Document {
  ledgerId: Types.ObjectId;
  name: string;
  fabric?: string;
  size?: string;
  values: Record<string, string>;
  note?: string;
  archived: boolean;
  lastUsedAt?: Date;
}

const measurementProfileSchema = new Schema<IMeasurementProfile>(
  {
    ledgerId: { type: Schema.Types.ObjectId, ref: 'Ledger', required: true, index: true },
    name: { type: String, required: true, trim: true },
    fabric: { type: String, trim: true },
    size: { type: String, trim: true },
    values: { type: Schema.Types.Mixed, default: {} },
    note: { type: String, trim: true },
    archived: { type: Boolean, default: false },
    lastUsedAt: { type: Date },
  },
  { timestamps: true },
);

// One person per name per customer — re-saving the same name updates them.
measurementProfileSchema.index({ ledgerId: 1, name: 1 }, { unique: true });

export const MeasurementProfile: Model<IMeasurementProfile> =
  (models.MeasurementProfile as Model<IMeasurementProfile>) ||
  model<IMeasurementProfile>('MeasurementProfile', measurementProfileSchema);
