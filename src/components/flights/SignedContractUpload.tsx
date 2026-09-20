import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PenLine } from 'lucide-react';

interface SignedContractUploadProps {
  onSubmit: (file: File) => void;
  isPending: boolean;
  disabled?: boolean;
}

/** Step two of an Admin signature: after downloading and signing the contract
 * outside the system, upload the signed copy here. */
export function SignedContractUpload({ onSubmit, isPending, disabled }: SignedContractUploadProps) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Download the contract, sign it, then upload the signed copy.</p>
      <div className="flex items-center gap-2 flex-wrap">
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
    </div>
  );
}
