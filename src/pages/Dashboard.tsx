import { useEffect, useState } from "react";
import { SummaryCard } from "@/components/SummaryCard";
import { RoomCard } from "@/components/RoomCard";
import { DoorOpen, DoorClosed, Wallet, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const RENT_PER_ROOM = 3500;
const TOTAL_ROOMS = 25;

interface Room {
  id: string;
  room_number: number;
  is_occupied: boolean;
}

const Dashboard = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlyCollected, setMonthlyCollected] = useState(0);

  useEffect(() => {
    fetchRooms();
    fetchMonthlyPayments();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("room_number");

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      toast.error("Failed to load rooms");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyPayments = async () => {
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from("payments")
        .select("amount")
        .gte("paid_date", firstDay.toISOString())
        .lte("paid_date", lastDay.toISOString());

      if (error) throw error;
      
      const total = data?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
      setMonthlyCollected(total);
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    }
  };

  const occupiedCount = rooms.filter(r => r.is_occupied).length;
  const vacantCount = TOTAL_ROOMS - occupiedCount;
  const expectedIncome = TOTAL_ROOMS * RENT_PER_ROOM;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-foreground">Welcome Back</h2>
        <p className="text-base text-muted-foreground">Holyman Properties • 25 Rooms</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <SummaryCard
          title="Rooms Occupied"
          value={occupiedCount}
          icon={DoorClosed}
          variant="success"
        />
        <SummaryCard
          title="Rooms Vacant"
          value={vacantCount}
          icon={DoorOpen}
          variant="muted"
        />
        <SummaryCard
          title="Expected Income"
          value={`KES ${expectedIncome.toLocaleString()}`}
          icon={TrendingUp}
        />
        <SummaryCard
          title="Collected This Month"
          value={`KES ${monthlyCollected.toLocaleString()}`}
          icon={Wallet}
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold text-foreground">All Rooms</h3>
        <div className="grid grid-cols-5 gap-3 md:gap-4">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              roomNumber={room.room_number}
              isOccupied={room.is_occupied}
              roomId={room.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
