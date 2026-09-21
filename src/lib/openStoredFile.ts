import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/** Opens a stored file (passport photo, PDF...) in a new tab so it can be read
 * side by side with a form - no download. The tab is opened straight away, from
 * the click, so the browser's pop-up blocker lets it through; it is pointed at
 * the file once the temporary link is ready. */
export async function openStoredFile(bucket: string, path: string) {
  const tab = window.open('', '_blank');
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    tab?.close();
    toast.error('Could not open the file');
    return;
  }
  if (tab) tab.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
