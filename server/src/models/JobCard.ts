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

export type JobCardStatus = 'open' | 'closed' | 'converted';

export interface IJobCard extends Document {
  no: number;
  bookNo: number;
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
    no: { type: Number, unique: true, index: true },
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
      enum: ['open', 'closed', 'converted'],
      default: 'open',
    },
    closedAt: Date,
  },
  { timestamps: true },
);

export const JobCard =
  models.JobCard || model<IJobCard>('JobCard', jobCardSchema);
