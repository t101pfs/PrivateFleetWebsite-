import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PenLine } from 'lucide-react';
import { useFileDropAndPaste } from '@/hooks/useFileDropAndPaste';

interface SignedContractUploadProps {
  onSubmit: (file: File) => void;
  isPending: boolean;
  disabled?: boolean;
}

/** Step two of an Admin signature: after downloading and signing the contract
 * outside the system, upload the signed copy here. */
export function SignedContractUpload({ onSubmit, isPending, disabled }: SignedContractUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const { isDragOver, dropProps } = useFileDropAndPaste(
    (files) => { if (files[0] && !disabled && !isPending) setFile(files[0]); },
    { accept: 'any' }
  );

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Download the contract, sign it, then upload the signed copy (or drag/paste it below).</p>
      <div
        {...dropProps}
        className={`flex items-center gap-2 flex-wrap rounded-md p-1 -m-1 transition-colors ${isDragOver ? 'bg-primary/5 ring-2 ring-primary/40' : ''}`}
      >
        <Input
          type="file"
          className="max-w-xs"
          disabled={disabled || isPending}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <Button size="sm" onClick={() => file && onSubmit(file)} disabled={!file || disabled || isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <PenLine className="h-4 w-4 mr-1.5" />}
          Upload Signed Contract
        </Button>
      </div>
      {file && <p className="text-xs text-muted-foreground">Selected: {file.name}</p>}
    </div>
  );
}
