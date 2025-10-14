"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

type Bill = {
  _id: string;
  number: string;
  entityType: 'customer' | 'company';
  entityId: string;
  periodYear: number;
  periodMonth: number;
  startDate: string;
  endDate: string;
  items: { categoryName: string; unitPrice: number; quantity: number; amount: number }[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'unpaid' | 'partial' | 'paid' | 'cancelled';
};

export default function BillDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getBill(id);
      setBill(data);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load bill');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);


  if (!bill) return <ProtectedRoute><MainLayout><div className="p-4">Loading...</div></MainLayout></ProtectedRoute>;

  return (
    <ProtectedRoute>
    <MainLayout>
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Bill {bill.number}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div><div className="text-gray-500 text-sm">Type</div><div className="capitalize">{bill.entityType}</div></div>
            <div><div className="text-gray-500 text-sm">Period</div><div>{bill.periodYear}-{String(bill.periodMonth).padStart(2,'0')}</div></div>
            <div><div className="text-gray-500 text-sm">Status</div><div className="capitalize">{bill.status}</div></div>
          </div>
          <div className="overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 px-2">Category</th>
                  <th className="py-2 px-2 text-right">Unit</th>
                  <th className="py-2 px-2 text-right">Qty</th>
                  <th className="py-2 px-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((it, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 px-2">{it.categoryName}</td>
                    <td className="py-2 px-2 text-right">{it.unitPrice}</td>
                    <td className="py-2 px-2 text-right">{it.quantity}</td>
                    <td className="py-2 px-2 text-right">{it.amount.toLocaleString()}</td>
                  </tr>
                ))}
                {bill.items.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-gray-500">No line items</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr><td colSpan={3} className="py-2 px-2 text-right font-medium">Subtotal</td><td className="py-2 px-2 text-right">{bill.subtotal.toLocaleString()}</td></tr>
                <tr><td colSpan={3} className="py-2 px-2 text-right font-medium">Tax</td><td className="py-2 px-2 text-right">{bill.tax.toLocaleString()}</td></tr>
                <tr><td colSpan={3} className="py-2 px-2 text-right font-bold">Total</td><td className="py-2 px-2 text-right font-bold">{bill.totalAmount.toLocaleString()}</td></tr>
                <tr><td colSpan={3} className="py-2 px-2 text-right">Paid</td><td className="py-2 px-2 text-right">{(bill.paidAmount||0).toLocaleString()}</td></tr>
                <tr><td colSpan={3} className="py-2 px-2 text-right font-bold">Balance</td><td className="py-2 px-2 text-right font-bold">{bill.balanceAmount.toLocaleString()}</td></tr>
              </tfoot>
            </table>
          </div>

          {/* Payments are managed from Customer/Company page */}
        </CardContent>
      </Card>
    </div>
    </MainLayout>
    </ProtectedRoute>
  );
}
