import { useRef } from 'react';
import { Upload, X, AlertCircle, ImageIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type GalleryImageType = 'exterior' | 'interior' | 'floorplan';

export interface GalleryImage {
  id: string;
  type: GalleryImageType;
  /** Already-uploaded image (edit mode / kept from before). */
  url?: string;
  /** Freshly picked, not yet uploaded — goes with `preview`. */
  file?: File;
  preview?: string;
}

const TYPE_LABELS: Record<GalleryImageType, string> = {
  exterior: 'Exterior / Other',
  interior: 'Interior',
  floorplan: 'Floor Plan',
};

interface AircraftImageGalleryProps {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  minRequired?: number;
}

/** One combined image gallery for every aircraft photo — exterior, interior
 * and floor plan alike — instead of three separate upload boxes scattered
 * across the form. Each thumbnail is tagged with what it shows; the
 * minimum-3 requirement and the "needs a floor plan" rule both apply across
 * the whole gallery. */
export function AircraftImageGallery({ images, onChange, minRequired = 3 }: AircraftImageGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFloorplan = images.some((img) => img.type === 'floorplan');
  const isShort = images.length < minRequired;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter((file) => file.type.startsWith('image/'));

    const newImages = await Promise.all(
      validFiles.map(
        (file) =>
          new Promise<GalleryImage>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({ id: crypto.randomUUID(), type: 'exterior', file, preview: reader.result as string });
            };
            reader.readAsDataURL(file);
          })
      )
    );

    onChange([...images, ...newImages]);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        Aircraft Images *
        <span className="text-xs text-muted-foreground">(Minimum {minRequired}, including one Floor Plan)</span>
      </Label>

      {(isShort || !hasFloorplan) && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {isShort
            ? `Please add at least ${minRequired} images (${images.length}/${minRequired})`
            : 'Tag one image as Floor Plan'}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {images.map((img, index) => (
          <div key={img.id} className="relative aspect-video bg-secondary rounded overflow-hidden group">
            <img src={img.url || img.preview} alt={TYPE_LABELS[img.type]} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, i) => i !== index))}
              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="absolute bottom-0 inset-x-0">
              <Select
                value={img.type}
                onValueChange={(v) => {
                  const updated = [...images];
                  updated[index] = { ...img, type: v as GalleryImageType };
                  onChange(updated);
                }}
              >
                <SelectTrigger
                  className={cn(
                    'h-6 rounded-none border-0 text-[10px] px-1.5 focus:ring-0',
                    img.type === 'floorplan' ? 'bg-primary text-primary-foreground' : 'bg-black/60 text-white'
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as GalleryImageType[]).map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="aspect-video border-2 border-dashed border-muted-foreground/30 rounded flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Add Image</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
