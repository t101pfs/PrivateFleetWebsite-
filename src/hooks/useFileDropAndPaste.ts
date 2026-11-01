import { useCallback, useEffect, useState } from 'react';

function extractFiles(
  items: DataTransferItemList | FileList | null | undefined,
  accept: 'image' | 'any'
): File[] {
  if (!items) return [];
  const files: File[] = [];
  if (items instanceof FileList) {
    for (let i = 0; i < items.length; i++) {
      const f = items[i];
      if (accept === 'any' || f.type.startsWith('image/')) files.push(f);
    }
    return files;
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const f = item.getAsFile();
      if (f && (accept === 'any' || f.type.startsWith('image/'))) files.push(f);
    }
  }
  return files;
}

/**
 * Adds drag-and-drop and clipboard-paste on top of whatever click-to-browse
 * file input a form already has - every upload spot in the app only ever
 * had the one way in. Spread `dropProps` onto whichever element should
 * accept a drop (the dashed drop zone, the whole gallery, etc.); paste is
 * listened for globally while `enabled` is true, since a plain `onPaste`
 * on a div only fires if that exact div happens to have focus, which isn't
 * how anyone actually uses copy-paste.
 */
export function useFileDropAndPaste(
  onFiles: (files: File[]) => void,
  options?: { accept?: 'image' | 'any'; enabled?: boolean }
) {
  const accept = options?.accept ?? 'image';
  const enabled = options?.enabled ?? true;
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const handlePaste = (e: ClipboardEvent) => {
      const files = extractFiles(e.clipboardData?.items, accept);
      if (files.length > 0) {
        e.preventDefault();
        onFiles(files);
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, accept]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = extractFiles(e.dataTransfer?.files, accept);
      if (files.length > 0) onFiles(files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accept]
  );

  return { isDragOver, dropProps: { onDragOver, onDragLeave, onDrop } };
}
