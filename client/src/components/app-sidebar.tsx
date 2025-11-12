import { useLocation } from "wouter";
import { Database, Home, Database as DataIcon, GitBranch, FileText, RefreshCw, BarChart3, Settings, LayoutDashboard, HelpCircle, BookOpen, Play } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTour } from "@/components/tour/TourProvider";

const navigationItems = [
  { path: '/', label: 'Dashboard', icon: Home, testId: 'link-dashboard' },
  { path: '/application-config', label: 'Application Config', icon: Settings, testId: 'link-application-config' },
  { path: '/source-connections', label: 'Source Connections', icon: DataIcon, testId: 'link-source-connections' },
  { path: '/pipelines', label: 'Data Pipeline', icon: GitBranch, testId: 'link-pipelines' },
  { path: '/data-dictionary', label: 'Data Dictionary', icon: FileText, testId: 'link-data-dictionary' },
  { path: '/reconciliation', label: 'Data Reconciliation', icon: RefreshCw, testId: 'link-data-reconciliation' },
  { path: '/data-quality', label: 'Data Quality', icon: BarChart3, testId: 'link-data-quality' },
  { path: '/custom-dashboard', label: 'Custom Dashboard', icon: LayoutDashboard, testId: 'link-custom-dashboard' },
];

export default function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { startTour } = useTour();

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center space-x-2 px-2">
          <Database className="text-blue-600 h-6 w-6 flex-shrink-0" />
          <span className="font-bold text-gray-900 group-data-[collapsible=icon]:hidden">UnifyData AI</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  onClick={() => setLocation(item.path)}
                  isActive={location === item.path}
                  tooltip={item.label}
                  data-testid={item.testId}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  tooltip="Help & Tour"
                  data-testid="button-help-menu"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Help & Tour</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem
                  onClick={() => setLocation('/help')}
                  data-testid="menu-item-view-documentation"
                  className="cursor-pointer"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  <span>View Documentation</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={startTour}
                  data-testid="menu-item-start-tour"
                  className="cursor-pointer"
                >
                  <Play className="h-4 w-4 mr-2" />
                  <span>Start Guided Tour</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}