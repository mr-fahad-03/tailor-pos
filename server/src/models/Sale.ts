import { Schema, model, models, Document, Types } from 'mongoose';

export interface ISaleItem {
  code?: string;
  productName?: string;
  qty: number;
  rate: number;
  netRate: number;
  discPercent: number;
  discAmt: number;
  grossAmt: number;
  taxPercent: number;
  taxAmt: number;
  netAmount: number;
}

export interface ISale extends Document {
  billNo: number;
  billDate: Date;
  saleType: 'retail' | 'wholesale' | 'distributor';
  paymentType: 'cash' | 'credit';
  category: 'A' | 'B';
  creditCardNo?: string;
  jobCardRef?: string;
  jobCardId?: Types.ObjectId;
  salesman: string;
  partyName?: string;
  phone?: string;
  ledgerId?: Types.ObjectId;
  delDate?: Date;
  landmark?: string;
  trn?: string;
  vehicleNo?: string;
  items: ISaleItem[];
  totQty: number;
  grossAmount: number;
  discountAmt: number;
  additionalDiscount: number;
  taxAmt: number;
  freight: number;
  advanceAmount: number;
  netAmount: number;
  balance: number;
  isReturn: boolean;
}

const saleItemSchema = new Schema<ISaleItem>(
  {
    code: String,
    productName: String,
    qty: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    netRate: { type: Number, default: 0 },
    discPercent: { type: Number, default: 0 },
    discAmt: { type: Number, default: 0 },
    grossAmt: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 5 },
    taxAmt: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
  },
  { _id: false },
);

const saleSchema = new Schema<ISale>(
  {
    billNo: { type: Number, unique: true, index: true },
    billDate: { type: Date, default: Date.now },
    saleType: {
      type: String,
      enum: ['retail', 'wholesale', 'distributor'],
      default: 'retail',
    },
    paymentType: { type: String, enum: ['cash', 'credit'], default: 'cash' },
    category: { type: String, enum: ['A', 'B'], default: 'A' },
    creditCardNo: String,
    jobCardRef: { type: String, trim: true },
    jobCardId: { type: Schema.Types.ObjectId, ref: 'JobCard' },
    salesman: { type: String, default: 'GENERAL' },
    partyName: { type: String, trim: true },
    phone: { type: String, trim: true },
    ledgerId: { type: Schema.Types.ObjectId, ref: 'Ledger' },
    delDate: Date,
    landmark: String,
    trn: String,
    vehicleNo: String,
    items: { type: [saleItemSchema], default: [] },
    totQty: { type: Number, default: 0 },
    grossAmount: { type: Number, default: 0 },
    discountAmt: { type: Number, default: 0 },
    additionalDiscount: { type: Number, default: 0 },
    taxAmt: { type: Number, default: 0 },
    freight: { type: Number, default: 0 },
    advanceAmount: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    isReturn: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Sale = models.Sale || model<ISale>('Sale', saleSchema);
