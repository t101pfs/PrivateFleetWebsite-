import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Upload, Download, Trash2, Loader2, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ClientDocumentRow {
  id: string;
  file_path: string;
  file_name: string;
  created_at: string;
}

interface SignedContractFlight {
  id: string;
  route_from: string;
  route_to: string;
  client_contract_signed_path: string | null;
  client_contract_signed_name: string | null;
  client_contract_signed_at: string | null;
}

async function downloadStoredFile(bucket: string, path: string, name: string) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
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

export function ClientDocuments({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['client-documents', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_documents')
        .select('id, file_path, file_name, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ClientDocumentRow[];
    },
  });

  // Every signed Client Contract across this client's flights, pulled
  // together in one place rather than needing to open each flight to find it.
  const { data: signedContracts = [] } = useQuery({
    queryKey: ['client-signed-contracts', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, client_contract_signed_path, client_contract_signed_name, client_contract_signed_at')
        .eq('client_id', clientId)
        .not('client_contract_signed_path', 'is', null)
        .order('client_contract_signed_at', { ascending: false });
      if (error) throw error;
      return data as SignedContractFlight[];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const path = `${clientId}/${crypto.randomUUID()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('client-documents').upload(path, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from('client_documents').insert({
        client_id: clientId,
        file_path: path,
        file_name: file.name,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) {
        await supabase.storage.from('client-documents').remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-documents', clientId] });
      toast.success('Document uploaded');
    },
    onError: (e: Error) => toast.error('Failed to upload: ' + e.message),
    onSettled: () => setUploading(false),
  });

  const remove = useMutation({
    mutationFn: async (doc: ClientDocumentRow) => {
      await supabase.storage.from('client-documents').remove([doc.file_path]);
      const { error } = await supabase.from('client_documents').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-documents', clientId] });
      toast.success('Document removed');
    },
    onError: (e: Error) => toast.error('Failed to remove: ' + e.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    upload.mutate(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Uploaded Documents
          </h4>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            Upload
          </Button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileChange} />
        </div>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : documents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No documents uploaded yet (ID, passport, company registration, etc.)</p>
        ) : (
          <div className="space-y-1.5">
            {documents.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="p-2.5 flex items-center justify-between gap-2">
                  <button
                    className="flex items-center gap-2 text-sm text-primary hover:underline min-w-0"
                    onClick={() => downloadStoredFile('client-documents', doc.file_path, doc.file_name)}
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{doc.file_name}</span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remove.mutate(doc)} disabled={remove.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <FileSignature className="h-4 w-4" />
          Signed Contracts
        </h4>
        {signedContracts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No signed Client Contracts yet.</p>
        ) : (
          <div className="space-y-1.5">
            {signedContracts.map((flight) => (
              <Card key={flight.id}>
                <CardContent className="p-2.5 flex items-center justify-between gap-2">
                  <button
                    className="flex items-center gap-2 text-sm text-primary hover:underline min-w-0"
                    onClick={() => downloadStoredFile('flight-documents', flight.client_contract_signed_path!, flight.client_contract_signed_name || 'signed-client-contract')}
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{flight.route_from} → {flight.route_to}</span>
                  </button>
                  {flight.client_contract_signed_at && (
                    <span className="text-xs text-muted-foreground shrink-0">{format(new Date(flight.client_contract_signed_at), 'MMM d, yyyy')}</span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
