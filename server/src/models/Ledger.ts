import { Schema, model, models, Document } from 'mongoose';

/**
 * A card kept against a customer so a regular is not asked to read their
 * details out on every visit.
 *
 * Only what is safe to keep is here. The full card number is never stored —
 * the last four is all anyone needs to recognise a card — and the CVC is never
 * stored at all. Keeping either once a payment has been taken is forbidden,
 * and neither is any use to the shop afterwards.
 */
export interface ISavedCard {
  holder?: string;
  last4?: string;
  /** MM/YY, as printed on the card. */
  expiry?: string;
}

/** A bank account kept against a customer, for transfers. */
export interface ISavedBank {
  bankName?: string;
  accountName?: string;
  iban?: string;
  /** The bank's SWIFT/BIC code. */
  swift?: string;
}

export interface ILedger extends Document {
  name: string;
  /** The mobile number. Kept as `phone` so older records still read. */
  phone?: string;
  altPhone?: string;
  landline?: string;
  /** Short human-facing code. Generated on creation when none is given. */
  contactId?: string;
  customerGroup?: string;
  businessName?: string;
  /** The person dealt with at a company — a supplier's salesman. */
  contactPerson?: string;
  /** Bill the business name rather than the person's. */
  invoiceOnCompanyName: boolean;
  email?: string;
  dob?: Date;
  assignedTo?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  /** Free-text address from before the fields below existed. */
  address?: string;
  trn?: string;
  openingBalance: number;
  payTerm?: number;
  payTermUnit?: 'days' | 'months';
  /** Null or absent means no limit, which is not the same as a limit of 0. */
  creditLimit?: number | null;
  type: 'customer' | 'supplier' | 'general';
  savedCards: ISavedCard[];
  savedBanks: ISavedBank[];
}

const savedCardSchema = new Schema<ISavedCard>({
  holder: { type: String, trim: true },
  last4: { type: String, trim: true },
  expiry: { type: String, trim: true },
});

const savedBankSchema = new Schema<ISavedBank>({
  bankName: { type: String, trim: true },
  accountName: { type: String, trim: true },
  iban: { type: String, trim: true, uppercase: true },
  swift: { type: String, trim: true, uppercase: true },
});

const ledgerSchema = new Schema<ILedger>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    phone: { type: String, trim: true },
    altPhone: { type: String, trim: true },
    landline: { type: String, trim: true },
    // Sparse, because the uniqueness must hold among the records that have
    // one — without it every record missing a contact id would collide.
    contactId: { type: String, trim: true, unique: true, sparse: true },
    customerGroup: { type: String, trim: true },
    businessName: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    invoiceOnCompanyName: { type: Boolean, default: false },
    email: { type: String, trim: true, lowercase: true },
    dob: { type: Date },
    assignedTo: { type: String, trim: true },
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    zip: { type: String, trim: true },
    address: { type: String, trim: true },
    trn: { type: String, trim: true },
    openingBalance: { type: Number, default: 0 },
    payTerm: { type: Number },
    payTermUnit: { type: String, enum: ['days', 'months'], default: 'days' },
    creditLimit: { type: Number, default: null },
    type: {
      type: String,
      enum: ['customer', 'supplier', 'general'],
      default: 'customer',
    },
    savedCards: { type: [savedCardSchema], default: [] },
    savedBanks: { type: [savedBankSchema], default: [] },
  },
  { timestamps: true },
);

ledgerSchema.index({ name: 'text', phone: 'text' });

export const Ledger = models.Ledger || model<ILedger>('Ledger', ledgerSchema);
