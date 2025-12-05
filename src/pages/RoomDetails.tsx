import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, User, Phone, Calendar, CheckCircle2, LogOut, UserPlus, Wallet, AlertTriangle, TrendingUp, Receipt, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { format, addMonths, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { PaymentReceipt, generateReceipt } from "@/components/PaymentReceipt";

const RENT_AMOUNT = 3500;

interface Tenant {
  id: string;
  name: string;
  phone: string;
  move_in_date: string;
}

interface Payment {
  id: string;
  amount: number;
  month: string;
  paid_date: string;
  mpesa_ref?: string;
}

interface MonthlyBalance {
  month: string;
  totalPaid: number;
  balance: number;
  isFullyPaid: boolean;
  payments: Payment[];
}

const RoomDetails = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [roomNumber, setRoomNumber] = useState<number>(0);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState(RENT_AMOUNT);
  const [mpesaRef, setMpesaRef] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  useEffect(() => {
    if (roomId) {
      fetchRoomData();
    }
  }, [roomId]);

  const fetchRoomData = async () => {
    try {
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("room_number")
        .eq("id", roomId)
        .single();

      if (roomError) throw roomError;
      setRoomNumber(roomData.room_number);

      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("room_id", roomId)
        .is("end_date", null)
        .maybeSingle();

      if (tenantError && tenantError.code !== "PGRST116") throw tenantError;
      setTenant(tenantData);

      if (tenantData) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("payments")
          .select("id, amount, month, paid_date, mpesa_ref")
          .eq("tenant_id", tenantData.id)
          .order("paid_date", { ascending: false });

        if (paymentsError) throw paymentsError;
        setPayments(paymentsData || []);
      }
    } catch (error) {
      toast.error("Failed to load room details");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate monthly balances
  const getMonthlyBalances = (): MonthlyBalance[] => {
    const balanceMap = new Map<string, MonthlyBalance>();
    
    // Group payments by month
    payments.forEach(payment => {
      const existing = balanceMap.get(payment.month);
      if (existing) {
        existing.totalPaid += payment.amount;
        existing.balance = Math.max(0, RENT_AMOUNT - existing.totalPaid);
        existing.isFullyPaid = existing.totalPaid >= RENT_AMOUNT;
        existing.payments.push(payment);
      } else {
        balanceMap.set(payment.month, {
          month: payment.month,
          totalPaid: payment.amount,
          balance: Math.max(0, RENT_AMOUNT - payment.amount),
          isFullyPaid: payment.amount >= RENT_AMOUNT,
          payments: [payment]
        });
      }
    });

    return Array.from(balanceMap.values()).sort((a, b) => b.month.localeCompare(a.month));
  };

  const getCurrentMonthBalance = (): MonthlyBalance => {
    const currentMonth = format(new Date(), "yyyy-MM");
    const monthData = getMonthlyBalances().find(b => b.month === currentMonth);
    return monthData || {
      month: currentMonth,
      totalPaid: 0,
      balance: RENT_AMOUNT,
      isFullyPaid: false,
      payments: []
    };
  };

  const getOverdueMonths = (): string[] => {
    const currentMonth = format(new Date(), "yyyy-MM");
    const balances = getMonthlyBalances();
    const paidMonths = new Set(balances.filter(b => b.isFullyPaid).map(b => b.month));
    
    // Check last 3 months for unpaid rent
    const overdue: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const checkMonth = format(addMonths(new Date(), -i), "yyyy-MM");
      if (!paidMonths.has(checkMonth)) {
        overdue.push(checkMonth);
      }
    }
    return overdue;
  };

  const recordPayment = async () => {
    if (!tenant || paymentAmount <= 0 || paymentAmount > RENT_AMOUNT) {
      toast.error("Please enter a valid amount (1 - " + RENT_AMOUNT + ")");
      return;
    }

    try {
      const { data: newPayment, error } = await supabase.from("payments").insert({
        tenant_id: tenant.id,
        room_id: roomId,
        amount: paymentAmount,
        month: selectedMonth,
        paid_date: new Date().toISOString(),
        mpesa_ref: mpesaRef.trim() || null,
      }).select().single();

      if (error) throw error;
      
      const isPartial = paymentAmount < RENT_AMOUNT;
      toast.success(
        isPartial 
          ? `Partial payment of KES ${paymentAmount.toLocaleString()} recorded!` 
          : `Full payment of KES ${paymentAmount.toLocaleString()} recorded!`
      );

      // Generate and download receipt
      if (newPayment) {
        const monthBalance = getMonthlyBalances().find(b => b.month === selectedMonth);
        const balance = monthBalance ? monthBalance.balance - paymentAmount : RENT_AMOUNT - paymentAmount;
        
        const receiptData = {
          receiptNumber: `RCP-${newPayment.id.slice(0, 8).toUpperCase()}`,
          tenantName: tenant.name,
          roomNumber: roomNumber,
          amount: paymentAmount,
          month: selectedMonth,
          paidDate: newPayment.paid_date,
          mpesaRef: mpesaRef.trim() || undefined,
          balance: Math.max(0, balance),
        };
        
        const doc = generateReceipt(receiptData);
        doc.save(`receipt-${receiptData.receiptNumber}.pdf`);
      }

      setPaymentDialogOpen(false);
      setPaymentAmount(RENT_AMOUNT);
      setMpesaRef("");
      fetchRoomData();
    } catch (error) {
      toast.error("Failed to record payment");
      console.error(error);
    }
  };

  const vacateRoom = async () => {
    if (!tenant) return;

    try {
      const { error: tenantError } = await supabase
        .from("tenants")
        .update({ end_date: new Date().toISOString() })
        .eq("id", tenant.id);

      if (tenantError) throw tenantError;

      const { error: roomError } = await supabase
        .from("rooms")
        .update({ is_occupied: false })
        .eq("id", roomId);

      if (roomError) throw roomError;

      toast.success("Room vacated successfully!");
      navigate("/rooms");
    } catch (error: any) {
      toast.error(error.message || "Failed to vacate room");
      console.error(error);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">Loading...</div>;
  }

  const currentMonthBalance = getCurrentMonthBalance();
  const overdueMonths = tenant ? getOverdueMonths() : [];
  const monthlyBalances = getMonthlyBalances();
  const totalOutstanding = monthlyBalances
    .filter(b => !b.isFullyPaid)
    .reduce((sum, b) => sum + b.balance, 0) + (currentMonthBalance.balance);
  const paymentProgress = (currentMonthBalance.totalPaid / RENT_AMOUNT) * 100;

  // Calculate tenant stats
  const totalPaidAllTime = payments.reduce((sum, p) => sum + p.amount, 0);
  const monthsAsCustomer = tenant 
    ? Math.max(1, Math.ceil(differenceInDays(new Date(), new Date(tenant.move_in_date)) / 30))
    : 0;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="gap-2 hover:bg-primary/5"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <h2 className="text-4xl font-bold text-foreground">Room {roomNumber}</h2>
          <span className={cn(
            "inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold shadow-soft",
            tenant 
              ? "bg-success-light text-success" 
              : "bg-muted text-muted-foreground"
          )}>
            {tenant ? "● Occupied" : "○ Vacant"}
          </span>
        </div>
      </div>

      {tenant ? (
        <>
          {/* Overdue Alert */}
          {overdueMonths.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5 shadow-soft">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-destructive">Overdue Payments</p>
                    <p className="text-sm text-muted-foreground">
                      {overdueMonths.map(m => format(new Date(m + "-01"), "MMM yyyy")).join(", ")} unpaid
                    </p>
                  </div>
                  <Badge variant="destructive" className="font-bold">
                    {overdueMonths.length} month{overdueMonths.length > 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border border-border/50 shadow-soft bg-card">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Paid</p>
                    <p className="text-xl font-bold text-foreground">KES {totalPaidAllTime.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/50 shadow-soft bg-card">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tenure</p>
                    <p className="text-xl font-bold text-foreground">{monthsAsCustomer} month{monthsAsCustomer > 1 ? 's' : ''}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tenant Info */}
          <Card className="border border-border/50 shadow-soft bg-card">
            <CardHeader className="border-b border-border/50 bg-muted/30">
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="p-2 rounded-lg gradient-primary shadow-elegant">
                  <User className="h-5 w-5 text-white" />
                </div>
                Tenant Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border/30">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Name</p>
                  <p className="font-bold text-lg mt-0.5 text-foreground">{tenant.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border/30">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Phone</p>
                  <p className="font-bold text-lg mt-0.5 text-foreground">{tenant.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border/30">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Move-in Date</p>
                  <p className="font-bold text-lg mt-0.5 text-foreground">{format(new Date(tenant.move_in_date), "PPP")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Month Rent with Progress */}
          <Card className="border border-border/50 shadow-soft bg-card">
            <CardHeader className="border-b border-border/50 bg-muted/30">
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="p-2 rounded-lg gradient-primary shadow-elegant">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                {format(new Date(), "MMMM yyyy")} Rent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {/* Payment Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment Progress</span>
                  <span className="font-semibold">{Math.round(paymentProgress)}%</span>
                </div>
                <Progress value={paymentProgress} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Paid: KES {currentMonthBalance.totalPaid.toLocaleString()}</span>
                  <span>Balance: KES {currentMonthBalance.balance.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-5 bg-muted/30 rounded-xl border border-border/30">
                <span className="text-base font-semibold">Status</span>
                <Badge 
                  variant={currentMonthBalance.isFullyPaid ? "default" : currentMonthBalance.totalPaid > 0 ? "secondary" : "destructive"}
                  className={cn(
                    "px-4 py-2 font-bold",
                    currentMonthBalance.isFullyPaid && "bg-success hover:bg-success/90"
                  )}
                >
                  {currentMonthBalance.isFullyPaid 
                    ? "✓ Fully Paid" 
                    : currentMonthBalance.totalPaid > 0 
                      ? "◐ Partial" 
                      : "✗ Unpaid"
                  }
                </Badge>
              </div>

              {!currentMonthBalance.isFullyPaid && (
                <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full gap-2 h-12 text-base font-semibold gradient-primary text-white shadow-elegant hover:opacity-90 transition-smooth">
                      <CheckCircle2 className="h-5 w-5" />
                      Record Payment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-primary" />
                        Record Payment
                      </DialogTitle>
                      <DialogDescription>
                        Enter payment amount. Partial payments are supported.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="month">Payment Month</Label>
                        <Input
                          id="month"
                          type="month"
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount (KES)</Label>
                        <Input
                          id="amount"
                          type="number"
                          min="1"
                          max={RENT_AMOUNT}
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(parseInt(e.target.value) || 0)}
                          className="w-full text-lg font-bold"
                        />
                        <div className="flex gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => setPaymentAmount(Math.round(RENT_AMOUNT / 2))}
                          >
                            Half (KES {(RENT_AMOUNT / 2).toLocaleString()})
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => setPaymentAmount(RENT_AMOUNT)}
                          >
                            Full (KES {RENT_AMOUNT.toLocaleString()})
                          </Button>
                        </div>
                      </div>

                      {/* M-Pesa Reference */}
                      <div className="space-y-2">
                        <Label htmlFor="mpesa" className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-success" />
                          M-PESA Reference (Optional)
                        </Label>
                        <Input
                          id="mpesa"
                          type="text"
                          placeholder="e.g. QJK1ABC2DE"
                          value={mpesaRef}
                          onChange={(e) => setMpesaRef(e.target.value.toUpperCase())}
                          className="w-full font-mono uppercase"
                          maxLength={12}
                        />
                      </div>

                      <div className="p-4 bg-muted rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Monthly Rent:</span>
                          <span className="font-semibold">KES {RENT_AMOUNT.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Payment Amount:</span>
                          <span className="text-xl font-bold text-primary">KES {paymentAmount.toLocaleString()}</span>
                        </div>
                        {paymentAmount < RENT_AMOUNT && (
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span className="text-sm">Remaining Balance:</span>
                            <span className="font-semibold">KES {(RENT_AMOUNT - paymentAmount).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={recordPayment} disabled={paymentAmount <= 0} className="gradient-primary text-white gap-2">
                        <Receipt className="h-4 w-4" />
                        Record & Download Receipt
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>

          {/* Outstanding Balance Summary */}
          {totalOutstanding > 0 && (
            <Card className="border-0 shadow-soft overflow-hidden border-l-4 border-l-warning">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/10">
                      <Wallet className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="font-semibold">Total Outstanding</p>
                      <p className="text-sm text-muted-foreground">All unpaid balances</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-warning">KES {totalOutstanding.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment History */}
          {monthlyBalances.length > 0 && (
            <Card className="border border-border/50 shadow-soft bg-card">
              <CardHeader className="border-b border-border/50 bg-muted/30">
                <CardTitle className="text-xl flex items-center gap-2">
                  <div className="p-2 rounded-lg gradient-primary shadow-elegant">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {monthlyBalances.map((monthData) => (
                    <div 
                      key={monthData.month} 
                      className="p-4 hover:bg-muted/30 transition-smooth"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-base">{format(new Date(monthData.month + "-01"), "MMMM yyyy")}</p>
                          <p className="text-sm text-muted-foreground">
                            {monthData.payments.length} payment{monthData.payments.length > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-xl">KES {monthData.totalPaid.toLocaleString()}</p>
                          <Badge 
                            variant={monthData.isFullyPaid ? "default" : "secondary"}
                            className={cn(
                              "text-xs",
                              monthData.isFullyPaid && "bg-success hover:bg-success/90"
                            )}
                          >
                            {monthData.isFullyPaid ? "Paid" : `Bal: KES ${monthData.balance.toLocaleString()}`}
                          </Badge>
                        </div>
                      </div>
                      {/* Show individual payments with receipt download */}
                      <div className={cn("mt-2 space-y-2", monthData.payments.length > 1 && "pl-4 border-l-2 border-muted")}>
                        {monthData.payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg p-2">
                            <div className="flex-1">
                              <span className="text-muted-foreground">{format(new Date(p.paid_date), "PP")}</span>
                              {p.mpesa_ref && (
                                <span className="ml-2 text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-mono">
                                  {p.mpesa_ref}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">KES {p.amount.toLocaleString()}</span>
                              <PaymentReceipt 
                                payment={{
                                  receiptNumber: `RCP-${p.id.slice(0, 8).toUpperCase()}`,
                                  tenantName: tenant.name,
                                  roomNumber: roomNumber,
                                  amount: p.amount,
                                  month: p.month,
                                  paidDate: p.paid_date,
                                  mpesaRef: p.mpesa_ref,
                                  balance: monthData.balance,
                                }}
                                variant="icon"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full gap-2 h-12 text-base font-semibold shadow-soft hover:shadow-md transition-smooth">
                <LogOut className="h-5 w-5" />
                Vacate Room
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Vacate Room {roomNumber}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark {tenant.name} as moved out and make Room {roomNumber} available for new tenants. This action cannot be undone.
                  {totalOutstanding > 0 && (
                    <span className="block mt-2 text-destructive font-semibold">
                      Warning: This tenant has KES {totalOutstanding.toLocaleString()} outstanding balance.
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={vacateRoom} className="bg-destructive hover:bg-destructive/90">
                  Vacate Room
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <Card className="border-2 border-dashed border-border shadow-soft bg-card">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-6">
              <div className="p-6 bg-muted/50 rounded-full shadow-soft">
                <UserPlus className="h-12 w-12 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold mb-2">Room Available</p>
                <p className="text-base text-muted-foreground max-w-sm">This room is currently vacant and ready for a new tenant</p>
              </div>
              <Button 
                onClick={() => navigate(`/rooms/${roomId}/add-tenant`)}
                size="lg"
                className="gap-2 mt-2 h-12 px-8 text-base font-semibold gradient-primary text-white shadow-elegant hover:opacity-90 transition-smooth"
              >
                <UserPlus className="h-5 w-5" />
                Add Tenant
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RoomDetails;
