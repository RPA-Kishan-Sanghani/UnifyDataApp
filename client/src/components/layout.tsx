import { ReactNode } from 'react';
import AppSidebar from './app-sidebar';
import Header from './header';
import { SidebarProvider, SidebarInset } from './ui/sidebar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-screen overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full min-w-0 min-h-0">
          <div className="w-full max-w-full">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}