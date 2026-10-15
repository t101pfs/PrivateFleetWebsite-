import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ShiftScheduleSettings } from '@/components/settings/ShiftScheduleSettings';
import { useAuth } from '@/contexts/AuthContext';

export default function ShiftSchedule() {
  const { user } = useAuth();
  const isAdminOrSuper = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Shift Schedule</h1>
          <p className="text-muted-foreground mt-1">
            {isAdminOrSuper
              ? "Who's on shift and who's paired with them."
              : "Who's on shift and who's paired with them. Admins manage this."}
          </p>
        </div>
        <ShiftScheduleSettings readOnly={!isAdminOrSuper} />
      </div>
    </DashboardLayout>
  );
}
