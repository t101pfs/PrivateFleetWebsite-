import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatClock } from '@/hooks/useVoiceRecorder';

interface VoiceNotePlayerProps {
  path: string;
  /** Length recorded at send time - browser-recorded clips often report no
   * duration of their own, so this is what the progress bar runs against. */
  durationSeconds: number | null;
  mine: boolean;
}

/** Play/pause + progress for one voice note. The recording lives in a private
 * bucket, so the audio is only fetched (via a short-lived link) once played. */
export function VoiceNotePlayer({ path, durationSeconds, mine }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [wantsPlay, setWantsPlay] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  const { data: url, isFetching, isError } = useQuery({
    queryKey: ['chat-voice-note-url', path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('chat-voice-notes').createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: wantsPlay,
    staleTime: 50 * 60 * 1000,
  });

  useEffect(() => {
    if (!url) return;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.ontimeupdate = () => setPosition(audio.currentTime);
    audio.onended = () => {
      setPlaying(false);
      setPosition(0);
    };
    audio.onpause = () => setPlaying(false);
    audio.onplay = () => setPlaying(true);
    audio.play().catch(() => setPlaying(false));
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [url]);

  const toggle = () => {
    if (!wantsPlay) {
      setWantsPlay(true);
    } else if (audioRef.current) {
      if (audioRef.current.paused) audioRef.current.play().catch(() => setPlaying(false));
      else audioRef.current.pause();
    }
  };

  const total = durationSeconds || 0;
  const progress = total > 0 ? Math.min(100, (position / total) * 100) : 0;
  const loading = wantsPlay && isFetching;

  return (
    <div className="flex items-center gap-2.5 min-w-[11rem]">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={cn(
          'h-8 w-8 shrink-0 rounded-full flex items-center justify-center transition-colors',
          mine ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30' : 'bg-foreground/10 hover:bg-foreground/20'
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className={cn('h-1.5 rounded-full overflow-hidden', mine ? 'bg-primary-foreground/25' : 'bg-foreground/15')}>
          <div
            className={cn('h-full rounded-full', mine ? 'bg-primary-foreground' : 'bg-primary')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[11px] mt-1 opacity-80 tabular-nums">
          {isError ? "Couldn't load audio" : playing || position > 0 ? `${formatClock(position)} / ${formatClock(total)}` : formatClock(total)}
        </p>
      </div>
    </div>
  );
}
