import { Schema, model, models, Document } from 'mongoose';

/**
 * A product category the shop has defined.
 *
 * Categories used to be a fixed list of three in the Product schema, which
 * meant a shop that sold buttons or did alterations had nowhere to put them.
 * They are rows now so the counter can add one as the need arises.
 *
 * Nothing deletes a category that products still point at — see the route.
 */
export interface IProductCategory extends Document {
  name: string;
}

const productCategorySchema = new Schema<IProductCategory>(
  {
    // Stored as typed but compared without case, so "Fabric" and "fabric"
    // cannot both exist and split the same products across two categories.
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

productCategorySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);

export const ProductCategory =
  models.ProductCategory || model<IProductCategory>('ProductCategory', productCategorySchema);
