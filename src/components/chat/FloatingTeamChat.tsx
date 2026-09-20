import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, MessageSquare } from 'lucide-react';
import { useTeamChatList } from '@/hooks/useTeamChatList';
import { LeadChatPanel } from '@/components/leads/LeadChatPanel';
import { cn } from '@/lib/utils';

const SIZE = 56;
const MARGIN = 12;
const STORAGE_KEY = 'pfs-chat-button';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

interface Placement {
  side: 'left' | 'right';
  y: number;
}

function loadPlacement(): Placement {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && (saved.side === 'left' || saved.side === 'right') && typeof saved.y === 'number') return saved;
  } catch {
    // no saved position
  }
  return { side: 'right', y: Math.round(window.innerHeight * 0.6) };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/** A round chat button that follows you around the app (like iOS's floating
 * assistive button). Drag it anywhere - it snaps to the nearest side and
 * remembers where you left it. Tap it to open your team chats; on a flight or
 * lead page it opens that flight's chat straight away. */
export function FloatingTeamChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { items, totalUnread } = useTeamChatList();

  const [placement, setPlacement] = useState<Placement>(loadPlacement);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const gesture = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

  // Which flight/lead is on screen right now, if any.
  const leadMatch = location.pathname.match(new RegExp(`^/leads/(${UUID})(?:/|$)`, 'i'));
  const flightMatch = location.pathname.match(new RegExp(`^/flights/(${UUID})(?:/|$)`, 'i'));
  const onFullChatPage = /^\/leads\/[^/]+\/chat\/?$/.test(location.pathname);

  const { data: flightLeadId } = useQuery({
    queryKey: ['floating-chat-flight-lead', flightMatch?.[1]],
    queryFn: async () => {
      const { data } = await supabase.from('flight_requests').select('lead_id').eq('id', flightMatch![1]).maybeSingle();
      return data?.lead_id ?? null;
    },
    enabled: !!flightMatch,
  });
  const contextLeadId = leadMatch?.[1] ?? flightLeadId ?? null;

  // Keep the button on screen if the window shrinks.
  useEffect(() => {
    const onResize = () => setPlacement((p) => ({ ...p, y: clamp(p.y, MARGIN, window.innerHeight - SIZE - MARGIN) }));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const openChats = () => {
    const inThisChat = contextLeadId && items.some((i) => i.leadId === contextLeadId);
    setActiveLeadId(inThisChat ? contextLeadId : null);
    setOpen(true);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Reading a chat marks it read - refresh the badge.
      queryClient.invalidateQueries({ queryKey: ['message-leads-unread'] });
      queryClient.invalidateQueries({ queryKey: ['lead-team-chat-unread'] });
    }
  };

  const restingLeft = placement.side === 'left' ? MARGIN : window.innerWidth - SIZE - MARGIN;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { px: e.clientX, py: e.clientY, ox: restingLeft, oy: placement.y, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.px;
    const dy = e.clientY - g.py;
    if (!g.moved && Math.hypot(dx, dy) < 6) return;
    g.moved = true;
    setDrag({
      x: clamp(g.ox + dx, 0, window.innerWidth - SIZE),
      y: clamp(g.oy + dy, MARGIN, window.innerHeight - SIZE - MARGIN),
    });
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (!g.moved || !drag) {
      setDrag(null);
      openChats();
      return;
    }
    const next: Placement = { side: drag.x + SIZE / 2 < window.innerWidth / 2 ? 'left' : 'right', y: drag.y };
    setPlacement(next);
    setDrag(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // position just won't be remembered
    }
  };

  // The full-page chat already is the chat.
  if (onFullChatPage) return null;

  const activeItem = items.find((i) => i.leadId === activeLeadId) || null;

  return (
    <>
      <button
        type="button"
        aria-label={totalUnread > 0 ? `Team chat, ${totalUnread} unread` : 'Team chat'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { gesture.current = null; setDrag(null); }}
        // Enter / Space (a click with no pointer) opens it too
        onClick={(e) => { if (e.detail === 0) openChats(); }}
        style={{
          left: drag ? drag.x : restingLeft,
          top: drag ? drag.y : placement.y,
          width: SIZE,
          height: SIZE,
          touchAction: 'none',
          transition: drag ? 'none' : 'left 180ms ease-out, top 180ms ease-out',
        }}
        className={cn(
          'fixed z-40 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30',
          'flex items-center justify-center select-none cursor-grab active:cursor-grabbing',
          'ring-4 ring-primary/20 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-primary/60',
          drag ? 'opacity-100 scale-105' : 'opacity-90 hover:opacity-100'
        )}
      >
        <MessageSquare className="h-6 w-6 pointer-events-none" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center pointer-events-none">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
          <SheetTitle className="sr-only">Team chats</SheetTitle>
          {activeLeadId ? (
            <LeadChatPanel
              leadId={activeLeadId}
              reference={activeItem?.reference}
              onBack={() => setActiveLeadId(null)}
              onOpenFullPage={() => {
                setOpen(false);
                navigate(`/leads/${activeLeadId}/chat`);
              }}
            />
          ) : (
            <div className="flex flex-col h-full min-h-0">
              <div className="p-4 border-b pr-12">
                <h2 className="font-semibold">Team Chats</h2>
                <p className="text-xs text-muted-foreground">Pick a flight to open its chat.</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    No chats yet — a flight's team chat appears here once you're on it.
                  </p>
                ) : (
                  items.map((item) => (
                    <button
                      key={item.leadId}
                      type="button"
                      onClick={() => setActiveLeadId(item.leadId)}
                      className="w-full text-left rounded-lg border p-3 flex items-center gap-3 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{item.reference}</span>
                          {item.stage && <Badge variant="secondary" className="font-normal">{item.stage}</Badge>}
                          {item.leadId === contextLeadId && <Badge className="bg-primary/10 text-primary font-normal">This flight</Badge>}
                        </div>
                        <p className="font-medium truncate mt-0.5">{item.title}</p>
                        {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
                      </div>
                      {item.unread > 0 && <Badge className="bg-primary text-primary-foreground shrink-0">{item.unread}</Badge>}
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
