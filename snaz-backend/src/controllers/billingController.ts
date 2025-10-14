import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Customer from '../models/Customer';
import Company from '../models/Company';
import Bill from '../models/Bill';
import Payment from '../models/Payment';
import { CalculationEngine } from '../utils/calculationEngine';
import { generateNextBillNumber, monthDateRange, recalcBillTotals, round2 } from '../utils/billing';

function parseYearMonth(query: any) {
  const year = parseInt(query.year, 10);
  const month = parseInt(query.month, 10);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error('Invalid year or month');
  }
  return { year, month };
}

export async function generateMonthlyBills(req: Request, res: Response) {
  try {
    const { year, month } = req.body;
    if (!year || !month) {
      return res.status(400).json({ success: false, message: 'year and month are required' });
    }
    const { startDate, endDate } = monthDateRange(year, month);

    const activeCustomers = await Customer.find({ isActive: true }).populate('driverId', 'name').populate('packages.categoryId', 'name');

    const createdBills: any[] = [];

    for (const cust of activeCustomers) {
      // If bill exists for this period, update it; otherwise create new
      const exists = await Bill.findOne({ entityType: 'customer', entityId: cust._id, periodYear: year, periodMonth: month });

      const calc = await CalculationEngine.calculateCustomerMonthly(String(cust._id), startDate, endDate, 0); // tax separately
      if (!calc) continue;

      const items = calc.packageBreakdown.map(pb => ({
        categoryId: pb.categoryId as Types.ObjectId,
        categoryName: pb.categoryName,
        unitPrice: pb.unitPrice,
        quantity: pb.totalQuantity,
        amount: pb.totalAmount,
      }));
      const subtotal = round2(items.reduce((s, i) => s + i.amount, 0));
      const tax = 0; // apply GST later if needed
      const total = round2(subtotal + tax);

      let bill: any;
      if (exists) {
        exists.items = items as any;
        exists.subtotal = subtotal;
        exists.tax = tax;
        exists.totalAmount = total;
        exists.startDate = startDate;
        exists.endDate = endDate;
        exists.balanceAmount = round2(Math.max(0, total - (exists.paidAmount || 0)));
        exists.status = exists.balanceAmount === 0 ? 'paid' : ((exists.paidAmount || 0) > 0 ? 'partial' : 'unpaid');
        bill = await exists.save();
      } else {
        const number = await generateNextBillNumber('BILL-C', year, month);
        bill = new Bill({
          number,
          entityType: 'customer',
          entityId: cust._id,
          periodYear: year,
          periodMonth: month,
          startDate,
          endDate,
          items,
          subtotal,
          tax,
          totalAmount: total,
          paidAmount: 0,
          balanceAmount: total,
          status: 'unpaid',
          generatedAt: new Date(),
        });
        await bill.save();
      }

      // Auto-apply any advance payments for this customer
      await applyAdvancePayments('customer', cust._id as Types.ObjectId, bill);
      createdBills.push(bill);
    }

    // Generate company aggregated bills (sum of their customers' bills for the same period)
    const activeCompanies = await Company.find({ isActive: true });
    for (const comp of activeCompanies) {
      const exists = await Bill.findOne({ entityType: 'company', entityId: comp._id, periodYear: year, periodMonth: month });

      const custBills = await Bill.find({ entityType: 'customer', periodYear: year, periodMonth: month }).populate({ path: 'entityId', model: 'Customer', match: { companyId: comp._id } });
      const filtered = custBills.filter(b => (b as any).entityId); // only those belonging to this company
      if (filtered.length === 0) continue;

      const subtotal = round2(filtered.reduce((s, b) => s + b.subtotal, 0));
      const tax = 0;
      const total = round2(subtotal + tax);

      let bill: any;
      if (exists) {
        exists.items = [] as any;
        exists.subtotal = subtotal;
        exists.tax = tax;
        exists.totalAmount = total;
        exists.startDate = startDate;
        exists.endDate = endDate;
        exists.balanceAmount = round2(Math.max(0, total - (exists.paidAmount || 0)));
        exists.status = exists.balanceAmount === 0 ? 'paid' : ((exists.paidAmount || 0) > 0 ? 'partial' : 'unpaid');
        bill = await exists.save();
      } else {
        const number = await generateNextBillNumber('BILL-CO', year, month);
        bill = new Bill({
          number,
          entityType: 'company',
          entityId: comp._id,
          periodYear: year,
          periodMonth: month,
          startDate,
          endDate,
          items: [], // summary bill; details available in customer bills
          subtotal,
          tax,
          totalAmount: total,
          paidAmount: 0,
          balanceAmount: total,
          status: 'unpaid',
          generatedAt: new Date(),
        });
        await bill.save();
      }
      // Auto-apply any advance payments for this company
      await applyAdvancePayments('company', comp._id as Types.ObjectId, bill);
      createdBills.push(bill);
    }

    return res.json({ success: true, data: createdBills });
  } catch (error: any) {
    console.error('Error generating monthly bills:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to generate bills' });
  }
}

