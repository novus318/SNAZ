"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, User, Truck, Calendar, Building2, Settings, Edit3, X, DollarSign } from "lucide-react";
import { apiClient, Customer, DailyOrder, Company } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { parseBagFormat } from "@/lib/bagFormatParser";

interface MonthlyOrderData {
  [day: string]: {
    date: Date;
    lunch?: {
      orderId: string;
      orderItemId: string;
      bagFormat: string;
      nonVegCount: number;
      vegCount: number;
      totalCount: number;
    };
    dinner?: {
      orderId: string;
      orderItemId: string;
      bagFormat: string;
      nonVegCount: number;
      vegCount: number;
      totalCount: number;
    };
  };
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [monthlyOrders, setMonthlyOrders] = useState<MonthlyOrderData>({});
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Initialize to current month
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showCompanyAssignment, setShowCompanyAssignment] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{[key: string]: {orderId: string, orderItemId: string, bagFormat: string}}>({});
  // Billing & payments state
  const [outstanding, setOutstanding] = useState<number>(0);
  const [bills, setBills] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [payMethod, setPayMethod] = useState<'cash'|'bank'|'upi'|'card'|'other'>('cash');
  const [payRef, setPayRef] = useState('');
  const [genLoading, setGenLoading] = useState(false);

  useEffect(() => {
    if (customerId) {
      loadCustomer();
      loadMonthlyOrders();
    }
  }, [customerId, currentMonth]);

  useEffect(() => {
    if (customerId) {
      loadBilling();
    }
  }, [customerId]);

  const loadCustomer = async () => {
    try {
      const data = await apiClient.getCustomer(customerId);
      setCustomer(data);
    } catch (error) {
      toast.error("Failed to load customer details");
      router.push("/customers");
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyOrders = async () => {
    setOrdersLoading(true);
    try {
      // Fix: Use local date construction to avoid timezone issues
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      const endDate = new Date(year, month + 1, 0);
      
      // Format dates properly for API call
      const startDateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
      const endDateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${endDate.getDate().toString().padStart(2, '0')}`;
      
      console.log('=== MONTH DEBUG ===');
      console.log('currentMonth object:', currentMonth);
      console.log('currentMonth.getMonth():', currentMonth.getMonth(), '(0-based)');
      console.log('currentMonth.getFullYear():', currentMonth.getFullYear());
      console.log('Display month should be:', currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
      console.log('Loading orders for:', {
        customerId,
        year,
        monthIndex: month, // 0-based
        displayMonth: month + 1, // 1-based for display
        startDate: startDateStr,
        endDate: endDateStr
      });
      
      const dailyOrders = await apiClient.getDailyOrders({
        startDate: startDateStr,
        endDate: endDateStr
      });
      
      console.log('Received daily orders:', dailyOrders.length);
      
      // Process orders to create monthly view
      const monthlyData: MonthlyOrderData = {};
      
      dailyOrders.forEach((dayOrder: DailyOrder) => {
        const date = new Date(dayOrder.date);
        const orderMonth = date.getMonth();
        const orderYear = date.getFullYear();
        const day = date.getDate().toString();
        
        console.log('Processing day order:', {
          date: dayOrder.date,
          orderMonth: orderMonth + 1, // 1-based
          currentMonth: month + 1, // 1-based  
          orderYear,
          currentYear: year,
          shouldInclude: orderMonth === month && orderYear === year,
          totalOrders: dayOrder.orders.length,
          orders: dayOrder.orders.map(o => ({ customerId: o.customerId, mealType: o.mealType }))
        });
        
        // Only process orders from the current month/year we're viewing
        if (orderMonth !== month || orderYear !== year) {
          console.log('Skipping order from different month/year');
          return;
        }
        
        const customerOrders = dayOrder.orders.filter(order => {
          // Handle both string IDs and populated objects
          const orderCustomerId = typeof order.customerId === 'string' 
            ? order.customerId 
            : (order.customerId as any)?._id || order.customerId;
          const matches = orderCustomerId === customerId;
          console.log('Order match check:', { 
            orderCustomerId, 
            targetCustomerId: customerId, 
            matches 
          });
          return matches;
        });
        
        console.log('Customer orders found:', customerOrders.length);
        
        // Only create entry if customer has orders for this day
        if (customerOrders.length > 0) {
          if (!monthlyData[day]) {
            monthlyData[day] = { date };
          }
          
          customerOrders.forEach(order => {
            const parsed = parseBagFormat(order.bagFormat);
            const orderData = {
              orderId: dayOrder._id,
              orderItemId: order._id || '',
              bagFormat: order.bagFormat,
              nonVegCount: parsed.nonVegCount,
              vegCount: parsed.vegCount,
              totalCount: parsed.nonVegCount + parsed.vegCount
            };
            
            if (order.mealType === 'lunch') {
              monthlyData[day].lunch = orderData;
            } else if (order.mealType === 'dinner') {
              monthlyData[day].dinner = orderData;
            }
          });
        }
      });
      
      console.log('Final monthly data:', monthlyData);
      setMonthlyOrders(monthlyData);
      setHasUnsavedChanges(false);
      setPendingChanges({}); // Clear any pending changes when loading fresh data
    } catch (error) {
      console.error('Error loading monthly orders:', error);
      toast.error("Failed to load monthly orders");
    } finally {
      setOrdersLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    console.log('Navigating to month:', {
      direction,
      from: currentMonth.toLocaleDateString(),
      to: newMonth.toLocaleDateString()
    });
    setCurrentMonth(newMonth);
  };

  const getOrderedDays = () => {
    // Only return days that have actual orders, sorted by day number
    return Object.keys(monthlyOrders)
      .sort((a, b) => parseInt(a) - parseInt(b));
  };

  const calculateMonthTotals = () => {
    let totalLunchCount = 0;
    let totalDinnerCount = 0;
    let totalGrandCount = 0;

    Object.values(monthlyOrders).forEach(dayData => {
      const lunchTotal = dayData.lunch?.totalCount || 0;
      const dinnerTotal = dayData.dinner?.totalCount || 0;
      totalLunchCount += lunchTotal;
      totalDinnerCount += dinnerTotal;
      totalGrandCount += lunchTotal + dinnerTotal;
    });

    // Calculate amount based on customer packages
    let totalAmount = 0;
    if (customer && customer.packages.length > 0) {
      // Assuming first package for simplicity, you might need to adjust this logic
      const unitPrice = customer.packages[0].unitPrice;
      totalAmount = totalGrandCount * unitPrice;
    }

    return {
      totalLunchCount,
      totalDinnerCount,
      totalGrandCount,
      totalAmount,
      daysWithOrders: Object.keys(monthlyOrders).length
    };
  };

  const formatDayLabel = (day: string) => {
    const dayData = monthlyOrders[day];
    if (!dayData) return day;
    
    return dayData.date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };


  const formatMonthYear = () => {
    return currentMonth.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getDriverName = () => {
    if (!customer) return "N/A";
    return typeof customer.driverId === 'object' ? customer.driverId.name : "Unknown Driver";
  };

  const getCompanyName = () => {
    if (!customer || !customer.companyId) return "No Company";
    return typeof customer.companyId === 'object' ? customer.companyId.name : "Unknown Company";
  };

  const loadCompanies = async () => {
    try {
      const companiesData = await apiClient.getCompanies();
      setCompanies(companiesData);
    } catch (error) {
      toast.error("Failed to load companies");
    }
  };

  const loadBilling = async () => {
    try {
      const [billsResp, payments]:any = await Promise.all([
        apiClient.getBills({ entityType: 'customer', entityId: customerId }),
        apiClient.getPayments({ entityType: 'customer', entityId: customerId })
      ]);
      setBills(billsResp);
      const bal = billsResp.reduce((s: number, b: any) => s + (b.balanceAmount || 0), 0);
      setOutstanding(bal);
      setRecentPayments(payments.slice(0, 5));
    } catch (e) {
      // ignore
    }
  };

  const submitPayment = async () => {
    try {
      const amt = parseFloat(payAmount);
      if (!amt || amt <= 0) return toast.error('Enter valid amount');
      await apiClient.recordPayment({ entityType: 'customer', entityId: customerId, amount: amt, date: payDate, method: payMethod, reference: payRef });
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
      const y = currentMonth.getFullYear();
      const m = currentMonth.getMonth() + 1;
      await apiClient.generateBillForEntity({ entityType: 'customer', entityId: customerId, year: y, month: m });
      toast.success(`Bill generated for ${currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`);
      await loadBilling();
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate bill');
    } finally {
      setGenLoading(false);
    }
  };

  const handleCompanyAssignment = async (newCompanyId: string) => {
    if (!customer) return;

    try {
      // Build a full, validated payload with ID fields normalized to strings
      const normalizedDriverId = typeof customer.driverId === 'string' ? customer.driverId : customer.driverId?._id;
      const normalizedPackages = (customer.packages || []).map((pkg) => ({
        categoryId: typeof pkg.categoryId === 'string' ? pkg.categoryId : (pkg.categoryId as any)?._id,
        unitPrice: pkg.unitPrice,
      }));

      const payload = {
        name: customer.name,
        address: customer.address,
        phone: customer.phone,
        email: customer.email,
        driverId: normalizedDriverId as string,
        packages: normalizedPackages,
        dailyFood: {
          lunch: customer.dailyFood?.lunch,
          dinner: customer.dailyFood?.dinner,
        },
        startDate: customer.startDate,
        endDate: customer.endDate,
        companyId: newCompanyId === 'none' ? undefined : newCompanyId,
        isActive: customer.isActive,
      };

      await apiClient.updateCustomer(customer._id, payload);

      // Reload customer to get updated data with populated company
      await loadCustomer();

      toast.success(newCompanyId === 'none' ? 'Customer removed from company' : 'Customer assigned to company');
      setShowCompanyAssignment(false);
    } catch (error) {
      toast.error('Failed to update customer company assignment');
    }
  };




  const handleSaveAllChanges = async () => {
    if (!hasUnsavedChanges || Object.keys(pendingChanges).length === 0) return;
    
    try {
      // Save all pending changes to the backend
      const savePromises = Object.values(pendingChanges).map(async (change) => {
        return apiClient.updateOrderItem(change.orderId, change.orderItemId, {
          bagFormat: change.bagFormat
        });
      });
      
      await Promise.all(savePromises);
      
      toast.success(`Successfully saved ${Object.keys(pendingChanges).length} bag format changes!`);
      
      // Reload the data to get the latest from backend
      await loadMonthlyOrders();
      
      // Clear pending changes and unsaved flag
      setPendingChanges({});
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save changes:', error);
      toast.error("Failed to save some changes. Please try again.");
    }
  };

  const handleBagFormatChange = (day: string, mealType: 'lunch' | 'dinner', newValue: string) => {
    const newOrders = { ...monthlyOrders };
    const dayData = newOrders[day]?.[mealType];
    
    if (dayData) {
      const parsed = parseBagFormat(newValue);
      const changeKey = `${day}-${mealType}`;
      
      // Update the UI state immediately
      newOrders[day][mealType] = {
        ...dayData,
        bagFormat: newValue,
        nonVegCount: parsed.nonVegCount,
        vegCount: parsed.vegCount,
        totalCount: parsed.totalCount
      };
      
      setMonthlyOrders(newOrders);
      
      // Track this change for backend save
      const newPendingChanges = { ...pendingChanges };
      newPendingChanges[changeKey] = {
        orderId: dayData.orderId,
        orderItemId: dayData.orderItemId,
        bagFormat: newValue
      };
      
      setPendingChanges(newPendingChanges);
      setHasUnsavedChanges(true);
    }
  };

  if (loading) {
    return (
    <ProtectedRoute>
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          Loading customer details...
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
  }

  if (!customer) {
    return (
    <ProtectedRoute>
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          Customer not found
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
  }

  const days = getOrderedDays();

  return (
    <ProtectedRoute>
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push("/customers")}
              className="shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Back</span>
            </Button> */}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 truncate">
                <User className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                <span className="truncate">{customer.name}</span>
              </h1>
              <p className="text-sm text-muted-foreground truncate">{customer.address}</p>
            </div>
          </div>
          <Badge variant={customer.isActive ? "default" : "secondary"} className="shrink-0 w-fit">
            {customer.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Customer Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Card className="p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Driver</span>
              </div>
            </div>
            <div className="text-lg font-bold mt-1 truncate">{getDriverName()}</div>
          </Card>

          <Card className="p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Company</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await loadCompanies();
                  setShowCompanyAssignment(true);
                }}
                className="h-6 w-6 p-0"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-lg font-bold mt-1 truncate">{getCompanyName()}</div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Start Date</span>
              </div>
            </div>
            <div className="text-lg font-bold mt-1">
              {new Date(customer.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </Card>
        </div>

        {/* Company Assignment Modal */}
        {showCompanyAssignment && (
          <Card className="border-2 border-blue-200 bg-blue-50/30 py-2 gap-0">
            <CardHeader className="">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Assign Customer to Company</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowCompanyAssignment(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Company:</label>
                  <Select
                    value={typeof customer?.companyId === 'string' ? customer.companyId : customer?.companyId?._id || 'none'}
                    onValueChange={handleCompanyAssignment}
                  >
                    <SelectTrigger className="w-1/5">
                      <SelectValue placeholder="Choose a company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Company</SelectItem>
                      {companies.map(company => (
                        <SelectItem key={company._id} value={company._id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing & Payments */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Billing & Payments</CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm">Outstanding: <span className="font-bold">{outstanding.toLocaleString()}</span></div>
                <Button size="sm" variant="outline" onClick={generateBillForCurrentMonth} disabled={genLoading}>
                  {genLoading ? 'Generating...' : `Generate ${currentMonth.toLocaleDateString('en-US', { month: 'short' })}`}
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

        {/* Bills List */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Bills</CardTitle>
              <div className="text-xs text-muted-foreground">{bills.length} bill(s)</div>
            </div>
          </CardHeader>
          <CardContent>
            {bills.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">No bills yet.</div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b">
                      <TableHead className="text-xs px-2 py-2">Bill No</TableHead>
                      <TableHead className="text-xs px-2 py-2">Period</TableHead>
                      <TableHead className="text-xs px-2 py-2 text-right">Total</TableHead>
                      <TableHead className="text-xs px-2 py-2 text-right">Paid</TableHead>
                      <TableHead className="text-xs px-2 py-2 text-right">Balance</TableHead>
                      <TableHead className="text-xs px-2 py-2">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((b:any) => (
                      <TableRow key={b._id} className="border-b">
                        <TableCell className="px-2 py-2">
                          <Link className="text-blue-600 hover:underline" href={`/bills/${b._id}`}>{b.number}</Link>
                        </TableCell>
                        <TableCell className="px-2 py-2">{b.periodYear}-{String(b.periodMonth).padStart(2,'0')}</TableCell>
                        <TableCell className="px-2 py-2 text-right">{b.totalAmount?.toLocaleString?.() ?? b.totalAmount}</TableCell>
                        <TableCell className="px-2 py-2 text-right">{(b.paidAmount || 0).toLocaleString?.() ?? b.paidAmount}</TableCell>
                        <TableCell className="px-2 py-2 text-right">{b.balanceAmount?.toLocaleString?.() ?? b.balanceAmount}</TableCell>
                        <TableCell className="px-2 py-2 capitalize">{b.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Orders Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Monthly Orders</CardTitle>
                <CardDescription className="text-sm">
                  Orders for {formatMonthYear()}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigateMonth('prev')}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-3 min-w-[100px] text-center">
                  {formatMonthYear()}
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigateMonth('next')}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {hasUnsavedChanges && (
                  <Button 
                    size="sm"
                    onClick={handleSaveAllChanges}
                    className="h-8 px-3 bg-green-600 hover:bg-green-700"
                  >
                    <Edit3 className="h-3 w-3 mr-1" />
                    Save Changes
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="text-center py-8">Loading orders...</div>
            ) : days.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No orders found for {formatMonthYear()}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <div className="inline-block min-w-full px-6">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b">
                        <TableHead className="text-xs font-medium px-2 py-3 w-20">Date</TableHead>
                        <TableHead className="text-xs font-medium px-2 py-3 min-w-24">Bag (L)</TableHead>
                        <TableHead className="text-xs font-medium px-2 py-3 text-center w-12">NV</TableHead>
                        <TableHead className="text-xs font-medium px-2 py-3 text-center w-12">V</TableHead>
                        <TableHead className="text-xs font-medium px-2 py-3 text-center w-12">L</TableHead>
                        <TableHead className="text-xs font-medium px-2 py-3 min-w-24">Bag (D)</TableHead>
                        <TableHead className="text-xs font-medium px-2 py-3 text-center w-12">NV</TableHead>
                        <TableHead className="text-xs font-medium px-2 py-3 text-center w-12">V</TableHead>
                        <TableHead className="text-xs font-medium px-2 py-3 text-center w-12">D</TableHead>
                        <TableHead className="text-xs font-medium px-2 py-3 text-center w-16 bg-muted">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {days.map((day) => {
                      const dayData = monthlyOrders[day];
                      const lunch = dayData?.lunch;
                      const dinner = dayData?.dinner;
                      const dayTotal = (lunch?.totalCount || 0) + (dinner?.totalCount || 0);
                      
                      return (
                        <TableRow key={day} className="hover:bg-muted/50">
                          <TableCell className="font-medium text-xs px-2 py-3">
                            {formatDayLabel(day)}
                          </TableCell>
                          
                          {/* Lunch columns */}
                          <TableCell className="font-mono text-xs px-2 py-3">
                            {lunch ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={lunch.bagFormat}
                                  onChange={(e) => handleBagFormatChange(day, 'lunch', e.target.value)}
                                  className="h-6 text-xs font-mono border-slate-300 focus:border-orange-500"
                                  placeholder="e.g., 5,5+7"
                                />
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-center text-red-600 text-xs px-2 py-3 font-medium">
                            {lunch?.nonVegCount || 0}
                          </TableCell>
                          <TableCell className="text-center text-green-600 text-xs px-2 py-3 font-medium">
                            {lunch?.vegCount || 0}
                          </TableCell>
                          <TableCell className="text-center font-bold text-xs px-2 py-3">
                            {lunch?.totalCount || 0}
                          </TableCell>
                          
                          {/* Dinner columns */}
                          <TableCell className="font-mono text-xs px-2 py-3">
                            {dinner ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={dinner.bagFormat}
                                  onChange={(e) => handleBagFormatChange(day, 'dinner', e.target.value)}
                                  className="h-6 text-xs font-mono border-slate-300 focus:border-indigo-500"
                                  placeholder="e.g., 3+5"
                                />
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-center text-red-600 text-xs px-2 py-3 font-medium">
                            {dinner?.nonVegCount || 0}
                          </TableCell>
                          <TableCell className="text-center text-green-600 text-xs px-2 py-3 font-medium">
                            {dinner?.vegCount || 0}
                          </TableCell>
                          <TableCell className="text-center font-bold text-xs px-2 py-3">
                            {dinner?.totalCount || 0}
                          </TableCell>
                          
                          {/* Day total */}
                          <TableCell className="text-center font-bold text-sm px-2 py-3 bg-muted/50">
                            {dayTotal || 0}
                          </TableCell>
                        </TableRow>
  );
                    })}
                  </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Monthly Summary - Spreadsheet Style */}
            {days.length > 0 && (() => {
              const totals = calculateMonthTotals();
              return (
                <div className="mt-6 pt-4 border-t">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-100">
                          <TableHead className="text-xs font-bold text-center px-3 py-2">Metric</TableHead>
                          <TableHead className="text-xs font-bold text-center px-3 py-2 w-20">Days</TableHead>
                          <TableHead className="text-xs font-bold text-center px-3 py-2 w-20">Lunch</TableHead>
                          <TableHead className="text-xs font-bold text-center px-3 py-2 w-20">Dinner</TableHead>
                          <TableHead className="text-xs font-bold text-center px-3 py-2 w-24 bg-slate-200">Total Items</TableHead>
                          <TableHead className="text-xs font-bold text-center px-3 py-2 w-28 bg-slate-200">Unit Price</TableHead>
                          <TableHead className="text-xs font-bold text-center px-3 py-2 w-32 bg-slate-300">Total Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="border-b">
                          <TableCell className="font-medium text-xs px-3 py-3">{formatMonthYear()}</TableCell>
                          <TableCell className="text-center font-bold text-sm px-3 py-3 text-blue-600">
                            {totals.daysWithOrders}
                          </TableCell>
                          <TableCell className="text-center font-bold text-sm px-3 py-3 text-orange-600">
                            {totals.totalLunchCount}
                          </TableCell>
                          <TableCell className="text-center font-bold text-sm px-3 py-3 text-purple-600">
                            {totals.totalDinnerCount}
                          </TableCell>
                          <TableCell className="text-center font-bold text-sm px-3 py-3 bg-slate-50">
                            {totals.totalGrandCount}
                          </TableCell>
                          <TableCell className="text-center font-bold text-sm px-3 py-3 bg-slate-50">
                            ${customer?.packages[0]?.unitPrice || 0}
                          </TableCell>
                          <TableCell className="text-center font-bold text-lg px-3 py-3 bg-slate-100 text-green-700">
                            ${totals.totalAmount.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
  );
            })()}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
    </ProtectedRoute>
  );
}
