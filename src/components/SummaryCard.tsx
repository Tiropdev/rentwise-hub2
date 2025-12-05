import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant?: "default" | "success" | "muted";
}

export const SummaryCard = ({ title, value, icon: Icon, variant = "default" }: SummaryCardProps) => {
  const iconBgClass = variant === "success" 
    ? "gradient-success shadow-elegant" 
    : variant === "muted"
    ? "bg-muted-foreground/20"
    : "gradient-primary shadow-elegant";

  const valueClass = variant === "success"
    ? "text-success"
    : variant === "muted"
    ? "text-muted-foreground"
    : "text-foreground";

  return (
    <Card className="border border-border/50 shadow-soft hover:shadow-md transition-smooth bg-card group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className={`text-2xl md:text-3xl font-bold ${valueClass}`}>{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${iconBgClass} transform transition-smooth group-hover:scale-110`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
