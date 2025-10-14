import mongoose, { Document, Schema } from 'mongoose';

export type BillEntityType = 'customer' | 'company';

export interface IBillItem {
  categoryId: mongoose.Types.ObjectId;
  categoryName: string;
  unitPrice: number;
  quantity: number;
  amount: number;
}

export interface IBill extends Document {
  number: string;
  entityType: BillEntityType;
  entityId: mongoose.Types.ObjectId;
  periodYear: number;
  periodMonth: number; // 1-12
  startDate: Date;
  endDate: Date;
  items: IBillItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'unpaid' | 'partial' | 'paid' | 'cancelled';
  dueDate?: Date;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BillItemSchema: Schema = new Schema({
  categoryId: { type: Schema.Types.ObjectId, ref: 'FoodCategory', required: true },
  categoryName: { type: String, required: true, trim: true },
  unitPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
});

const BillSchema: Schema = new Schema({
  number: { type: String, required: true, unique: true },
  entityType: { type: String, enum: ['customer', 'company'], required: true, index: true },
  entityId: { type: Schema.Types.ObjectId, required: true, index: true },
  periodYear: { type: Number, required: true, index: true },
  periodMonth: { type: Number, required: true, index: true, min: 1, max: 12 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  items: [BillItemSchema],
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, required: true, min: 0, default: 0 },
  balanceAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['unpaid', 'partial', 'paid', 'cancelled'], default: 'unpaid' },
  dueDate: { type: Date },
  generatedAt: { type: Date, required: true, default: () => new Date() },
}, { timestamps: true });

BillSchema.index({ entityType: 1, entityId: 1, periodYear: 1, periodMonth: 1 }, { unique: true });

export default mongoose.model<IBill>('Bill', BillSchema);

