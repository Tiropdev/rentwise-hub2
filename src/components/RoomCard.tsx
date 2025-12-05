import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface RoomCardProps {
  roomNumber: number;
  isOccupied: boolean;
  roomId: string;
}

export const RoomCard = ({ roomNumber, isOccupied, roomId }: RoomCardProps) => {
  const navigate = useNavigate();
  
  return (
    <Card
      onClick={() => navigate(`/rooms/${roomId}`)}
      className={cn(
        "aspect-square flex items-center justify-center cursor-pointer transition-smooth hover:scale-105 hover:shadow-lg border overflow-hidden group",
        isOccupied 
          ? "bg-success/10 border-success/30 shadow-soft hover:shadow-md" 
          : "bg-card border-border/50 shadow-soft hover:bg-muted/50"
      )}
    >
      <div className="text-center">
        <p className={cn(
          "text-2xl md:text-3xl font-bold mb-1",
          isOccupied ? "text-success" : "text-muted-foreground"
        )}>
          {roomNumber}
        </p>
        <div className={cn(
          "px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold inline-block transition-smooth",
          isOccupied 
            ? "bg-success/20 text-success group-hover:bg-success/30" 
            : "bg-muted text-muted-foreground group-hover:bg-muted/80"
        )}>
          {isOccupied ? "●" : "○"}
        </div>
      </div>
    </Card>
  );
};
