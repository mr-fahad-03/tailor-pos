import { Schema, model, models, Document } from 'mongoose';

export interface ILedger extends Document {
  name: string;
  phone?: string;
  address?: string;
  trn?: string;
  openingBalance: number;
  type: 'customer' | 'supplier' | 'wholesaler' | 'general';
}

const ledgerSchema = new Schema<ILedger>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    trn: { type: String, trim: true },
    openingBalance: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ['customer', 'supplier', 'wholesaler', 'general'],
      default: 'customer',
    },
  },
  { timestamps: true },
);

ledgerSchema.index({ name: 'text', phone: 'text' });

export const Ledger = models.Ledger || model<ILedger>('Ledger', ledgerSchema);