export async function listBills(req: Request, res: Response) {
  try {
    const { entityType, entityId, year, month, status } = req.query;
    const filter: any = {};
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = new Types.ObjectId(String(entityId));
    if (year) filter.periodYear = parseInt(String(year), 10);
    if (month) filter.periodMonth = parseInt(String(month), 10);
    if (status) filter.status = status;

    const bills = await Bill.find(filter)
      .sort({ periodYear: -1, periodMonth: -1, createdAt: -1 })
      .lean();

    // Attach entity names for UI
    const customerIds = bills.filter(b => b.entityType === 'customer').map(b => b.entityId) as any[];
    const companyIds = bills.filter(b => b.entityType === 'company').map(b => b.entityId) as any[];

    const [customers, companies] = await Promise.all([
      customerIds.length ? Customer.find({ _id: { $in: customerIds } }, { name: 1 }).lean() : [],
      companyIds.length ? Company.find({ _id: { $in: companyIds } }, { name: 1 }).lean() : [],
    ]);

    const customerMap = new Map(customers.map((c: any) => [String(c._id), c.name]));
    const companyMap = new Map(companies.map((c: any) => [String(c._id), c.name]));

    const data = bills.map(b => ({
      ...b,
      entityName: b.entityType === 'customer' ? customerMap.get(String(b.entityId)) : companyMap.get(String(b.entityId))
    }));

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch bills' });
  }
}

export async function getBill(req: Request, res: Response) {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
    res.json({ success: true, data: bill });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch bill' });
  }
}

export async function getLedger(req: Request, res: Response) {
  try {
    const { entityType, entityId } = req.query as any;
    if (!entityType || !entityId) return res.status(400).json({ success: false, message: 'entityType and entityId are required' });
    const et = String(entityType);
    const eid = new Types.ObjectId(String(entityId));

    const bills = await Bill.find({ entityType: et, entityId: eid }).lean();
    const payments = await Payment.find({ entityType: et, entityId: eid }).lean();

    const entries: any[] = [];
    bills.forEach(b => entries.push({ type: 'bill', date: b.generatedAt, ref: b.number, debit: b.totalAmount, credit: 0 }));
    payments.forEach(p => entries.push({ type: 'payment', date: p.date, ref: p.reference || p._id.toString(), debit: 0, credit: p.amount }));

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let running = 0;
    entries.forEach(e => {
      running += e.debit - e.credit;
      e.balance = round2(running);
    });
    res.json({ success: true, data: entries });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch ledger' });
  }
}

