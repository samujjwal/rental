import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, useRevalidator } from "react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Search,
  MoreVertical,
  Image as ImageIcon,
  Paperclip,
  Smile,
  ArrowLeft,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "~/lib/utils";
import { Button, Badge } from "~/components/ui";
import { messagingApi, type Conversation as ApiConversation, type Message as ApiMessage } from "~/lib/api/messaging";
import { useAuthStore } from "~/lib/store/auth";
import { useSocket } from "~/hooks/use-socket";

export const meta: MetaFunction = () => {
  return [{ title: "Messages | GharBatai Rentals" }];
};

interface TransformedConversation {
  id: string;
  otherUser: {
    id: string;
    firstName: string;
    lastName: string | null;
    avatar: string | null;
    online: boolean;
  };
  lastMessage: {
    content: string;
    createdAt: string;
    read: boolean;
    senderId: string;
  } | null;
  listing?: {
    id: string;
    title: string;
    image: string;
  };
  unreadCount: number;
}

interface TransformedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

// Transform API conversation to UI format
function transformConversation(conv: ApiConversation, currentUserId: string): TransformedConversation {
  const otherParticipant = conv.participants.find(p => p.userId !== currentUserId);
  const user = otherParticipant?.user;

  return {
    id: conv.id,
    otherUser: {
      id: user?.id || "",
      firstName: user?.firstName || "Unknown",
      lastName: user?.lastName || null,
      avatar: user?.profilePhotoUrl || null,
      online: false, // Would need WebSocket for real-time status
    },
    lastMessage: conv.lastMessage ? {
      content: conv.lastMessage.content,
      createdAt: conv.lastMessage.createdAt,
      read: conv.lastMessage.readReceipts?.some(r => r.userId === currentUserId) ?? false,
      senderId: conv.lastMessage.senderId,
    } : null,
    listing: conv.listing ? {
      id: conv.listing.id,
      title: conv.listing.title,
      image: conv.listing.images?.[0] || "/placeholder-listing.jpg",
    } : undefined,
    unreadCount: conv.unreadCount || conv._count?.messages || 0,
  };
}

// Transform API message to UI format
function transformMessage(msg: ApiMessage, currentUserId: string): TransformedMessage {
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    content: msg.content,
    createdAt: msg.createdAt,
    read: msg.readReceipts?.some(r => r.userId === currentUserId) ?? false,
  };
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversation");

  try {
    // Fetch conversations from real API
    const { conversations: apiConversations } = await messagingApi.getConversations({
      limit: 50,
    });

    // Get current user ID from cookie/session (fallback to empty for SSR)
    // In a real app, you'd get this from the session
    const currentUserId = ""; // Will be set client-side

    // Fetch messages if conversation is selected
    let messages: ApiMessage[] = [];
    if (conversationId) {
      try {
        const { messages: apiMessages } = await messagingApi.getMessages(conversationId, {
          limit: 100,
        });
        messages = apiMessages;
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    }

    return {
      rawConversations: apiConversations,
      rawMessages: messages,
      error: null,
    };
  } catch (error) {
    console.error("Error loading messages:", error);
    return {
      rawConversations: [],
      rawMessages: [],
      error: "Failed to load messages. Please try again.",
    };
  }
}

