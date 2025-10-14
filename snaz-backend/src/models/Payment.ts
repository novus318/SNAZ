import mongoose, { Document, Schema } from 'mongoose';
import { BillEntityType } from './Bill';

export interface IPaymentAllocation {
  billId: mongoose.Types.ObjectId;
  amount: number;
}

export interface IPayment extends Document {
  entityType: BillEntityType;
  entityId: mongoose.Types.ObjectId;
  date: Date;
  amount: number;
  method: 'cash' | 'bank' | 'upi' | 'card' | 'other';
  reference?: string;
  notes?: string;
  allocations: IPaymentAllocation[]; // How this payment was applied
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAllocationSchema: Schema = new Schema({
  billId: { type: Schema.Types.ObjectId, ref: 'Bill', required: true },
  amount: { type: Number, required: true, min: 0 },
});

const PaymentSchema: Schema = new Schema({
  entityType: { type: String, enum: ['customer', 'company'], required: true, index: true },
  entityId: { type: Schema.Types.ObjectId, required: true, index: true },
  date: { type: Date, required: true },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ['cash', 'bank', 'upi', 'card', 'other'], default: 'cash' },
  reference: { type: String, trim: true },
  notes: { type: String, trim: true },
  allocations: { type: [PaymentAllocationSchema], default: [] },
}, { timestamps: true });

PaymentSchema.index({ entityType: 1, entityId: 1, date: -1 });

export default mongoose.model<IPayment>('Payment', PaymentSchema);

