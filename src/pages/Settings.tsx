import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/settings/UserManagement';
import { SystemSettings } from '@/components/settings/SystemSettings';
import { AuditLogs } from '@/components/settings/AuditLogs';
import { KPIManagement } from '@/components/settings/KPIManagement';
import { Users, Settings as SettingsIcon, FileText, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('users');
  const { user, isLoading } = useAuth();
  
  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }
  
  // Redirect non-admin users to dashboard - only admin and super_admin can access settings
  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Admin Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage users, roles, system configuration, and view audit logs.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="bg-muted/50 p-1 w-max">
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">User Management</span>
                <span className="sm:hidden">Users</span>
              </TabsTrigger>
              {isSuperAdmin && (
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">System Settings</span>
                  <span className="sm:hidden">System</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="audit" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Audit Logs</span>
                <span className="sm:hidden">Audit</span>
              </TabsTrigger>
              <TabsTrigger value="kpis" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">KPI Management</span>
                <span className="sm:hidden">KPIs</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="users" className="mt-6">
            <UserManagement isSuperAdmin={isSuperAdmin} />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="settings" className="mt-6">
              <SystemSettings />
            </TabsContent>
          )}

          <TabsContent value="audit" className="mt-6">
            <AuditLogs />
          </TabsContent>

          <TabsContent value="kpis" className="mt-6">
            <KPIManagement />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
