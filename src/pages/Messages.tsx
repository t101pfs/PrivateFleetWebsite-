import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { DocumentAttachment } from '@/components/messages/DocumentAttachment';
import { EmojiPicker } from '@/components/messages/EmojiPicker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { 
  Search, 
  Send, 
  Plane, 
  ArrowRight,
  ArrowLeft,
  MoreHorizontal,
  ExternalLink,
  FileText,
  AlertTriangle,
  Download,
  Loader2,
  CheckCheck,
  Check
} from 'lucide-react';

interface FlightDocument {
  id: string;
  flight_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  created_at: string;
}

interface FlightChat {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  status_sales: string;
  is_urgent: boolean | null;
  created_by: string;
  assigned_ops_id: string | null;
}

interface Message {
  id: string;
  flight_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

interface MessageRead {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

interface TypingUser {
  userId: string;
  userName: string;
}

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [flightChats, setFlightChats] = useState<FlightChat[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<FlightChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageReads, setMessageReads] = useState<MessageRead[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [documents, setDocuments] = useState<FlightDocument[]>([]);
  const [isUpdatingUrgent, setIsUpdatingUrgent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchFlightChats = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('flight_requests')
      .select('id, route_from, route_to, departure_date, departure_time, status_sales, is_urgent, created_by, assigned_ops_id')
      .neq('status_sales', 'cancelled')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setFlightChats(data);
      // Auto-select first chat only on desktop (md+) and only if nothing is selected yet
      if (data.length > 0 && typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
        setSelectedFlight(prev => prev ?? data[0]);
      }
    }
    setIsLoading(false);
  }, []);

