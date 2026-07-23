import { useCallback, useRef, useEffect } from 'react';

// Simple notification sound (short beep) as base64
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleig4NrjPxLq3Vxgbnd/WxKFvJAxGpOXNr4NSBCGLzt7Au3EvIjl5wu3u0aFlKgwjZ7fw8tu4elAyJE1owfH058GTYBwJJlZ8s/Hu4LuOZDYXJUdnorny6Mi0jG9COyY/VoSu8uzYv5huPh8dM1BxnMXz6NPDpYhiRzIpMkVhjbvv6dfKsZRzVkM1Lj5QcZi98efXy7eig2tYSjwzPFBskLjr5NfMu6iMeGRWRzw4PVJvlrPo4tPMv6+TgG1gVEg+OkBYdZq26eDRzMO2oI15bGBWTEVBRlx4nrTl3c/JwrGejnxuZFtUS0dIUWaCs+LYzcjDt6aVhHRoXlZPS0tTYHeeyNfMyMW+tKGPgHJmXVZRUFRcaH+mzNPLx8O8sqKTg3VpYFhUUlVaZXSLsNDLyMW/t6ySg3ZpYFhUUlVaZHOJrs/JxsO+tqqRgnVoX1dTUVRZY3GGqszIxMG8s6ePgXRnXlZSUFNYYW+Dp8jEwb65sKSMfnFkW1NQTlFWX2x/osXCv7u2rKGJe25hWFBNS05TWGdzkrzAvrq1rKGHem1gV09MS09UXGp4mcC9u7ezqqCEd2pfVk5LSkxRV2Rwhqe9ubazraeCdGhdVEtISUpOVF9reZyzu7WxraaCc2ZcUklGRkhMUltncIygtrOwr6mfgHFkWk9HREVHTlRfaneNorOvraunn31uYVdNRkNERkxTXmhzi5+vrKqoopp6bF9VTEVCQkVKUVpkb4WZq6mmop6WdmpdU0pDQEFESU9XXGd0hpemop+dnJR0aFxSSkNAQENHTFNaZHCAj52fnJqYkXFkWE9IQT8/QkdMUlpicX6MmZqXlZOObmFWT0dAPz9CRkpQV19qdoOOlZOQj4xsX1RMRj8+PkBER0xSWGFqdoGLkI2LiYVpXFJKQz49PD5BREhNUlhhanuEiYeFg4FmWU9IQTw7Oz1AQ0dLUFdeZ3N9g4N/fnxkV01GQDs5OTs9QERHTVJYXmhze39+e3p3Y1ZMRD45ODg6PEBDRktQVlxkaHFzdHFwbmJWTEQ+ODY2Nzo9QERHTEtRVVldYGNkYF9cVktCPDc0MzQ2OT0/QkVIS01QUlRUU1FOSkQ+ODQyMTI0Nzo8P0JFR0pLTU5OTUtJRD45NDEwMDE0Nzk8P0JERkdISEhHRUJAPDcyLy8vMTQ3Oj0/QUJDQ0RDQkA+PDk1MS8uLjA0Nzk7PT4/Pz4+PT08Ojg1Mi8uLS4xNDc5Ozw8PT09PDo5NzQxLy0sLS8yNDY4Ojw7Ozs6OTg2NDEvLSwrLS8yNDY3OTo6Ojo5NzY0MS8tKyssLi8yNDY4ODk5OTg3NjQyMC4sKywuMDI0Njc4ODg4NzY1MzEvLSwrKy0vMTM1Njc3Nzc3NjQzMS8tLCsrLC4wMjQ1Njc2NjY1NDMyMC4tKysrLTAxMzQ1NTY1NTQzMjAvLSwrKywuMDEzNDU1NTQzMzIxLy4sKysrLS8xMjM0NDQzMzIxMC4sKysqKy0vMDIzMzQzMzIxMC8uLCsqKistLzAxMjMzMzIyMC8uLCsqKiwtLzAxMjIyMjEwLy4tKyoqKiwtLzAxMTIxMTAvLi0sKioqKy0uLzAxMTEwMC8uLSwqKikqLC0uLzAwMDAvLy4tLCsqKSkrLC0uLy8wLy8uLi0sKyopKSorLC0uLi8vLi4tLSwrKikpKSssLS4uLi4tLS0sKyopKCkqKywtLS4tLS0sLCsqKSgoKSorLC0tLS0sLCwrKikpKCgpKistLCwtLCwsKyoqKSgoKCkrKywsLCwrKysqKSkpKCgpKisrKyssKysrKiopKSkoKCkqKisrKysrKioqKSkpKCgpKSoqKysqKioqKSkpKSgoKSkpKioqKioqKiopKSkpKCgpKSkqKioqKikpKSkpKSgoKCkpKSkqKikpKSkpKSkpKCgoKCkpKSkpKSkpKSkpKSkoKCgoKCkpKSkpKSkpKSkoKCgoKCgoKSkpKSkpKSkoKCgoKCgoKCkpKSkpKSkoKCgoKCgoKCgpKSkpKSkoKCgoKCgoKCgoKSkpKSkoKCgoKCgoKCgoKCkpKSkoKCgoKCgoKCgoKCgpKSkoKCgoKCgoKCgoKCgoKCkoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKA==';

export function useNotificationAlerts() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const permissionGranted = useRef(false);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
    audioRef.current.volume = 0.5;
    
    // Check/request notification permission
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        permissionGranted.current = true;
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          permissionGranted.current = permission === 'granted';
        });
      }
    }
  }, []);

  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Audio play failed - user hasn't interacted with page yet
      });
    }
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string, onClick?: () => void) => {
    // Don't show if page is visible
    if (document.visibilityState === 'visible') {
      playSound();
      return;
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: 'pfs-notification', // Prevents duplicate notifications
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        onClick?.();
      };

      playSound();
    } else {
      playSound();
    }
  }, [playSound]);

  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      permissionGranted.current = permission === 'granted';
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  return {
    playSound,
    showBrowserNotification,
    requestPermission,
    isSupported: 'Notification' in window,
  };
}
