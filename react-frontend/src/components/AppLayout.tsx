import { Outlet, useLocation } from 'react-router-dom';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './ui/sidebar';
import { AppSidebar, NAV_ITEMS } from './AppSidebar';
import { AlertBanner } from './AlertBanner';
import { useAlerts } from '../hooks/useAlerts';

export function AppLayout() {
  const { data: alerts } = useAlerts();
  const location = useLocation();
  const currentLabel =
    NAV_ITEMS.find((item) => item.to === location.pathname)?.label ?? 'Find My Dashboard';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AlertBanner alerts={alerts ?? []} />
        <header className="flex items-center gap-3 border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl">
          <SidebarTrigger />
          <h2 className="font-display text-lg font-semibold tracking-tight">{currentLabel}</h2>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
