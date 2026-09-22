import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

// The app is installed as a PWA with an offline-caching service worker, so a
// tab left open (or even just reloaded within a day - browsers only recheck
// the service worker file that often on their own) can keep running a build
// from before the latest deploy, silently. Every fix looks like it "didn't
// happen" until the person happens to hard-refresh. This checks for a new
// build every minute and, once one is live, asks before switching to it -
// never swaps mid-use without asking, since that would drop unsaved typing.
export function PwaUpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => registration.update(), 60_000);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast('An update is ready', {
      description: 'Refresh to get the latest version of Private Fleet.',
      duration: Infinity,
      action: { label: 'Refresh', onClick: () => updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
