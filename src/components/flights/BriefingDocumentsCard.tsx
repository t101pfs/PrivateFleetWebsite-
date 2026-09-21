import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Download, FileText, IdCard } from 'lucide-react';
import { toast } from 'sonner';
import type { FlightPassenger } from './AddEditPassengerDialog';

interface UploadedDocument {
  id: string;
  file_name: string;
  file_path: string;
  created_at: string;
  uploaded_by: string;
  uploaderName: string;
}

async function downloadFromStorage(path: string, name: string) {
  const { data, error } = await supabase.storage.from('flight-documents').download(path);
  if (error || !data) {
    toast.error('Failed to download file');
    return;
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** What Sales uploaded for this flight - each passenger's passport / ID and any
 * other documents - shown to Operations before they fill in the briefing. */
export function BriefingDocumentsCard({ flightId }: { flightId: string }) {
  // Same query as the Passengers tab so both share one cache.
  const { data: passengers = [] } = useQuery({
    queryKey: ['flight-passengers', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_passengers')
        .select('*')
        .eq('flight_id', flightId)
        .order('is_vip', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as FlightPassenger[];
    },
    enabled: !!flightId,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['flight-documents-list', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_documents')
        .select('id, file_name, file_path, created_at, uploaded_by')
        .eq('flight_id', flightId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((d) => d.uploaded_by).filter(Boolean)));
      const names: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
        (profiles || []).forEach((p) => { names[p.user_id] = p.full_name || p.email; });
      }
      return (data || []).map((d) => ({ ...d, uploaderName: names[d.uploaded_by] || 'Someone' })) as UploadedDocument[];
    },
    enabled: !!flightId,
  });

  const withScan = passengers.filter((p) => p.passport_scan_path).length;
  const allHaveScan = passengers.length > 0 && withScan === passengers.length;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="font-semibold flex items-center gap-1.5">
              <IdCard className="h-4 w-4" />
              Passports &amp; IDs from Sales
            </p>
            <p className="text-xs text-muted-foreground">Check these before you fill in the briefing.</p>
          </div>
          {passengers.length === 0 ? (
            <Badge variant="secondary" className="bg-warning/10 text-warning font-normal gap-1">
              <AlertTriangle className="h-3 w-3" />
              No passengers added yet
            </Badge>
          ) : allHaveScan ? (
            <Badge variant="secondary" className="bg-success/10 text-success font-normal gap-1">
              <CheckCircle2 className="h-3 w-3" />
              All {passengers.length} uploaded
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-warning/10 text-warning font-normal gap-1">
              <AlertTriangle className="h-3 w-3" />
              {withScan} of {passengers.length} uploaded
            </Badge>
          )}
        </div>

        {passengers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sales hasn't added the passengers yet, so there are no passports to show.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {passengers.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 flex-wrap p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[p.nationality, p.passport_number].filter(Boolean).join(' · ') || 'No passport details typed yet'}
                  </p>
                </div>
                {p.passport_scan_path ? (
                  <Button size="sm" variant="outline" onClick={() => downloadFromStorage(p.passport_scan_path!, p.passport_scan_name || `${p.full_name}-passport`)}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Passport / ID
                  </Button>
                ) : (
                  <span className="text-xs font-medium text-warning flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Not uploaded yet
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {documents.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Other documents on this flight</p>
            <div className="rounded-lg border divide-y">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{doc.file_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {doc.uploaderName} · {format(new Date(doc.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => downloadFromStorage(doc.file_path, doc.file_name)} aria-label={`Download ${doc.file_name}`}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
