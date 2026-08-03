import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { UserManagement } from '@/components/settings/UserManagement';
import { useAuth } from '@/contexts/AuthContext';

export default function Users() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  // Only admin and super_admin can access user management
  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Users & Access Roles</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage user accounts and their sales/operations/admin roles.
          </p>
        </div>

        <UserManagement isSuperAdmin={isSuperAdmin} />
      </div>
    </DashboardLayout>
  );
}
