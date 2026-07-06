import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Package, Users, ArrowLeftRight,
  ClipboardList, LogOut, Menu, Warehouse, MapPin, Settings, Move
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import InstallPwaButton from '@/components/InstallPwaButton';
import SubscriptionBadge from '@/components/SubscriptionBadge';
import { webSerialService } from '@/lib/webSerialService';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Bosh sahifa' },
  { to: '/mahsulotlar', icon: Package, label: 'Mahsulotlar' },
  { to: '/sektorlar', icon: MapPin, label: 'Sektorlar' },
  { to: '/ishchilar', icon: Users, label: 'Ishchilar' },
  { to: '/operatsiyalar', icon: ArrowLeftRight, label: 'Kirim/Chiqim' },
  { to: '/kochirish', icon: Move, label: "Ko'chirish" },
  { to: '/loglar', icon: ClipboardList, label: 'Loglar' },
  { to: '/sozlamalar', icon: Settings, label: 'Sozlamalar' },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground border border-primary/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`
          }
        >
          <item.icon className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppLayout() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Web Serial (Arduino RFID) ulanishini global darajada hayotda saqlash —
  // skaner gun rejimi yoqilgan bo'lsa ham, NfcScanner UI ko'rinmasa ham ulanish saqlanib turadi.
  useEffect(() => { webSerialService.init(); }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Worker mode — minimal layout, only shows the Outlet (operations page)
  if (role === 'worker') {
    return (
      <div className="min-h-screen bg-background">
        <header className="h-14 border-b border-border bg-card sticky top-0 z-40 flex items-center px-4 gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Warehouse className="w-5 h-5 text-primary" strokeWidth={2} />
            <span className="text-base font-bold text-foreground hidden sm:inline">Ishchi rejimi</span>
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className="text-sm font-medium text-foreground truncate">
              Salom, <span className="text-primary">{user?.name || 'Ishchi'}</span> 👋
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <InstallPwaButton />
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Chiqish</span>
            </Button>
          </div>
        </header>
        <main className="p-4 sm:p-6 min-h-[calc(100vh-3.5rem)]">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 border-r border-border bg-card h-screen fixed left-0 top-0 z-30">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
          <Warehouse className="w-6 h-6 text-primary" strokeWidth={2} />
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Omborxona
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
              {user?.name?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <div className="px-1">
            <InstallPwaButton />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Chiqish
          </Button>
        </div>
      </aside>

      {/* Header */}
      <header className="lg:pl-64 h-14 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40 flex items-center px-4 lg:px-6">
        <div className="lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <SheetTitle className="sr-only">Menyu</SheetTitle>
              <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border shrink-0">
                <Warehouse className="w-6 h-6 text-primary" />
                <span className="text-lg font-bold text-foreground">Omborxona</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarNav onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <SubscriptionBadge />
          <span className="text-sm text-muted-foreground hidden sm:block">{user?.name || 'Admin'}</span>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="lg:ml-64 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-3.5rem)]">
        <Outlet />
      </main>
    </div>
  );
}
