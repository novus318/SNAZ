"use client";
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

type Payment = {
  _id: string;
  entityType: 'customer' | 'company';
  entityId: string;
  date: string;
  amount: number;
  method: string;
  reference?: string;
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filters, setFilters] = useState<{entityType?: 'customer'|'company'; entityId?: string}>({});

  const load = async () => {
    try {
      const data = await apiClient.getPayments(filters);
      setPayments(data);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load payments');
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <ProtectedRoute>
    <MainLayout>
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Payments</CardTitle>
        <div className="flex gap-2">
          <Input placeholder="Entity ID" value={filters.entityId || ''} onChange={e => setFilters(f => ({...f, entityId: e.target.value}))} />
          <Button onClick={load}>Filter</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Date</th>
                <th className="py-2">Type</th>
                <th className="py-2">Entity</th>
                <th className="py-2">Method</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2">Ref</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p._id} className="border-b">
                  <td className="py-2">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="py-2 capitalize">{p.entityType}</td>
                  <td className="py-2">{p.entityId}</td>
                  <td className="py-2">{p.method}</td>
                  <td className="py-2 text-right">{p.amount.toLocaleString()}</td>
                  <td className="py-2">{p.reference || '-'}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-gray-500">No payments</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
    </MainLayout>
    </ProtectedRoute>
  );
}
