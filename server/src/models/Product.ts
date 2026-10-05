import { Schema, model, models, Document } from 'mongoose';

export type ProductCategory = 'stitching' | 'fabric' | 'material';

/**
 * Where a product may be used on an order: as a charged line item, as a
 * material consumed for a person, or as either. Separate from `category`,
 * which says what the product *is* rather than how it is used.
 */
export type ProductUsage = 'item' | 'material' | 'both';

export interface IProduct extends Document {
  code: string;
  name: string;
  rate: number;
  wholesaleRate: number;
  category: ProductCategory;
  usage: ProductUsage;
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
    // 'both' by default so a product added before this existed stays usable
    // everywhere rather than quietly vanishing from one of the two pickers.
    usage: {
      type: String,
      enum: ['item', 'material', 'both'],
      default: 'both',
    },
    unit: { type: String, default: 'PCS' },
    stockQty: { type: Number, default: 0 },
  },
  { timestamps: true },
);

productSchema.index({ code: 'text', name: 'text' });

export const Product = models.Product || model<IProduct>('Product', productSchema);
