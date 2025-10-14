"use client";
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import Link from 'next/link';
import { toast } from 'sonner';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

type Bill = {
  _id: string;
  number: string;
  entityType: 'customer' | 'company';
  entityId: string;
  entityName?: string;
  periodYear: number;
  periodMonth: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'unpaid' | 'partial' | 'paid' | 'cancelled';
  generatedAt: string;
};

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const load = async () => {
    setLoading(true);
    try {
      const data: Bill[] = await apiClient.getBills();
      // If backend didn't include names, enrich on client
      const needNames = data.filter(b => !b.entityName);
      if (needNames.length > 0) {
        const custIds = Array.from(new Set(needNames.filter(b => b.entityType === 'customer').map(b => b.entityId)));
        const compIds = Array.from(new Set(needNames.filter(b => b.entityType === 'company').map(b => b.entityId)));
        const nameMap = new Map<string, string>();
        // Fetch names individually to avoid downloading all
        await Promise.all([
          ...custIds.map(async (id) => {
            try { const c = await apiClient.getCustomer(id); nameMap.set(id, c.name); } catch {}
          }),
          ...compIds.map(async (id) => {
            try { const c = await apiClient.getCompany(id); nameMap.set(id, c.name); } catch {}
          })
        ]);
        const enriched = data.map(b => ({ ...b, entityName: b.entityName || nameMap.get(b.entityId) }));
        setBills(enriched);
      } else {
        setBills(data);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleGenerate = async () => {
    try {
      await apiClient.generateBills({ year, month });
      toast.success('Bills generated');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate');
    }
  };

  return (
    <ProtectedRoute>
    <MainLayout>
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Monthly Bills</CardTitle>
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Year</span>
              <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value || '0', 10))} className="w-28" placeholder="Year" />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-sm text-gray-600">Month</span>
              <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v, 10))}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m, idx) => (
                    <SelectItem key={m} value={String(idx + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={loading}>Generate</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Bill No</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Period</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 text-right">Paid</th>
                  <th className="py-2 text-right">Balance</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(b => (
                  <tr key={b._id} className="border-b">
                    <td className="py-2 font-medium">{b.number}</td>
                    <td className="py-2 capitalize">{b.entityType}</td>
                    <td className="py-2">
                      <Link 
                        className="text-blue-600 hover:underline"
                        href={b.entityType === 'customer' ? `/customers/${b.entityId}` : `/companies/${b.entityId}`}
                      >
                        {b.entityName || b.entityId}
                      </Link>
                    </td>
                    <td className="py-2">{b.periodYear}-{String(b.periodMonth).padStart(2,'0')}</td>
                    <td className="py-2 text-right">{b.totalAmount.toLocaleString()}</td>
                    <td className="py-2 text-right">{(b.paidAmount||0).toLocaleString()}</td>
                    <td className="py-2 text-right">{b.balanceAmount.toLocaleString()}</td>
                    <td className="py-2 capitalize">{b.status}</td>
                  </tr>
                ))}
                {bills.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-500">No bills yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
    </MainLayout>
    </ProtectedRoute>
  );
}
