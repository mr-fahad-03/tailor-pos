import { Schema, model, models, Document } from 'mongoose';

export type ProductCategory = 'stitching' | 'fabric' | 'material';

export interface IProduct extends Document {
  code: string;
  name: string;
  rate: number;
  wholesaleRate: number;
  category: ProductCategory;
  unit: string;
  stockQty: number;
}

const productSchema = new Schema<IProduct>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    rate: { type: Number, default: 0 },
    wholesaleRate: { type: Number, default: 0 },
    category: {
      type: String,
      enum: ['stitching', 'fabric', 'material'],
      default: 'stitching',
    },
    unit: { type: String, default: 'PCS' },
    stockQty: { type: Number, default: 0 },
  },
  { timestamps: true },
);

productSchema.index({ code: 'text', name: 'text' });

export const Product = models.Product || model<IProduct>('Product', productSchema);
