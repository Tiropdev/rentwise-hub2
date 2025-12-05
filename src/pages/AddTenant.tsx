import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, UserPlus } from "lucide-react";
import { toast } from "sonner";

const AddTenant = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [roomNumber, setRoomNumber] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    moveInDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!roomId) {
      toast.error("Invalid room ID");
      navigate("/rooms");
      return;
    }

    const fetchRoomNumber = async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("room_number, is_occupied")
        .eq("id", roomId)
        .single();

      if (error || !data) {
        toast.error("Room not found");
        navigate("/rooms");
        return;
      }

      if (data.is_occupied) {
        toast.error("Room is already occupied");
        navigate(`/rooms/${roomId}`);
        return;
      }

      setRoomNumber(data.room_number);
    };

    fetchRoomNumber();
  }, [roomId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomId) {
      toast.error("Invalid room ID");
      return;
    }

    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          move_in_date: formData.moveInDate,
          room_id: roomId,
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      const { error: roomError } = await supabase
        .from("rooms")
        .update({ is_occupied: true })
        .eq("id", roomId);

      if (roomError) throw roomError;

      toast.success("Tenant added successfully!");
      navigate(`/rooms/${roomId}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to add tenant");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!roomNumber) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="gap-2 hover:bg-primary/5"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <Card className="border-0 shadow-soft overflow-hidden">
        <div className="absolute inset-0 gradient-card opacity-50" />
        <CardHeader className="space-y-2 relative border-b bg-primary/5">
          <CardTitle className="text-2xl flex items-center gap-3">
            <div className="p-2 rounded-lg gradient-primary shadow-elegant">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            Add New Tenant
          </CardTitle>
          <CardDescription className="text-base">
            Adding tenant for Room {roomNumber}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 relative">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="name" className="text-base font-semibold">
                Tenant Name *
              </Label>
              <Input
                id="name"
                placeholder="Enter tenant's full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="h-12 shadow-soft"
                disabled={loading}
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="phone" className="text-base font-semibold">
                Phone Number *
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="0712345678"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                className="h-12 shadow-soft"
                disabled={loading}
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="moveInDate" className="text-base font-semibold">
                Move-in Date *
              </Label>
              <Input
                id="moveInDate"
                type="date"
                value={formData.moveInDate}
                onChange={(e) => setFormData({ ...formData, moveInDate: e.target.value })}
                required
                className="h-12 shadow-soft"
                disabled={loading}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold gradient-primary text-white shadow-elegant hover:opacity-90 transition-smooth" 
              disabled={loading}
            >
              {loading ? "Adding Tenant..." : "Add Tenant"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddTenant;
