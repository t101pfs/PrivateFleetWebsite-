import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export const MAX_VOICE_NOTE_SECONDS = 300;

export interface RecordedVoiceNote {
  blob: Blob;
  /** Audio type without codec parameters, e.g. "audio/webm". */
  mimeType: string;
  durationSeconds: number;
}

/** Browsers disagree on the recording format (Chrome/Firefox: webm/ogg,
 * Safari: mp4), so take the first one this browser can actually produce. */
function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function extensionForMime(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'm4a';
  return 'webm';
}

/** Microphone recording for voice notes. `stop()` resolves with the finished
 * clip; `cancel()` throws it away. Auto-stops at MAX_VOICE_NOTE_SECONDS. */
export function useVoiceRecorder(onLimitReached?: (note: RecordedVoiceNote) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const finishRef = useRef<((note: RecordedVoiceNote | null) => void) | null>(null);
  const onLimitRef = useRef(onLimitReached);
  onLimitRef.current = onLimitReached;

  const cleanup = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setIsRecording(false);
    setElapsed(0);
  }, []);

  // Stop the microphone if the chat closes mid-recording.
  useEffect(() => () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      finishRef.current = null;
      recorderRef.current.stop();
    }
    cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    if (isRecording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error("This browser can't record audio");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type });
        const finish = finishRef.current;
        finishRef.current = null;
        cleanup();
        finish?.(blob.size > 0 ? { blob, mimeType: type, durationSeconds } : null);
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        const secs = Math.round((Date.now() - startedAtRef.current) / 1000);
        setElapsed(secs);
        if (secs >= MAX_VOICE_NOTE_SECONDS && recorderRef.current?.state === 'recording') {
          toast.info('Reached the 5 minute limit — sending what you recorded');
          finishRef.current = (note) => {
            if (note) onLimitRef.current?.(note);
          };
          recorderRef.current.stop();
        }
      }, 250);
    } catch (e) {
      cleanup();
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      toast.error(denied ? 'Microphone access is blocked — allow it in the browser address bar and try again' : "Couldn't start recording");
    }
  }, [isRecording, cleanup]);

  const stop = useCallback(
    () =>
      new Promise<RecordedVoiceNote | null>((resolve) => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === 'inactive') return resolve(null);
        finishRef.current = resolve;
        recorder.stop();
      }),
    []
  );

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    finishRef.current = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else cleanup();
  }, [cleanup]);

  return { isRecording, elapsed, start, stop, cancel };
}
