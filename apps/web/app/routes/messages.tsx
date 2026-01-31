import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { useState, useEffect, useRef } from "react";
import {
  Send,
  Search,
  MoreVertical,
  Image as ImageIcon,
  Paperclip,
  Smile,
  ArrowLeft,
  MessageCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "~/lib/utils";
import { Button, Badge } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [{ title: "Messages | GharBatai Rentals" }];
};

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

interface Conversation {
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

export async function loader({ request }: LoaderFunctionArgs) {
  // TODO: Fetch conversations and messages from API
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversation");

  const mockConversations: Conversation[] = [
    {
      id: "1",
      otherUser: {
        id: "2",
        firstName: "John",
        lastName: "Doe",
        avatar: null,
        online: true,
      },
      lastMessage: {
        content: "Is this still available?",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        read: false,
        senderId: "2",
      },
      listing: {
        id: "1",
        title: "Professional DSLR Camera",
        image: "https://via.placeholder.com/100",
      },
      unreadCount: 2,
    },
    {
      id: "2",
      otherUser: {
        id: "3",
        firstName: "Jane",
        lastName: "Smith",
        avatar: null,
        online: false,
      },
      lastMessage: {
        content: "Thank you! See you tomorrow.",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        read: true,
        senderId: "3",
      },
      listing: {
        id: "2",
        title: "Mountain Bike",
        image: "https://via.placeholder.com/100",
      },
      unreadCount: 0,
    },
  ];

  const mockMessages: Message[] =
    conversationId === "1"
      ? [
          {
            id: "1",
            conversationId: "1",
            senderId: "2",
            receiverId: "current-user",
            content: "Hi! I am interested in renting your camera.",
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            read: true,
          },
          {
            id: "2",
            conversationId: "1",
            senderId: "current-user",
            receiverId: "2",
            content:
              "Hello! Yes, it is available. What dates are you looking for?",
            createdAt: new Date(Date.now() - 5400000).toISOString(),
            read: true,
          },
          {
            id: "3",
            conversationId: "1",
            senderId: "2",
            receiverId: "current-user",
            content: "Is this still available?",
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            read: false,
          },
        ]
      : [];

  return { conversations: mockConversations, messages: mockMessages };
}

export default function Messages() {
  const { conversations, messages: initialMessages } = useLoaderData<{
    conversations: Conversation[];
    messages: Message[];
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(searchParams.get("conversation") || (conversations[0]?.id ?? null));
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentConversation = conversations.find(
    (c) => c.id === selectedConversation
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversation(conversationId);
    setSearchParams({ conversation: conversationId });
    setShowMobileChat(true);
    // TODO: Fetch messages for this conversation
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    const message: Message = {
      id: Date.now().toString(),
      conversationId: selectedConversation,
      senderId: "current-user",
      receiverId: currentConversation?.otherUser.id || "",
      content: newMessage,
      createdAt: new Date().toISOString(),
      read: false,
    };

    setMessages([...messages, message]);
    setNewMessage("");

    // TODO: Send message via Socket.io or API
  };

  const filteredConversations = conversations.filter((conv) => {
    const name =
      `${conv.otherUser.firstName} ${conv.otherUser.lastName || ""}`.toLowerCase();
    const listingTitle = conv.listing?.title.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    return name.includes(query) || listingTitle.includes(query);
  });

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
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOwn = message.senderId === "current-user";
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
                    disabled={!newMessage.trim()}
                    className="p-2"
                  >
                    <Send className="w-5 h-5" />
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