export default function Messages() {
  const { rawConversations, rawMessages, error } = useLoaderData<typeof clientLoader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  
  // Get current user from auth store
  const { user } = useAuthStore();
  const currentUserId = user?.id || "";
  const { socket, isConnected } = useSocket();

  // Transform data for UI
  const conversations = rawConversations.map(c => transformConversation(c, currentUserId));
  const initialMessages = rawMessages.map(m => transformMessage(m, currentUserId));

  const [selectedConversation, setSelectedConversation] = useState<string | null>(
    searchParams.get("conversation") || (conversations[0]?.id ?? null)
  );
  const [messages, setMessages] = useState<TransformedMessage[]>(initialMessages);

  // Create a separate state for conversations to handle real-time updates
  const [conversationsList, setConversationsList] = useState(conversations);

  useEffect(() => {
    setConversationsList(conversations);
  }, [rawConversations, currentUserId]); // Update when loader data changes

  // Handle new messages from WebSocket
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (message: any) => {
      console.log('New message received:', message);
      const transformedMsg = transformMessage(message, currentUserId);

      // If viewing the conversation, add the message
      if (selectedConversation && message.conversationId === selectedConversation) {
        // Prevent duplicates (especially from self if we use optimistic updates)
        if (message.senderId !== currentUserId) {
             setMessages((prev) => {
                if (prev.some(m => m.id === message.id)) return prev;
                return [...prev, transformedMsg];
             });
             // Mark as read immediately
             socket.emit('mark_read', { conversationId: message.conversationId, messageId: message.id });
        }
      }

      // Update conversation list logic
      setConversationsList((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === message.conversationId);
        let newList = [...prev];
        let updatedConv;

        if (existingIdx !== -1) {
            updatedConv = { ...prev[existingIdx] };
            newList.splice(existingIdx, 1); // remove from current pos
        } else {
            // New conversation found? We need to fetch details or construct partial
            // For now, ignore if not in list or handle partially
             return prev;
        }

        updatedConv.lastMessage = {
            content: transformedMsg.content,
            createdAt: transformedMsg.createdAt,
            // If we are sending it or viewing it, it is read? 
            read: message.senderId === currentUserId || (selectedConversation === message.conversationId),
            senderId: transformedMsg.senderId,
        };

        if (message.senderId !== currentUserId && selectedConversation !== message.conversationId) {
            updatedConv.unreadCount = (updatedConv.unreadCount || 0) + 1;
        }

        return [updatedConv, ...newList];
      });
    };

    socket.on("message.created", handleNewMessage);

    return () => {
      socket.off("message.created", handleNewMessage);
    };
  }, [socket, isConnected, selectedConversation, currentUserId]);

  // Use the state list for rendering instead of derived prop
  const visibleConversations = conversationsList;

  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentConversation = visibleConversations.find(
    (c) => c.id === selectedConversation
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch messages when conversation changes
  const fetchMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const { messages: apiMessages } = await messagingApi.getMessages(conversationId, {
        limit: 100,
      });
      setMessages(apiMessages.map(m => transformMessage(m, currentUserId)));
      
      // Mark messages as read
      await messagingApi.markAsRead(conversationId);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [currentUserId]);

  const handleSelectConversation = async (conversationId: string) => {
    setSelectedConversation(conversationId);
    setSearchParams({ conversation: conversationId });
    setShowMobileChat(true);
    await fetchMessages(conversationId);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || isSending) return;

    setIsSending(true);
    
    // Optimistic update
    const optimisticMessage: TransformedMessage = {
      id: `temp-${Date.now()}`,
      conversationId: selectedConversation,
      senderId: currentUserId,
      content: newMessage,
      createdAt: new Date().toISOString(),
      read: false,
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    const messageContent = newMessage;
    setNewMessage("");

    try {
      const sentMessage = await messagingApi.sendMessage(selectedConversation, {
        content: messageContent,
      });
      
      // Replace optimistic message with real one
      setMessages(prev => 
        prev.map(m => 
          m.id === optimisticMessage.id 
            ? transformMessage(sentMessage, currentUserId)
            : m
        )
      );
      
      // Revalidate to update conversation list
      revalidator.revalidate();
    } catch (error) {
      console.error("Failed to send message:", error);
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      setNewMessage(messageContent); // Restore the message
    } finally {
      setIsSending(false);
    }
  };

  const filteredConversations = visibleConversations.filter((conv) => {
    const name =
      `${conv.otherUser.firstName} ${conv.otherUser.lastName || ""}`.toLowerCase();
    const listingTitle = conv.listing?.title.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    return name.includes(query) || listingTitle.includes(query);
  });

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background">
        <MessageCircle className="w-16 h-16 mb-4 text-muted-foreground" />
        <p className="text-lg text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => revalidator.revalidate()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        {/* Conversations List */}
        <div
          className={cn(
            showMobileChat ? "hidden" : "flex",
            "lg:flex flex-col w-full lg:w-96 border-r bg-card"
          )}
        >
          {/* Search */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageCircle className="w-16 h-16 mb-4" />
                <p className="text-center">No conversations yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation.id)}
                    className={cn(
                      "w-full p-4 text-left hover:bg-muted transition-colors",
                      selectedConversation === conversation.id && "bg-primary/5"
                    )}
                  >
                    <div className="flex gap-3">
                      <div className="relative flex-shrink-0">
                        <img
                          src={
                            conversation.otherUser.avatar ||
                            "/default-avatar.png"
                          }
                          alt={conversation.otherUser.firstName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        {conversation.otherUser.online && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-background rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-foreground truncate">
                            {conversation.otherUser.firstName}{" "}
                            {conversation.otherUser.lastName}
                          </h3>
                          {conversation.lastMessage && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(
                                new Date(conversation.lastMessage.createdAt),
                                {
                                  addSuffix: true,
                                }
                              )}
                            </span>
                          )}
                        </div>
                        {conversation.listing && (
                          <p className="text-xs text-muted-foreground mb-1 truncate">
                            {conversation.listing.title}
                          </p>
                        )}
                        {conversation.lastMessage && (
                          <div className="flex items-center justify-between">
                            <p
                              className={cn(
                                "text-sm truncate",
                                conversation.lastMessage.read
                                  ? "text-muted-foreground"
                                  : "text-foreground font-medium"
                              )}
                            >
                              {conversation.lastMessage.content}
                            </p>
                            {conversation.unreadCount > 0 && (
                              <Badge variant="default" className="ml-2">
                                {conversation.unreadCount}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div
          className={cn(
            showMobileChat ? "flex" : "hidden",
            "lg:flex flex-col flex-1 bg-muted/30"
          )}
        >
          {selectedConversation && currentConversation ? (
            <>
              {/* Chat Header */}
              <div className="bg-card border-b px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowMobileChat(false)}
                    className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="relative">
                    <img
                      src={
                        currentConversation.otherUser.avatar ||
                        "/default-avatar.png"
                      }
                      alt={currentConversation.otherUser.firstName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    {currentConversation.otherUser.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-background rounded-full" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">
                      {currentConversation.otherUser.firstName}{" "}
                      {currentConversation.otherUser.lastName}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {currentConversation.otherUser.online
                        ? "Online"
                        : "Offline"}
                    </p>
                  </div>
                </div>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              {/* Listing Context (if available) */}
              {currentConversation.listing && (
                <div className="bg-primary/5 border-b px-4 py-3 flex items-center gap-3">
                  <img
                    src={currentConversation.listing.image}
                    alt={currentConversation.listing.title}
                    className="w-12 h-12 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Discussing:</p>
                    <p className="font-medium text-foreground truncate">
                      {currentConversation.listing.title}
                    </p>
                  </div>
                  <a
                    href={`/listings/${currentConversation.listing.id}`}
                    className="text-sm text-primary hover:text-primary/90 font-medium transition-colors"
                  >
                    View
                  </a>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOwn = message.senderId === currentUserId;
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          isOwn ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-md px-4 py-2 rounded-lg",
                            isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-foreground border"
                          )}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p
                            className={cn(
                              "text-xs mt-1",
                              isOwn
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            )}
                          >
                            {format(new Date(message.createdAt), "h:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="bg-card border-t p-4">
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-end gap-2"
                >
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                      title="Attach image"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                      title="Attach file"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                      title="Emoji"
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                  </div>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors resize-none"
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || isSending}
                    className="p-2"
                  >
                    {isSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="w-16 h-16 mb-4" />
              <p className="text-center">
                Select a conversation to start messaging
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
