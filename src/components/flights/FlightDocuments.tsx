import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  FileText, 
  Download, 
  Trash2, 
  Loader2, 
  Upload,
  User,
  UtensilsCrossed,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Briefcase
} from 'lucide-react';
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
  document_category?: string;
}

interface FlightDocumentsProps {
  flightId: string;
  isConfirmed?: boolean;
  onClose?: () => void;
}

const BASE_CATEGORIES = [
  { 
    id: 'passports', 
    label: 'Passports & IDs', 
    icon: User,
    accept: '.pdf,.jpg,.jpeg,.png',
    description: 'Passenger passports and identification documents'
  },
  { 
    id: 'catering', 
    label: 'Catering Profiles', 
    icon: UtensilsCrossed,
    accept: '.pdf,.doc,.docx,.xls,.xlsx',
    description: 'Catering preferences and special requirements'
  },
  { 
    id: 'additional', 
    label: 'Additional Documents', 
    icon: FolderOpen,
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt',
    description: 'Flight plans, contracts, and other documents'
  },
];

const CONFIRMED_CATEGORIES = [
  { 
    id: 'menu', 
    label: 'Menu', 
    icon: UtensilsCrossed,
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png',
    description: 'Confirmed catering menu for the flight'
  },
  { 
    id: 'flight_brief', 
    label: 'Flight Brief', 
    icon: Briefcase,
    accept: '.pdf,.doc,.docx',
    description: 'Flight briefing documents and operational info'
  },
];

export function FlightDocuments({ flightId, isConfirmed = false, onClose }: FlightDocumentsProps) {
  const { user, supabaseUser, effectiveRole } = useAuth();
  const [documents, setDocuments] = useState<FlightDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['passports', 'catering', 'menu', 'flight_brief', 'additional']);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isOperationsOrAdmin = effectiveRole === 'operations' || effectiveRole === 'admin' || effectiveRole === 'super_admin';
  const canView = isOperationsOrAdmin || effectiveRole === 'sales';

  // Combine categories based on confirmation status
  const DOCUMENT_CATEGORIES = isConfirmed 
    ? [...CONFIRMED_CATEGORIES, ...BASE_CATEGORIES]
    : BASE_CATEGORIES;

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('flight_documents')
      .select('*')
      .eq('flight_id', flightId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDocuments(data as FlightDocument[]);
    }
    setIsLoading(false);
  }, [flightId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !supabaseUser) return;

    setUploadingCategory(category);

    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large. Max size is 10MB.`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const filePath = `${flightId}/${category}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('flight-documents')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

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
          await supabase.storage.from('flight-documents').remove([filePath]);
          continue;
        }

        toast.success(`${file.name} uploaded successfully`);
      }

      fetchDocuments();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('An error occurred during upload');
    } finally {
      setUploadingCategory(null);
      const input = fileInputRefs.current[category];
      if (input) input.value = '';
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
      const { error: storageError } = await supabase.storage
        .from('flight-documents')
        .remove([doc.file_path]);

      if (storageError) {
        toast.error('Failed to delete file');
        return;
      }

      const { error: dbError } = await supabase
        .from('flight_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) {
        toast.error('Failed to delete file record');
        return;
      }

      toast.success('File deleted successfully');
      fetchDocuments();
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

  const getCategoryFromPath = (filePath: string): string => {
    const parts = filePath.split('/');
    if (parts.length >= 2) {
      const category = parts[1];
      const allCategoryIds = [...BASE_CATEGORIES, ...CONFIRMED_CATEGORIES].map(c => c.id);
      if (allCategoryIds.includes(category)) {
        return category;
      }
    }
    return 'additional';
  };

  const getDocumentsByCategory = (categoryId: string) => {
    return documents.filter(doc => getCategoryFromPath(doc.file_path) === categoryId);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  if (!canView) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>You don't have permission to view flight documents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        DOCUMENT_CATEGORIES.map((category) => {
          const categoryDocs = getDocumentsByCategory(category.id);
          const isExpanded = expandedCategories.includes(category.id);
          const Icon = category.icon;

          return (
            <div key={category.id} className="border border-border rounded-lg overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <h4 className="font-medium text-foreground">{category.label}</h4>
                    <p className="text-xs text-muted-foreground">{category.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {categoryDocs.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {categoryDocs.length}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Category Content */}
              {isExpanded && (
                <div className="p-4 space-y-3">
                  {/* Upload Button (Operations/Admin only) */}
                  {isOperationsOrAdmin && (
                    <div>
                      <input
                        ref={(el) => { fileInputRefs.current[category.id] = el; }}
                        type="file"
                        multiple
                        onChange={(e) => handleFileSelect(e, category.id)}
                        className="hidden"
                        accept={category.accept}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current[category.id]?.click()}
                        disabled={uploadingCategory === category.id}
                        className="w-full"
                      >
                        {uploadingCategory === category.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload {category.label}
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Document List */}
                  {categoryDocs.length > 0 ? (
                    <div className="space-y-2">
                      {categoryDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border"
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
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No documents uploaded yet
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
