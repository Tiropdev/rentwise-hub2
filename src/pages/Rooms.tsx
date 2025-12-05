import { useEffect, useState } from "react";
import { RoomCard } from "@/components/RoomCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Room {
  id: string;
  room_number: number;
  is_occupied: boolean;
}

const Rooms = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRooms();
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

  if (loading) {
    return (
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-foreground">All Rooms</h2>
        <p className="text-base text-muted-foreground">Tap any room to view details</p>
      </div>

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
  );
};

export default Rooms;
