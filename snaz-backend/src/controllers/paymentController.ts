import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Bill from '../models/Bill';
import Payment from '../models/Payment';
import { round2 } from '../utils/billing';

export async function recordPayment(req: Request, res: Response) {
  try {
    const { entityType, entityId, amount, date, method, reference, notes, billId } = req.body;
    if (!entityType || !entityId || !amount || !date) {
      return res.status(400).json({ success: false, message: 'entityType, entityId, amount, date are required' });
    }
    const payment = new Payment({ entityType, entityId, amount, date, method, reference, notes, allocations: [] });

    let remaining = Number(amount);
    const targetBills = billId ?
      await Bill.find({ _id: billId }) :
      await Bill.find({ entityType, entityId, status: { $in: ['unpaid', 'partial'] } }).sort({ periodYear: 1, periodMonth: 1, createdAt: 1 });

    for (const bill of targetBills) {
      if (remaining <= 0) break;
      const toApply = Math.min(remaining, bill.balanceAmount);
      if (toApply <= 0) continue;
      payment.allocations.push({ billId: bill._id as Types.ObjectId, amount: toApply });
      bill.paidAmount = round2((bill.paidAmount || 0) + toApply);
      bill.balanceAmount = round2(Math.max(0, bill.totalAmount - bill.paidAmount));
      bill.status = bill.balanceAmount === 0 ? 'paid' : 'partial';
      await bill.save();
      remaining = round2(remaining - toApply);
    }

    // If no allocations were made and no reference provided, mark as ADVANCE for clarity
    const allocatedTotal = payment.allocations.reduce((s, a) => s + a.amount, 0);
    if (allocatedTotal === 0 && (!payment.reference || payment.reference.trim() === '')) {
      payment.reference = 'ADVANCE';
    }
    await payment.save();
    return res.status(201).json({ success: true, data: payment, message: remaining > 0 ? `Advance recorded: ${remaining}` : undefined });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to record payment' });
  }
}

export async function listPayments(req: Request, res: Response) {
  try {
    const { entityType, entityId } = req.query as any;
    const filter: any = {};
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = new Types.ObjectId(String(entityId));
    const payments = await Payment.find(filter).sort({ date: -1, createdAt: -1 });
    res.json({ success: true, data: payments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch payments' });
  }
}
