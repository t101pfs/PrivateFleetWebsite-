import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ShiftScheduleSettings } from '@/components/settings/ShiftScheduleSettings';

export default function ShiftSchedule() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Shift Schedule</h1>
          <p className="text-muted-foreground mt-1">
            Who's on shift and who's paired with them. Admins manage this from Settings.
          </p>
        </div>
        <ShiftScheduleSettings readOnly />
      </div>
    </DashboardLayout>
  );
}
