import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Paperclip, FileText, Download, Trash2, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface FlightDocument {
  id: string;
  flight_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  created_at: string;
}

interface DocumentAttachmentProps {
  flightId: string;
  documents: FlightDocument[];
  onDocumentsChange: () => void;
}

export function DocumentAttachment({ flightId, documents, onDocumentsChange }: DocumentAttachmentProps) {
  const { user, supabaseUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOperationsOrAdmin = user?.role === 'operations' || user?.role === 'admin';

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !supabaseUser) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large. Max size is 10MB.`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const filePath = `${flightId}/${crypto.randomUUID()}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('flight-documents')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Save record to database
        const { error: dbError } = await supabase
          .from('flight_documents')
          .insert({
            flight_id: flightId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type || 'application/octet-stream',
            uploaded_by: supabaseUser.id,
          });

        if (dbError) {
          console.error('Database error:', dbError);
          toast.error(`Failed to save ${file.name} record`);
          // Clean up uploaded file
          await supabase.storage.from('flight-documents').remove([filePath]);
          continue;
        }

        toast.success(`${file.name} uploaded successfully`);
      }

      onDocumentsChange();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('An error occurred during upload');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (doc: FlightDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('flight-documents')
        .download(doc.file_path);

      if (error) {
        toast.error('Failed to download file');
        return;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  const handleDelete = async (doc: FlightDocument) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('flight-documents')
        .remove([doc.file_path]);

      if (storageError) {
        toast.error('Failed to delete file');
        return;
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('flight_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) {
        toast.error('Failed to delete file record');
        return;
      }

      toast.success('File deleted successfully');
      onDocumentsChange();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const flightDocuments = documents.filter(d => d.flight_id === flightId);

  if (!isOperationsOrAdmin) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "text-muted-foreground relative",
            flightDocuments.length > 0 && "text-primary"
          )}
        >
          <Paperclip className="h-5 w-5" />
          {flightDocuments.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {flightDocuments.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Flight Documents</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Upload area */}
          <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Paperclip className="mr-2 h-4 w-4" />
                  Upload Documents
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Max file size: 10MB. Supported: PDF, DOC, XLS, JPG, PNG, TXT
            </p>
          </div>

          {/* Document list */}
          {flightDocuments.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {flightDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg"
                >
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {doc.uploaded_by === supabaseUser?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(doc)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No documents attached to this flight yet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
