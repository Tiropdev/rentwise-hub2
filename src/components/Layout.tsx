import { Home, DoorClosed, CreditCard } from "lucide-react";
import { NavLink } from "./NavLink";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-card border-b border-border px-4 py-5 shadow-soft sticky top-0 z-50 backdrop-blur-sm bg-card/95">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl gradient-primary shadow-elegant">
              <Home className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Holyman Properties</h1>
              <p className="text-xs text-muted-foreground">0758324180</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {children}
      </main>

      <nav className="bg-card border-t border-border shadow-soft sticky bottom-0 z-50 backdrop-blur-sm bg-card/95">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex justify-around items-center">
            <NavLink
              to="/"
              className="flex flex-col items-center gap-1.5 px-6 py-2.5 rounded-xl text-muted-foreground transition-smooth hover:bg-primary/5"
              activeClassName="text-primary bg-primary/10 shadow-sm"
            >
              <Home className="h-5 w-5" />
              <span className="text-xs font-semibold">Dashboard</span>
            </NavLink>
            
            <NavLink
              to="/rooms"
              className="flex flex-col items-center gap-1.5 px-6 py-2.5 rounded-xl text-muted-foreground transition-smooth hover:bg-primary/5"
              activeClassName="text-primary bg-primary/10 shadow-sm"
            >
              <DoorClosed className="h-5 w-5" />
              <span className="text-xs font-semibold">Rooms</span>
            </NavLink>
            
            <NavLink
              to="/payments"
              className="flex flex-col items-center gap-1.5 px-6 py-2.5 rounded-xl text-muted-foreground transition-smooth hover:bg-primary/5"
              activeClassName="text-primary bg-primary/10 shadow-sm"
            >
              <CreditCard className="h-5 w-5" />
              <span className="text-xs font-semibold">Payments</span>
            </NavLink>
          </div>
        </div>
      </nav>
    </div>
  );
};
