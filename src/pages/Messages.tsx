import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, MessageSquare } from 'lucide-react';
import { useTeamChatList } from '@/hooks/useTeamChatList';

export default function Messages() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { items, isLoading } = useTeamChatList();

  const filtered = useMemo(() => {
    if (!searchQuery) return items;
    const term = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.reference.toLowerCase().includes(term) ||
        item.subtitle.toLowerCase().includes(term)
    );
  }, [items, searchQuery]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Your flight team chats — the round chat button on every page opens them too
          </p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid gap-3">
          {isLoading ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No conversations yet — team chats appear here once a flight you're on reaches Qualified.
              </CardContent>
            </Card>
          ) : (
            filtered.map((item) => (
              <Card
                key={item.leadId}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/leads/${item.leadId}/chat`)}
              >
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{item.reference}</span>
                      {item.stage && <Badge variant="secondary">{item.stage}</Badge>}
                    </div>
                    <p className="font-semibold truncate mt-1">{item.title}</p>
                    {item.subtitle && <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>}
                  </div>
                  {item.unread > 0 && <Badge className="bg-primary text-primary-foreground shrink-0">{item.unread} unread</Badge>}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
