"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Building2, Users, Phone, Mail, MapPin, Plus } from "lucide-react";
import { apiClient, Company, Customer, Driver, FoodCategory } from "@/lib/api";
import { toast } from "sonner";
import { CustomersDataTable } from "@/components/customers/CustomersDataTable";
import QuickCustomerForm from "@/components/customers/QuickCustomerForm";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;
  
  const [company, setCompany] = useState<Company | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [foodCategories, setFoodCategories] = useState<FoodCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    driverId: "",
    packages: [{ categoryId: "", unitPrice: 0 }],
    dailyFood: {
      lunch: "",
      dinner: ""
    },
    startDate: "",
    endDate: ""
  });
  // Billing & payments
  const [outstanding, setOutstanding] = useState<number>(0);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [payMethod, setPayMethod] = useState<'cash'|'bank'|'upi'|'card'|'other'>('cash');
  const [payRef, setPayRef] = useState('');
  const [genLoading, setGenLoading] = useState(false);

  // Define loadData before using it in effects to avoid TDZ errors
  const loadData = useCallback(async () => {
    try {
      const [companyData, companyCustomers, driversData, categoriesData] = await Promise.all([
        apiClient.getCompany(companyId),
        apiClient.getCompanyCustomers(companyId),
        apiClient.getDrivers(),
        apiClient.getFoodCategories()
      ]);
      
      setCompany(companyData);
      setCustomers(companyCustomers);
      setDrivers(driversData);
      setFoodCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load company details:', error);
      toast.error("Failed to load company details");
      router.push("/companies");
    } finally {
      setLoading(false);
    }
  }, [companyId, router]);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId, loadData]);

  useEffect(() => {
    if (companyId) {
      loadBilling();
    }
  }, [companyId]);

  const loadBilling = async () => {
    try {
      const [bills, payments] = await Promise.all([
        apiClient.getBills({ entityType: 'company', entityId: companyId }),
        apiClient.getPayments({ entityType: 'company', entityId: companyId })
      ]);
      const bal = bills.reduce((s: number, b: any) => s + (b.balanceAmount || 0), 0);
      setOutstanding(bal);
      setRecentPayments(payments.slice(0, 5));
    } catch (e) { /* ignore */ }
  };

  const submitPayment = async () => {
    try {
      const amt = parseFloat(payAmount);
      if (!amt || amt <= 0) return toast.error('Enter valid amount');
      await apiClient.recordPayment({ entityType: 'company', entityId: companyId, amount: amt, date: payDate, method: payMethod, reference: payRef });
      toast.success('Payment recorded');
      setPayAmount('');
      setPayRef('');
      await loadBilling();
    } catch (e: any) {
      toast.error(e.message || 'Failed to record payment');
    }
  };

  const generateBillForCurrentMonth = async () => {
    try {
      setGenLoading(true);
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      await apiClient.generateBillForEntity({ entityType: 'company', entityId: companyId, year: y, month: m });
      toast.success(`Bill generated for ${now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`);
      await loadBilling();
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate bill');
    } finally {
      setGenLoading(false);
    }
  };

  const handleQuickFormSubmit = async (submittedFormData: Record<string, any>) => {
    try {
      const validPackages = submittedFormData.packages.filter((pkg: Record<string, any>) => pkg.categoryId && pkg.unitPrice > 0);
      if (validPackages.length === 0) {
        toast.error("At least one package with valid category and price is required");
        return;
      }

      const customerData = {
        ...submittedFormData,
        companyId: companyId, // Set the company ID
        packages: validPackages
      };

      if (editingCustomer) {
        const updatedCustomer = await apiClient.updateCustomer(editingCustomer._id, customerData);
        setCustomers(customers.map(c => c._id === updatedCustomer._id ? updatedCustomer : c));
        toast.success("Customer updated successfully");
      } else {
        const newCustomer = await apiClient.createCustomer(customerData);
        setCustomers([...customers, newCustomer]);
        toast.success("Customer created successfully");
      }
      setShowAddForm(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error('Failed to save customer:', error);
      toast.error(editingCustomer ? "Failed to update customer" : "Failed to create customer");
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      address: customer.address,
      phone: customer.phone || "",
      driverId: typeof customer.driverId === 'string' ? customer.driverId : customer.driverId._id,
      packages: customer.packages.map(pkg => ({
        categoryId: typeof pkg.categoryId === 'string' ? pkg.categoryId : pkg.categoryId._id,
        unitPrice: pkg.unitPrice
      })),
      dailyFood: customer.dailyFood,
      startDate: customer.startDate.split('T')[0],
      endDate: customer.endDate ? customer.endDate.split('T')[0] : ""
    });
    setShowAddForm(true);
  };

  const handleDelete = async (customer: Customer) => {
    if (window.confirm(`Are you sure you want to delete customer "${customer.name}"?`)) {
      try {
        await apiClient.deleteCustomer(customer._id);
        setCustomers(customers.filter(c => c._id !== customer._id));
        toast.success("Customer deleted successfully");
      } catch (error) {
        console.error('Failed to delete customer:', error);
        toast.error("Failed to delete customer");
      }
    }
  };

  const handleAddNew = () => {
    setEditingCustomer(null);
    setFormData({
      name: "",
      address: "",
      phone: "",
      driverId: "",
      packages: [{ categoryId: "", unitPrice: 0 }],
      dailyFood: { lunch: "", dinner: "" },
      startDate: "",
      endDate: ""
    });
    setShowAddForm(true);
  };

  if (loading) {
    return (
    <ProtectedRoute>
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          Loading company details...
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
  }

  if (!company) {
    return (
    <ProtectedRoute>
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          Company not found
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
  }

  return (
    <ProtectedRoute>
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 truncate">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                <span className="truncate">{company.name}</span>
              </h1>
              <p className="text-sm text-muted-foreground truncate">{company.address}</p>
            </div>
          </div>
          <Badge variant={company.isActive ? "default" : "secondary"} className="shrink-0 w-fit">
            {company.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Company Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Customers</span>
            </div>
            <div className="text-lg font-bold">{customers.length}</div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Phone</span>
            </div>
            <div className="text-sm font-bold truncate">{company.phone || "N/A"}</div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Email</span>
            </div>
            <div className="text-sm font-bold truncate">{company.email || "N/A"}</div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Contact</span>
            </div>
            <div className="text-sm font-bold truncate">{company.contactPerson || "N/A"}</div>
          </Card>
        </div>

        {/* Billing & Payments */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">Billing & Payments</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm">Outstanding: <span className="font-bold">{outstanding.toLocaleString()}</span></div>
                <Button size="sm" variant="outline" onClick={generateBillForCurrentMonth} disabled={genLoading}>
                  {genLoading ? 'Generating...' : 'Generate This Month'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-3 md:gap-4">
              <div className="flex items-end gap-2">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Amount</div>
                  <Input value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" className="w-32" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Date</div>
                  <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-40" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Method</div>
                  <Select value={payMethod} onValueChange={(v:any) => setPayMethod(v)}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Reference</div>
                  <Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Txn/Ref" className="w-44" />
                </div>
                <Button onClick={submitPayment}>Record</Button>
              </div>
            </div>
            {recentPayments.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-gray-500 mb-2">Recent Payments</div>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b"><th className="py-1 text-left">Date</th><th className="py-1 text-left">Method</th><th className="py-1">Ref</th><th className="py-1 text-right">Amount</th></tr></thead>
                    <tbody>
                      {recentPayments.map((p:any) => (
                        <tr key={p._id} className="border-b">
                          <td className="py-1">{new Date(p.date).toLocaleDateString()}</td>
                          <td className="py-1 capitalize">{p.method}</td>
                          <td className="py-1">{p.reference || '-'}</td>
                          <td className="py-1 text-right">{p.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Management Section */}
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Customer Database</h2>
              <p className="text-muted-foreground">
                Manage customers for {company.name}
              </p>
            </div>
            <div>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                New Customer
              </Button>
            </div>
          </div>

          {showAddForm && (
            <QuickCustomerForm
              embedded
              drivers={drivers}
              foodCategories={foodCategories}
              onSubmit={handleQuickFormSubmit}
              onCancel={() => setShowAddForm(false)}
              initialData={editingCustomer ? formData : undefined}
              isEditing={!!editingCustomer}
            />
          )}

          {/* Customers Data Table */}
          <CustomersDataTable
            customers={customers}
            drivers={drivers}
            foodCategories={foodCategories}
            loading={false}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onExport={() => {}} // Not needed in company context
          />
        </div>
      </div>
    </MainLayout>
    </ProtectedRoute>
  );
}
