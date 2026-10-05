import { Schema, model, models, Document, Types } from 'mongoose';

export interface IJobCardItem {
  code?: string;
  productName?: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface IJobCardMaterial {
  code?: string;
  productName?: string;
  qty: number;
  rate: number;
}

export interface IJobCardPayment {
  date: Date;
  mode: 'cash' | 'bank' | 'card' | 'credit';
  amount: number;
  bank?: string;
  reference?: string;
  discount: number;
  note?: string;
}

/** 'draft' is an order abandoned part-finished — it is not real work yet. */
export type JobCardStatus = 'draft' | 'open' | 'closed' | 'converted';

export interface IJobCard extends Document {
  /** Assigned only when the order becomes real; a draft has none. */
  no?: number;
  bookNo: number;
  /** Drafts are numbered from their own series so they consume no order numbers. */
  draftNo?: number;
  ref: string;
  date: Date;
  deliveryDate?: Date;
  partyName?: string;
  phone?: string;
  ledgerId?: Types.ObjectId;
  isNewCustomer: boolean;
  accountsAc?: string;
  invoiceNo?: string;
  items: IJobCardItem[];
  total: number;
  /** Express work, delivery and the like — taxed with the order. */
  additionalCharges: number;
  discount: number;
  tax: number;
  netAmount: number;
  /** Legacy single set — kept so old cards and prints still work. */
  measurements: Record<string, string>;
  fabric?: string;
  size?: string;
  /** One entry per person being stitched for on this order. */
  measurementSets: {
    profileId?: string;
    name: string;
    fabric?: string;
    size?: string;
    qty: number;
    values: Record<string, string>;
    /** Materials consumed for this person. */
    materials: IJobCardMaterial[];
  }[];
  materialsUsed: IJobCardMaterial[];
  materialTotal: number;
  jobCost: number;
  advance: number;
  advanceBeforeTax: number;
  advanceTax: number;
  balance: number;
  paymentMode: 'cash' | 'bank' | 'card';
  bank?: string;
  creditCardNo?: string;
  payments: IJobCardPayment[];
  status: JobCardStatus;
  closedAt?: Date;
}

const itemSchema = new Schema<IJobCardItem>(
  {
    code: String,
    productName: String,
    qty: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
);

const materialSchema = new Schema<IJobCardMaterial>(
  {
    code: String,
    productName: String,
    qty: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
  },
  { _id: false },
);

const paymentSchema = new Schema<IJobCardPayment>(
  {
    date: { type: Date, default: Date.now },
    mode: {
      type: String,
      enum: ['cash', 'bank', 'card', 'credit'],
      default: 'cash',
    },
    amount: { type: Number, default: 0 },
    bank: String,
    reference: String,
    discount: { type: Number, default: 0 },
    note: String,
  },
  { _id: false },
);

const jobCardSchema = new Schema<IJobCard>(
  {
    // Not unique at field level: a draft carries no number, and Mongo would
    // treat every missing value as the same one. The partial index below makes
    // the number unique among real orders only.
    no: { type: Number },
    draftNo: { type: Number, index: true },
    bookNo: { type: Number, default: 270 },
    ref: { type: String, unique: true, index: true, trim: true },
    date: { type: Date, default: Date.now },
    deliveryDate: Date,
    partyName: { type: String, trim: true },
    phone: { type: String, trim: true },
    ledgerId: { type: Schema.Types.ObjectId, ref: 'Ledger' },
    isNewCustomer: { type: Boolean, default: false },
    accountsAc: { type: String, trim: true },
    invoiceNo: { type: String, trim: true },
    items: { type: [itemSchema], default: [] },
    total: { type: Number, default: 0 },
    additionalCharges: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    measurements: { type: Schema.Types.Mixed, default: {} },
    fabric: String,
    size: String,
    measurementSets: {
      type: [
        new Schema(
          {
            profileId: { type: String },
            name: { type: String, required: true, trim: true },
            fabric: { type: String, trim: true },
            size: { type: String, trim: true },
            qty: { type: Number, default: 1, min: 0 },
            values: { type: Schema.Types.Mixed, default: {} },
            materials: { type: [materialSchema], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    materialsUsed: { type: [materialSchema], default: [] },
    materialTotal: { type: Number, default: 0 },
    jobCost: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    advanceBeforeTax: { type: Number, default: 0 },
    advanceTax: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    paymentMode: {
      type: String,
      enum: ['cash', 'bank', 'card'],
      default: 'cash',
    },
    bank: String,
    creditCardNo: String,
    payments: { type: [paymentSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'open', 'closed', 'converted'],
      default: 'open',
    },
    closedAt: Date,
  },
  { timestamps: true },
);

/**
 * Order numbers must stay unique and gapless, so only real orders hold one.
 * A partial index enforces uniqueness across those, while leaving any number
 * of drafts — which have no `no` at all — perfectly legal.
 */
jobCardSchema.index(
  { no: 1 },
  { unique: true, partialFilterExpression: { no: { $type: 'number' } } },
);

export const JobCard =
  models.JobCard || model<IJobCard>('JobCard', jobCardSchema);
