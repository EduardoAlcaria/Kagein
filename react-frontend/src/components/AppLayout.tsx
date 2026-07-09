import { Outlet } from 'react-router-dom';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AlertBanner } from './AlertBanner';
import { useAlerts } from '../hooks/useAlerts';

export function AppLayout() {
  const { data: alerts } = useAlerts();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AlertBanner alerts={alerts ?? []} />
        <header className="flex items-center gap-2 border-b border-border px-4 py-2">
          <SidebarTrigger />
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