  const fetchMessages = useCallback(async (flightId: string) => {
    setIsLoadingMessages(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('flight_id', flightId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
      
      // Fetch read receipts for these messages
      const messageIds = data.map(m => m.id);
      if (messageIds.length > 0) {
        const { data: readsData } = await supabase
          .from('message_reads')
          .select('*')
          .in('message_id', messageIds);
        
        if (readsData) {
          setMessageReads(readsData);
        }
      }
      
      // Mark unread messages as read for current user
      if (user) {
        const unreadMessageIds = data
          .filter(m => m.sender_id !== user.id)
          .map(m => m.id);
        
        // Check which ones haven't been read yet by this user
        const { data: existingReads } = await supabase
          .from('message_reads')
          .select('message_id')
          .eq('user_id', user.id)
          .in('message_id', unreadMessageIds);
        
        const alreadyReadIds = new Set((existingReads || []).map(r => r.message_id));
        const toMarkAsRead = unreadMessageIds.filter(id => !alreadyReadIds.has(id));
        
        if (toMarkAsRead.length > 0) {
          const readReceipts = toMarkAsRead.map(messageId => ({
            message_id: messageId,
            user_id: user.id,
          }));
          
          await supabase.from('message_reads').insert(readReceipts);
        }
      }
    }
    setIsLoadingMessages(false);
  }, [user]);

  const fetchDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from('flight_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDocuments(data);
    }
  }, []);

  useEffect(() => {
    fetchFlightChats();
    fetchDocuments();
  }, [fetchFlightChats, fetchDocuments]);

  // Fetch messages when flight is selected
  useEffect(() => {
    if (selectedFlight) {
      fetchMessages(selectedFlight.id);
    }
  }, [selectedFlight, fetchMessages]);

  // Subscribe to realtime updates for messages and read receipts
  useEffect(() => {
    if (!selectedFlight) return;

    const messagesChannel = supabase
      .channel(`messages-${selectedFlight.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `flight_id=eq.${selectedFlight.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => [...prev, newMsg]);
          
          // Mark as read if not from current user
          if (user && newMsg.sender_id !== user.id) {
            supabase.from('message_reads').insert({
              message_id: newMsg.id,
              user_id: user.id,
            }).then(() => {});
          }
        }
      )
      .subscribe();

    // Subscribe to read receipts for messages in this flight
    const readsChannel = supabase
      .channel(`message-reads-${selectedFlight.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        (payload) => {
          const newRead = payload.new as MessageRead;
          // Check if this read is for a message in current flight
          setMessageReads(prev => {
            if (prev.some(r => r.id === newRead.id)) return prev;
            return [...prev, newRead];
          });
        }
      )
      .subscribe();

    // Typing indicator channel using broadcast
    const typingChannel = supabase
      .channel(`typing-${selectedFlight.id}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, userName, isTyping } = payload.payload as { userId: string; userName: string; isTyping: boolean };
        
        // Ignore own typing events
        if (userId === user?.id) return;
        
        setTypingUsers(prev => {
          if (isTyping) {
            // Add user if not already typing
            if (!prev.some(u => u.userId === userId)) {
              return [...prev, { userId, userName }];
            }
            return prev;
          } else {
            // Remove user from typing list
            return prev.filter(u => u.userId !== userId);
          }
        });
      })
      .subscribe();

    typingChannelRef.current = typingChannel;

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(readsChannel);
      supabase.removeChannel(typingChannel);
      typingChannelRef.current = null;
    };
  }, [selectedFlight?.id, user]);

  // Subscribe to realtime updates for flight requests
  useEffect(() => {
    const channel = supabase
      .channel('flight-urgent-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'flight_requests',
        },
        (payload) => {
          const updated = payload.new as FlightChat;
          setFlightChats(prev => 
            prev.map(f => f.id === updated.id ? { ...f, is_urgent: updated.is_urgent } : f)
          );
          if (selectedFlight?.id === updated.id) {
            setSelectedFlight(prev => prev ? { ...prev, is_urgent: updated.is_urgent } : prev);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedFlight?.id]);

  // Broadcast typing status
  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!typingChannelRef.current || !user || !selectedFlight) return;
    
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: user.id,
        userName: user.name,
        isTyping,
      },
    });
  }, [user, selectedFlight]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Broadcast typing started
    broadcastTyping(true);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      broadcastTyping(false);
    }, 2000);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedFlight || !user || isSending) return;
    
    // Stop typing indicator when sending
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    broadcastTyping(false);
    setIsSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          flight_id: selectedFlight.id,
          sender_id: user.id,
          sender_name: user.name,
          sender_role: user.role,
          content: messageContent,
        });

      if (error) throw error;

      // Create notifications for relevant users (excluding sender)
      const notificationsToCreate: Array<{
        user_id: string;
        type: string;
        title: string;
        message: string;
        flight_id: string;
      }> = [];

      // Notify the flight creator if they're not the sender
      if (selectedFlight.created_by && selectedFlight.created_by !== user.id) {
        notificationsToCreate.push({
          user_id: selectedFlight.created_by,
          type: 'chat_message',
          title: 'New Message',
          message: `${user.name} sent a message on flight ${selectedFlight.route_from} → ${selectedFlight.route_to}`,
          flight_id: selectedFlight.id,
        });
      }

      // Notify the assigned ops user if they're not the sender and not the creator
      if (
        selectedFlight.assigned_ops_id && 
        selectedFlight.assigned_ops_id !== user.id &&
        selectedFlight.assigned_ops_id !== selectedFlight.created_by
      ) {
        notificationsToCreate.push({
          user_id: selectedFlight.assigned_ops_id,
          type: 'chat_message',
          title: 'New Message',
          message: `${user.name} sent a message on flight ${selectedFlight.route_from} → ${selectedFlight.route_to}`,
          flight_id: selectedFlight.id,
        });
      }

      // Insert all notifications
      if (notificationsToCreate.length > 0) {
        await supabase.from('notifications').insert(notificationsToCreate);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  const handleViewFlightDetails = () => {
    if (!selectedFlight) return;
    navigate(`/flights?selected=${selectedFlight.id}`);
  };

  const handleViewDocuments = () => {
    // Scroll to the document attachment area or open documents panel
    const docsElement = document.querySelector('[data-documents]');
    if (docsElement) {
      docsElement.scrollIntoView({ behavior: 'smooth' });
    }
    toast.info('Documents section highlighted below');
  };

  // Check if user can remove urgent status (only owner, admin, or super_admin)
  const canRemoveUrgent = (): boolean => {
    if (!user || !selectedFlight) return false;
    
    // Admin and super_admin can always remove
    if (user.role === 'admin' || user.role === 'super_admin') return true;
    
    // Sales user who owns the flight can remove
    if (user.role === 'sales' && selectedFlight.created_by === user.id) return true;
    
    // Operations cannot remove urgent status
    return false;
  };

  const handleMarkUrgent = async () => {
    if (isUpdatingUrgent || !selectedFlight) return;
    
    const currentlyUrgent = selectedFlight.is_urgent || false;
    const newUrgentStatus = !currentlyUrgent;

    // Check permission when trying to remove urgent status
    if (currentlyUrgent && !canRemoveUrgent()) {
      toast.error('Only the flight owner or admin can remove the urgent status');
      return;
    }
    
    setIsUpdatingUrgent(true);

    try {
      const { error } = await supabase
        .from('flight_requests')
        .update({ is_urgent: newUrgentStatus })
        .eq('id', selectedFlight.id);

      if (error) throw error;

      // Update local state
      setFlightChats(prev => 
        prev.map(f => f.id === selectedFlight.id ? { ...f, is_urgent: newUrgentStatus } : f)
      );
      setSelectedFlight(prev => prev ? { ...prev, is_urgent: newUrgentStatus } : prev);

      // Create notification for team if marking as urgent
      if (newUrgentStatus && user) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'flight_urgent',
          title: 'Flight Marked Urgent',
          message: `Flight ${selectedFlight.id.slice(0, 8).toUpperCase()} has been marked as urgent`,
          flight_id: selectedFlight.id,
        });
      }

      toast.success(newUrgentStatus ? 'Flight marked as urgent' : 'Flight unmarked as urgent');
    } catch (error) {
      console.error('Error updating urgent status:', error);
      toast.error('Failed to update urgent status');
    } finally {
      setIsUpdatingUrgent(false);
    }
  };

  const handleExportChat = () => {
    if (!selectedFlight) return;
    
    const chatContent = messages.map(m => 
      `[${new Date(m.created_at).toLocaleString()}] ${m.sender_name} (${m.sender_role}): ${m.content}`
    ).join('\n');

    const exportData = `Flight Chat Export
==================
Flight ID: ${selectedFlight.id.slice(0, 8).toUpperCase()}
Route: ${selectedFlight.route_from} → ${selectedFlight.route_to}
Date: ${new Date(selectedFlight.departure_date).toLocaleDateString()}
Time: ${selectedFlight.departure_time}

Messages:
---------
${chatContent || 'No messages yet'}

Exported on: ${new Date().toLocaleString()}
`;

    const blob = new Blob([exportData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flight-chat-${selectedFlight.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Chat exported successfully');
  };

  const isUrgent = selectedFlight?.is_urgent || false;

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)]">
        <div className="flex h-full gap-4 md:gap-6">
          {/* Conversation List */}
          <div className={cn(
            "w-full md:w-80 md:flex-shrink-0 bg-card rounded-xl border border-border flex-col",
            selectedFlight ? "hidden md:flex" : "flex"
          )}>
            <div className="p-4 border-b border-border">
              <h2 className="font-display font-semibold text-lg mb-3">Flight Chats</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search conversations..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : flightChats.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No flight chats available
                </div>
              ) : (
                flightChats
                  .filter(flight => 
                    searchQuery === '' || 
                    flight.route_from.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    flight.route_to.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    flight.id.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((flight) => {
                  const isActive = selectedFlight?.id === flight.id;
                  const isFlightUrgent = flight.is_urgent || false;
                  return (
                    <button
                      key={flight.id}
                      onClick={() => setSelectedFlight(flight)}
                      className={cn(
                        "w-full p-4 text-left border-b border-border transition-colors relative",
                        isActive ? "bg-primary/5" : "hover:bg-secondary/50",
                        isFlightUrgent && "border-l-2 border-l-destructive"
                      )}
                    >
                      {isFlightUrgent && (
                        <div className="absolute top-2 left-3">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{flight.id.slice(0, 8).toUpperCase()}
                          </span>
                          {isFlightUrgent && (
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(flight.departure_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <span className="font-medium text-foreground">
                          {flight.route_from}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {flight.route_to}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {flight.departure_time}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={cn(
            "flex-1 bg-card rounded-xl border border-border flex-col min-w-0",
            selectedFlight ? "flex" : "hidden md:flex"
          )}>
            {selectedFlight ? (
              <>
                {/* Chat Header */}
                <div className="p-3 md:p-4 border-b border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden shrink-0"
                      onClick={() => setSelectedFlight(null)}
                      aria-label="Back to chats"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 hidden sm:flex">
                      <Plane className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-semibold text-foreground truncate text-sm md:text-base">
                          {selectedFlight.route_from} → {selectedFlight.route_to}
                        </h3>
                        <span className="font-mono text-xs text-muted-foreground hidden sm:inline">
                          #{selectedFlight.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">
                        {new Date(selectedFlight.departure_date).toLocaleDateString('en-US', { 
                          weekday: 'short',
                          month: 'short', 
                          day: 'numeric' 
                        })} at {selectedFlight.departure_time}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-popover">
                      <DropdownMenuItem onClick={handleViewFlightDetails}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Flight Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleViewDocuments}>
                        <FileText className="h-4 w-4 mr-2" />
                        View Documents
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {/* Hide unmark option from operations users */}
                      {(!isUrgent || canRemoveUrgent()) && (
                        <DropdownMenuItem 
                          onClick={handleMarkUrgent} 
                          disabled={isUpdatingUrgent}
                        >
                          <AlertTriangle className={cn("h-4 w-4 mr-2", isUrgent && "text-destructive")} />
                          {isUrgent ? 'Unmark Urgent' : 'Mark as Urgent'}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleExportChat}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Chat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isOwn = message.sender_id === user?.id;
                      // Check read status for own messages
                      const reads = messageReads.filter(r => 
                        r.message_id === message.id && r.user_id !== message.sender_id
                      );
                      const isRead = reads.length > 0;
                      
                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex gap-2 md:gap-3",
                            isOwn && "flex-row-reverse"
                          )}
                        >
                          <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                            message.sender_role === 'sales' 
                              ? "bg-accent/20 text-accent" 
                              : "bg-warning/20 text-warning"
                          )}>
                            {message.sender_name.charAt(0)}
                          </div>
                          <div className={cn(
                            "max-w-[85%] sm:max-w-[70%] min-w-0",
                            isOwn && "text-right"
                          )}>
                            <div className={cn(
                              "flex items-center gap-2 mb-1 flex-wrap",
                              isOwn && "justify-end"
                            )}>
                              <span className="text-sm font-medium text-foreground">
                                {isOwn ? 'You' : message.sender_name}
                              </span>
                              <span className="text-xs text-muted-foreground capitalize hidden sm:inline">
                                {message.sender_role}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(message.created_at).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div className={cn(
                              "inline-block px-3 md:px-4 py-2 md:py-2.5 rounded-2xl max-w-full",
                              isOwn 
                                ? "bg-primary text-primary-foreground rounded-br-md" 
                                : "bg-secondary text-secondary-foreground rounded-bl-md"
                            )}>
                              <p className="text-sm break-words whitespace-pre-wrap text-left">{message.content}</p>
                            </div>
                            {/* Read receipt for own messages */}
                            {isOwn && (
                              <div className={cn(
                                "flex items-center gap-1 mt-1",
                                isOwn && "justify-end"
                              )}>
                                {isRead ? (
                                  <>
                                    <CheckCheck className="h-3.5 w-3.5 text-accent" />
                                    <span className="text-[10px] text-muted-foreground">
                                      Seen at {new Date(reads[0].read_at).toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground">
                                      Sent
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                  <div className="px-4 py-2 border-t border-border bg-secondary/30">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span>
                        {typingUsers.length === 1 
                          ? `${typingUsers[0].userName} is typing...`
                          : `${typingUsers.map(u => u.userName).join(', ')} are typing...`
                        }
                      </span>
                    </div>
                  </div>
                )}

                {/* Message Input */}
                <div className="p-3 md:p-4 border-t border-border" data-documents>
                  <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                    <DocumentAttachment 
                      flightId={selectedFlight.id} 
                      documents={documents} 
                      onDocumentsChange={fetchDocuments} 
                    />
                    <EmojiPicker 
                      onEmojiSelect={(emoji) => setNewMessage(prev => prev + emoji)} 
                    />
                    <Input
                      placeholder="Type message..."
                      value={newMessage}
                      onChange={handleInputChange}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      className="flex-1 min-w-0"
                      disabled={isSending}
                    />
                    <Button 
                      className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0" 
                      size="icon" 
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || isSending}
                    >
                      {isSending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                {isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <p>Select a flight to start chatting</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
