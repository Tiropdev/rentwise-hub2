import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { Download, FileText, TrendingUp, Users, Wallet, Filter, Home } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PaymentReceipt, generateReceipt } from "@/components/PaymentReceipt";

const RENT_PER_ROOM = 3500;

interface TenantPaymentStatus {
  tenantId: string;
  tenantName: string;
  roomNumber: number;
  isPaid: boolean;
  totalPaid: number;
}

interface PaymentHistory {
  id: string;
  tenant_name: string;
  room_number: number;
  amount: number;
  month: string;
  paid_date: string;
  mpesa_ref?: string;
}

interface RoomPayments {
  roomNumber: number;
  tenantName: string;
  payments: PaymentHistory[];
  totalPaid: number;
}

const Payments = () => {
  const [paymentStatuses, setPaymentStatuses] = useState<TenantPaymentStatus[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedRoom, setSelectedRoom] = useState<string>("all");

  // Generate last 12 months for filter
  const monthOptions = useMemo(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      months.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy"),
      });
    }
    return months;
  }, []);

  useEffect(() => {
    fetchPaymentStatuses();
    fetchPaymentHistory();
  }, []);

  const fetchPaymentStatuses = async () => {
    try {
      const currentMonth = format(new Date(), "yyyy-MM");

      const { data: tenants, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, name, room_id, rooms(room_number)")
        .is("end_date", null);

      if (tenantsError) throw tenantsError;

      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("tenant_id, amount")
        .eq("month", currentMonth);

      if (paymentsError) throw paymentsError;

      const paidAmounts = new Map<string, number>();
      payments?.forEach(p => {
        paidAmounts.set(p.tenant_id, (paidAmounts.get(p.tenant_id) || 0) + p.amount);
      });

      const statuses = tenants?.map(tenant => ({
        tenantId: tenant.id,
        tenantName: tenant.name,
        roomNumber: (tenant.rooms as any).room_number,
        isPaid: (paidAmounts.get(tenant.id) || 0) >= RENT_PER_ROOM,
        totalPaid: paidAmounts.get(tenant.id) || 0,
      })) || [];

      setPaymentStatuses(statuses.sort((a, b) => a.roomNumber - b.roomNumber));
    } catch (error) {
      toast.error("Failed to load payment statuses");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          month,
          paid_date,
          mpesa_ref,
          tenants(name),
          rooms(room_number)
        `)
        .order("paid_date", { ascending: false })
        .limit(500);

      if (error) throw error;

      const history = data?.map(payment => ({
        id: payment.id,
        tenant_name: (payment.tenants as any)?.name || "Unknown",
        room_number: (payment.rooms as any)?.room_number || 0,
        amount: payment.amount,
        month: payment.month,
        paid_date: payment.paid_date,
        mpesa_ref: (payment as any).mpesa_ref,
      })) || [];

      setPaymentHistory(history);
    } catch (error) {
      toast.error("Failed to load payment history");
      console.error(error);
    }
  };

  // Filter payments by month and room
  const filteredPayments = useMemo(() => {
    return paymentHistory.filter(p => {
      const monthMatch = selectedMonth === "all" || p.month === selectedMonth;
      const roomMatch = selectedRoom === "all" || p.room_number.toString() === selectedRoom;
      return monthMatch && roomMatch;
    });
  }, [paymentHistory, selectedMonth, selectedRoom]);

  // Group payments by room
  const paymentsByRoom = useMemo(() => {
    const grouped = new Map<number, RoomPayments>();
    
    filteredPayments.forEach(payment => {
      const existing = grouped.get(payment.room_number);
      if (existing) {
        existing.payments.push(payment);
        existing.totalPaid += payment.amount;
      } else {
        grouped.set(payment.room_number, {
          roomNumber: payment.room_number,
          tenantName: payment.tenant_name,
          payments: [payment],
          totalPaid: payment.amount,
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => a.roomNumber - b.roomNumber);
  }, [filteredPayments]);

  // Get unique rooms for filter
  const roomOptions = useMemo(() => {
    const rooms = new Set(paymentHistory.map(p => p.room_number));
    return Array.from(rooms).sort((a, b) => a - b);
  }, [paymentHistory]);

  const downloadRoomReceipts = (room: RoomPayments) => {
    room.payments.forEach((payment, index) => {
      setTimeout(() => {
        const doc = generateReceipt({
          receiptNumber: `RCP-${payment.id.slice(0, 8).toUpperCase()}`,
          tenantName: payment.tenant_name,
          roomNumber: payment.room_number,
          amount: payment.amount,
          month: payment.month,
          paidDate: payment.paid_date,
          mpesaRef: payment.mpesa_ref,
        });
        doc.save(`receipt-room${room.roomNumber}-${format(new Date(payment.paid_date), "yyyy-MM-dd")}.pdf`);
      }, index * 200);
    });
    toast.success(`Downloading ${room.payments.length} receipt(s) for Room ${room.roomNumber}`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Payment Report", 14, 22);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 30);
    if (selectedMonth !== "all") {
      doc.text(`Filtered by: ${format(new Date(selectedMonth + "-01"), "MMMM yyyy")}`, 14, 36);
    }
    
    doc.setFontSize(12);
    doc.text("Summary", 14, 48);
    doc.setFontSize(10);
    doc.text(`Total Expected: KES ${totalExpected.toLocaleString()}`, 14, 56);
    doc.text(`Total Collected: KES ${totalCollected.toLocaleString()}`, 14, 62);
    doc.text(`Pending Balance: KES ${pendingBalance.toLocaleString()}`, 14, 68);
    
    autoTable(doc, {
      head: [["Room", "Tenant", "Amount", "Month", "M-PESA Ref", "Date"]],
      body: filteredPayments.map(payment => [
        `Room ${payment.room_number}`,
        payment.tenant_name,
        `KES ${payment.amount.toLocaleString()}`,
        format(new Date(payment.month + "-01"), "MMM yyyy"),
        payment.mpesa_ref || "-",
        format(new Date(payment.paid_date), "PP"),
      ]),
      startY: 76,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 102, 51] },
    });
    
    doc.save(`payment-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("Report downloaded successfully");
  };

  const totalExpected = paymentStatuses.length * RENT_PER_ROOM;
  const totalCollected = paymentStatuses.reduce((sum, s) => sum + s.totalPaid, 0);
  const pendingBalance = totalExpected - totalCollected;
  const paidCount = paymentStatuses.filter(s => s.isPaid).length;

  if (loading) {
    return <div className="animate-pulse p-8 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-foreground">Monthly Payments</h2>
        <p className="text-base text-muted-foreground">{format(new Date(), "MMMM yyyy")}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-border/50 shadow-soft bg-card">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expected</p>
            </div>
            <p className="text-2xl font-bold text-foreground">KES {totalExpected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border border-success/20 shadow-soft bg-success/5">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-success/10">
                <Wallet className="h-4 w-4 text-success" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Collected</p>
            </div>
            <p className="text-2xl font-bold text-success">KES {totalCollected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border border-destructive/20 shadow-soft bg-destructive/5">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Wallet className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending</p>
            </div>
            <p className="text-2xl font-bold text-destructive">KES {pendingBalance.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 shadow-soft bg-card">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paid</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{paidCount}/{paymentStatuses.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Month Status */}
      <Card className="border border-border/50 shadow-soft bg-card">
        <CardHeader className="border-b border-border/50 bg-muted/30 py-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            Current Month Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {paymentStatuses.map((status) => (
              <div
                key={status.tenantId}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-smooth"
              >
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{status.tenantName}</p>
                  <p className="text-sm text-muted-foreground">Room {status.roomNumber}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-foreground">KES {status.totalPaid.toLocaleString()}</p>
                    {!status.isPaid && status.totalPaid > 0 && (
                      <p className="text-xs text-muted-foreground">Bal: KES {(RENT_PER_ROOM - status.totalPaid).toLocaleString()}</p>
                    )}
                  </div>
                  <Badge 
                    variant={status.isPaid ? "default" : status.totalPaid > 0 ? "secondary" : "destructive"} 
                    className={cn(
                      "px-3 py-1 text-xs font-semibold",
                      status.isPaid && "bg-success hover:bg-success/90"
                    )}
                  >
                    {status.isPaid ? "Paid" : status.totalPaid > 0 ? "Partial" : "Pending"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment History with Filters */}
      <Card className="border border-border/50 shadow-soft bg-card">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              Payment History
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {monthOptions.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {roomOptions.map(r => (
                    <SelectItem key={r} value={r.toString()}>Room {r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={downloadPDF} variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {paymentsByRoom.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No payments found for the selected filters
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {paymentsByRoom.map((room) => (
                <div key={room.roomNumber} className="p-4">
                  {/* Room Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10">
                        <Home className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">Room {room.roomNumber}</p>
                        <p className="text-sm text-muted-foreground">{room.tenantName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">{room.payments.length} payment(s)</p>
                        <p className="font-bold text-primary">KES {room.totalPaid.toLocaleString()}</p>
                      </div>
                      <Button 
                        onClick={() => downloadRoomReceipts(room)} 
                        variant="outline" 
                        size="sm"
                        className="gap-2 border-primary/30 hover:bg-primary/5"
                      >
                        <Download className="h-3 w-3" />
                        Receipts
                      </Button>
                    </div>
                  </div>
                  
                  {/* Room Payments Table */}
                  <div className="bg-muted/50 rounded-xl overflow-hidden border border-border/50">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/80">
                        <tr>
                          <th className="px-3 py-2.5 text-left font-semibold text-foreground">Date</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-foreground">Month</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-foreground">Amount</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-foreground">M-PESA Ref</th>
                          <th className="px-3 py-2.5 text-right font-semibold text-foreground">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30 bg-card">
                        {room.payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-muted/20">
                            <td className="px-3 py-2">{format(new Date(payment.paid_date), "PP")}</td>
                            <td className="px-3 py-2">{format(new Date(payment.month + "-01"), "MMM yyyy")}</td>
                            <td className="px-3 py-2 font-semibold">KES {payment.amount.toLocaleString()}</td>
                            <td className="px-3 py-2">
                              {payment.mpesa_ref ? (
                                <span className="bg-success/10 text-success px-2 py-0.5 rounded font-mono text-xs">
                                  {payment.mpesa_ref}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <PaymentReceipt 
                                payment={{
                                  receiptNumber: `RCP-${payment.id.slice(0, 8).toUpperCase()}`,
                                  tenantName: payment.tenant_name,
                                  roomNumber: payment.room_number,
                                  amount: payment.amount,
                                  month: payment.month,
                                  paidDate: payment.paid_date,
                                  mpesaRef: payment.mpesa_ref,
                                }}
                                variant="icon"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Payments;
