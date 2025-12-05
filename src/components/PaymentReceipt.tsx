import { Button } from "@/components/ui/button";
import { Receipt, Download } from "lucide-react";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { toast } from "sonner";

interface ReceiptData {
  receiptNumber: string;
  tenantName: string;
  roomNumber: number;
  amount: number;
  month: string;
  paidDate: string;
  mpesaRef?: string;
  balance?: number;
}

interface PaymentReceiptProps {
  payment: ReceiptData;
  variant?: "icon" | "full";
}

const RENT_AMOUNT = 3500;
const LANDLORD_NAME = "Holyman Properties";
const LANDLORD_PHONE = "0758324180";

export const generateReceipt = (payment: ReceiptData) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [148, 210], // A5 size
  });

  const pageWidth = 148;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // Header with Kenyan flag colors accent
  doc.setFillColor(0, 102, 51); // Kenyan green
  doc.rect(0, 0, pageWidth, 8, "F");
  doc.setFillColor(187, 0, 0); // Kenyan red
  doc.rect(0, 8, pageWidth, 2, "F");

  // Logo/Title area
  y = 25;
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 102, 51);
  doc.text("PAYMENT RECEIPT", pageWidth / 2, y, { align: "center" });

  y += 10;
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(LANDLORD_NAME, pageWidth / 2, y, { align: "center" });

  y += 6;
  doc.setFontSize(10);
  doc.text(LANDLORD_PHONE, pageWidth / 2, y, { align: "center" });

  // Receipt Number Box
  y += 12;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, "F");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Receipt No:", margin + 5, y + 6);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(payment.receiptNumber, margin + 5, y + 11);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Date:", margin + contentWidth - 40, y + 6);
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(format(new Date(payment.paidDate), "dd/MM/yyyy"), margin + contentWidth - 40, y + 11);

  // Divider
  y += 22;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);

  // Tenant Details Section
  y += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 102, 51);
  doc.text("TENANT DETAILS", margin, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  
  // Two column layout
  const col1 = margin;
  const col2 = margin + contentWidth / 2;
  
  doc.text("Name:", col1, y);
  doc.setFont("helvetica", "bold");
  doc.text(payment.tenantName, col1 + 25, y);
  
  doc.setFont("helvetica", "normal");
  doc.text("Room:", col2, y);
  doc.setFont("helvetica", "bold");
  doc.text(`Room ${payment.roomNumber}`, col2 + 20, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.text("Rent Period:", col1, y);
  doc.setFont("helvetica", "bold");
  doc.text(format(new Date(payment.month + "-01"), "MMMM yyyy"), col1 + 30, y);

  // Divider
  y += 12;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);

  // Payment Details Section
  y += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 102, 51);
  doc.text("PAYMENT DETAILS", margin, y);

  y += 10;
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, "F");

  const boxY = y + 8;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text("Monthly Rent:", margin + 5, boxY);
  doc.setTextColor(60, 60, 60);
  doc.text(`KES ${RENT_AMOUNT.toLocaleString()}`, margin + contentWidth - 40, boxY);

  doc.setTextColor(100, 100, 100);
  doc.text("Amount Paid:", margin + 5, boxY + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 102, 51);
  doc.text(`KES ${payment.amount.toLocaleString()}`, margin + contentWidth - 40, boxY + 8);

  if (payment.balance && payment.balance > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(187, 0, 0);
    doc.text("Outstanding Balance:", margin + 5, boxY + 16);
    doc.setFont("helvetica", "bold");
    doc.text(`KES ${payment.balance.toLocaleString()}`, margin + contentWidth - 40, boxY + 16);
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 102, 51);
    doc.text("Status:", margin + 5, boxY + 16);
    doc.setFont("helvetica", "bold");
    doc.text("FULLY PAID", margin + contentWidth - 40, boxY + 16);
  }

  // M-Pesa Reference if available
  if (payment.mpesaRef) {
    y += 40;
    doc.setFillColor(0, 166, 81, 0.1);
    doc.roundedRect(margin, y, contentWidth, 12, 2, 2, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 102, 51);
    doc.text("M-PESA Ref:", margin + 5, y + 8);
    doc.setFont("helvetica", "bold");
    doc.text(payment.mpesaRef, margin + 35, y + 8);
    y += 8;
  }

  // Footer
  y = 180;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);

  y += 8;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(150, 150, 150);
  doc.text("Thank you for your payment!", pageWidth / 2, y, { align: "center" });

  y += 5;
  doc.text("This is a computer-generated receipt.", pageWidth / 2, y, { align: "center" });

  // Bottom accent bar
  doc.setFillColor(0, 102, 51);
  doc.rect(0, 202, pageWidth, 8, "F");

  return doc;
};

export const PaymentReceipt = ({ payment, variant = "icon" }: PaymentReceiptProps) => {
  const handleDownload = () => {
    const doc = generateReceipt(payment);
    doc.save(`receipt-${payment.receiptNumber}.pdf`);
    toast.success("Receipt downloaded successfully");
  };

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        className="h-8 w-8 p-0 hover:bg-primary/10"
        title="Download Receipt"
      >
        <Receipt className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Download Receipt
    </Button>
  );
};

export default PaymentReceipt;