export async function generateMonthlyBillForEntity(req: Request, res: Response) {
  try {
    const { entityType, entityId, year, month } = req.body as any;
    if (!entityType || !entityId || !year || !month) {
      return res.status(400).json({ success: false, message: 'entityType, entityId, year, month are required' });
    }
    const { startDate, endDate } = monthDateRange(Number(year), Number(month));

    if (entityType === 'customer') {
      const customer = await Customer.findById(entityId).populate('packages.categoryId', 'name');
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

      const calc = await CalculationEngine.calculateCustomerMonthly(String(customer._id), startDate, endDate, 0);
      if (!calc) return res.status(500).json({ success: false, message: 'Calculation failed' });

      const items = calc.packageBreakdown.map(pb => ({
        categoryId: pb.categoryId as Types.ObjectId,
        categoryName: pb.categoryName,
        unitPrice: pb.unitPrice,
        quantity: pb.totalQuantity,
        amount: pb.totalAmount,
      }));
      const subtotal = round2(items.reduce((s, i) => s + i.amount, 0));
      const tax = 0;
      const total = round2(subtotal + tax);

      let bill = await Bill.findOne({ entityType: 'customer', entityId: customer._id, periodYear: year, periodMonth: month });
      if (bill) {
        bill.items = items as any;
        bill.subtotal = subtotal;
        bill.tax = tax;
        bill.totalAmount = total;
        bill.startDate = startDate;
        bill.endDate = endDate;
        bill.balanceAmount = round2(Math.max(0, total - (bill.paidAmount || 0)));
        bill.status = bill.balanceAmount === 0 ? 'paid' : ((bill.paidAmount || 0) > 0 ? 'partial' : 'unpaid');
        await bill.save();
      } else {
        const number = await generateNextBillNumber('BILL-C', year, month);
        bill = new Bill({
          number,
          entityType: 'customer',
          entityId: customer._id,
          periodYear: year,
          periodMonth: month,
          startDate,
          endDate,
          items,
          subtotal,
          tax,
          totalAmount: total,
          paidAmount: 0,
          balanceAmount: total,
          status: 'unpaid',
          generatedAt: new Date(),
        });
        await bill.save();
      }
      await applyAdvancePayments('customer', customer._id as Types.ObjectId, bill);
      return res.json({ success: true, data: bill });
    }

    if (entityType === 'company') {
      const company = await Company.findById(entityId);
      if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

      const custBills = await Bill.find({ entityType: 'customer', periodYear: year, periodMonth: month }).populate({ path: 'entityId', model: 'Customer', match: { companyId: company._id } });
      const filtered = custBills.filter(b => (b as any).entityId);
      if (filtered.length === 0) return res.status(400).json({ success: false, message: 'No customer bills for this company in the selected month' });

      const subtotal = round2(filtered.reduce((s, b) => s + b.subtotal, 0));
      const tax = 0;
      const total = round2(subtotal + tax);

      let bill = await Bill.findOne({ entityType: 'company', entityId: company._id, periodYear: year, periodMonth: month });
      if (bill) {
        bill.items = [] as any;
        bill.subtotal = subtotal;
        bill.tax = tax;
        bill.totalAmount = total;
        bill.startDate = startDate;
        bill.endDate = endDate;
        bill.balanceAmount = round2(Math.max(0, total - (bill.paidAmount || 0)));
        bill.status = bill.balanceAmount === 0 ? 'paid' : ((bill.paidAmount || 0) > 0 ? 'partial' : 'unpaid');
        await bill.save();
      } else {
        const number = await generateNextBillNumber('BILL-CO', year, month);
        bill = new Bill({
          number,
          entityType: 'company',
          entityId: company._id,
          periodYear: year,
          periodMonth: month,
          startDate,
          endDate,
          items: [],
          subtotal,
          tax,
          totalAmount: total,
          paidAmount: 0,
          balanceAmount: total,
          status: 'unpaid',
          generatedAt: new Date(),
        });
        await bill.save();
      }
      await applyAdvancePayments('company', company._id as Types.ObjectId, bill);
      return res.json({ success: true, data: bill });
    }

    return res.status(400).json({ success: false, message: 'Invalid entityType' });
  } catch (error: any) {
    console.error('Error generating bill for entity:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to generate bill' });
  }
}
async function applyAdvancePayments(
  entityType: 'customer' | 'company',
  entityId: Types.ObjectId,
  bill: any
) {
  try {
    if (!bill || bill.status === 'paid') return;

    // Find payments with unallocated amount
    const payments = await Payment.find({ entityType, entityId }).sort({ date: 1, createdAt: 1 });

    let remaining = bill.balanceAmount;
    for (const pay of payments) {
      if (remaining <= 0) break;
      const allocated = (pay.allocations || []).reduce((s, a) => s + a.amount, 0);
      const unallocated = Math.max(0, pay.amount - allocated);
      if (unallocated <= 0) continue;

      const toApply = Math.min(unallocated, remaining);
      if (toApply <= 0) continue;

      pay.allocations.push({ billId: bill._id, amount: toApply } as any);
      await pay.save();

      bill.paidAmount = (bill.paidAmount || 0) + toApply;
      bill.balanceAmount = Math.max(0, bill.totalAmount - bill.paidAmount);
      bill.status = bill.balanceAmount === 0 ? 'paid' : 'partial';
      await bill.save();

      // If this payment was a pure advance (no previous allocations) and now fully used on this bill,
      // set reference to bill number if not provided.
      if (allocated === 0 && (unallocated - toApply) === 0 && (!pay.reference || pay.reference.toLowerCase() === 'advance')) {
        pay.reference = bill.number;
        await pay.save();
      }

      remaining -= toApply;
    }
  } catch (err) {
    console.error('applyAdvancePayments error:', err);
  }
}
