import Bill, { IBill } from '../models/Bill';

export function monthDateRange(year: number, month: number) {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { startDate, endDate };
}

export async function generateNextBillNumber(prefix: string = 'BILL', year?: number, month?: number): Promise<string> {
  // Format: PREFIX-YYYYMM-####, sequence resets per YYYYMM
  const y = year ?? new Date().getUTCFullYear();
  const m = String((month ?? (new Date().getUTCMonth() + 1))).padStart(2, '0');
  const base = `${prefix}-${y}${m}`;
  const regex = new RegExp(`^${base}-\\d{4}$`);
  const last = await Bill.find({ number: { $regex: regex } }).sort({ number: -1 }).limit(1);
  let seq = 1;
  if (last.length > 0) {
    const parts = last[0].number.split('-');
    const lastPart = parts[parts.length - 1] || '0000';
    const parsed = parseInt(lastPart, 10);
    seq = isNaN(parsed) ? 1 : parsed + 1;
  }
  return `${base}-${String(seq).padStart(4, '0')}`;
}

export function recalcBillTotals(bill: IBill) {
  const subtotal = bill.items.reduce((s, i) => s + i.amount, 0);
  bill.subtotal = round2(subtotal);
  bill.totalAmount = round2(bill.subtotal + bill.tax);
  bill.balanceAmount = round2(Math.max(0, bill.totalAmount - (bill.paidAmount || 0)));
  bill.status = bill.balanceAmount === 0 ? 'paid' : (bill.paidAmount > 0 ? 'partial' : 'unpaid');
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
