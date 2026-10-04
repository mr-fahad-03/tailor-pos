import { Schema, model, models, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, ROLES, Role } from '../auth/permissions';

export interface IUser extends Document {
  username: string;
  name: string;
  role: Role;
  permissions: string[];
  active: boolean;
  passwordHash: string;
  lastLoginAt?: Date;
  comparePassword(plain: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
    },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, default: 'salesman', required: true },
    permissions: [{ type: String, enum: PERMISSIONS }],
    active: { type: Boolean, default: true },
    passwordHash: { type: String, required: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

// Never leak the hash through res.json(user)
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const plain = ret as unknown as Record<string, unknown>;
    delete plain.passwordHash;
    delete plain.__v;
    return plain;
  },
});

userSchema.methods.comparePassword = function comparePassword(plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash);
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export const User: Model<IUser> =
  (models.User as Model<IUser>) || model<IUser>('User', userSchema);
