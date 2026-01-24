import type { MetaFunction, LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useSearchParams } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Search,
  MoreVertical,
  Image as ImageIcon,
  Paperclip,
  Smile,
  ArrowLeft,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export const meta: MetaFunction = () => {
  return [{ title: 'Messages | GharBatai Rentals' }];
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
  const conversationId = url.searchParams.get('conversation');

  const mockConversations: Conversation[] = [
    {
      id: '1',
      otherUser: {
        id: '2',
        firstName: 'John',
        lastName: 'Doe',
        avatar: null,
        online: true,
      },
      lastMessage: {
        content: 'Is this still available?',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        read: false,
        senderId: '2',
      },
      listing: {
        id: '1',
        title: 'Professional DSLR Camera',
        image: 'https://via.placeholder.com/100',
      },
      unreadCount: 2,
    },
    {
      id: '2',
      otherUser: {
        id: '3',
        firstName: 'Jane',
        lastName: 'Smith',
        avatar: null,
        online: false,
      },
      lastMessage: {
        content: 'Thank you! See you tomorrow.',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        read: true,
        senderId: '3',
      },
      listing: {
        id: '2',
        title: 'Mountain Bike',
        image: 'https://via.placeholder.com/100',
      },
      unreadCount: 0,
    },
  ];

  const mockMessages: Message[] =
    conversationId === '1'
      ? [
          {
            id: '1',
            conversationId: '1',
            senderId: '2',
            receiverId: 'current-user',
            content: 'Hi! I am interested in renting your camera.',
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            read: true,
          },
          {
            id: '2',
            conversationId: '1',
            senderId: 'current-user',
            receiverId: '2',
            content: 'Hello! Yes, it is available. What dates are you looking for?',
            createdAt: new Date(Date.now() - 5400000).toISOString(),
            read: true,
          },
          {
            id: '3',
            conversationId: '1',
            senderId: '2',
            receiverId: 'current-user',
            content: 'Is this still available?',
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
  const [selectedConversation, setSelectedConversation] = useState<string | null>(
    searchParams.get('conversation') || (conversations[0]?.id ?? null)
  );
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentConversation = conversations.find((c) => c.id === selectedConversation);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      senderId: 'current-user',
      receiverId: currentConversation?.otherUser.id || '',
      content: newMessage,
      createdAt: new Date().toISOString(),
      read: false,
    };

    setMessages([...messages, message]);
    setNewMessage('');

    // TODO: Send message via Socket.io or API
  };

  const filteredConversations = conversations.filter((conv) => {
    const name = `${conv.otherUser.firstName} ${conv.otherUser.lastName || ''}`.toLowerCase();
    const listingTitle = conv.listing?.title.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return name.includes(query) || listingTitle.includes(query);
  });

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="bg-white border-b px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        {/* Conversations List */}
        <div
          className={`${
            showMobileChat ? 'hidden' : 'flex'
          } lg:flex flex-col w-full lg:w-96 border-r bg-white`}
        >
          {/* Search */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <MessageCircle className="w-16 h-16 mb-4" />
                <p className="text-center">No conversations yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation.id)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedConversation === conversation.id ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="relative flex-shrink-0">
                        <img
                          src={conversation.otherUser.avatar || '/default-avatar.png'}
                          alt={conversation.otherUser.firstName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        {conversation.otherUser.online && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {conversation.otherUser.firstName} {conversation.otherUser.lastName}
                          </h3>
                          {conversation.lastMessage && (
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          )}
                        </div>
                        {conversation.listing && (
                          <p className="text-xs text-gray-500 mb-1 truncate">
                            {conversation.listing.title}
                          </p>
                        )}
                        {conversation.lastMessage && (
                          <div className="flex items-center justify-between">
                            <p
                              className={`text-sm truncate ${
                                conversation.lastMessage.read
                                  ? 'text-gray-500'
                                  : 'text-gray-900 font-medium'
                              }`}
                            >
                              {conversation.lastMessage.content}
                            </p>
                            {conversation.unreadCount > 0 && (
                              <span className="ml-2 bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                                {conversation.unreadCount}
                              </span>
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
          className={`${
            showMobileChat ? 'flex' : 'hidden'
          } lg:flex flex-col flex-1 bg-gray-50`}
        >
          {selectedConversation && currentConversation ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowMobileChat(false)}
                    className="lg:hidden text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="relative">
                    <img
                      src={currentConversation.otherUser.avatar || '/default-avatar.png'}
                      alt={currentConversation.otherUser.firstName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    {currentConversation.otherUser.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {currentConversation.otherUser.firstName}{' '}
                      {currentConversation.otherUser.lastName}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {currentConversation.otherUser.online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
                <button className="text-gray-600 hover:text-gray-900">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              {/* Listing Context (if available) */}
              {currentConversation.listing && (
                <div className="bg-blue-50 border-b px-4 py-3 flex items-center gap-3">
                  <img
                    src={currentConversation.listing.image}
                    alt={currentConversation.listing.title}
                    className="w-12 h-12 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-600">Discussing:</p>
                    <p className="font-medium text-gray-900 truncate">
                      {currentConversation.listing.title}
                    </p>
                  </div>
                  <a
                    href={`/listings/${currentConversation.listing.id}`}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    View
                  </a>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOwn = message.senderId === 'current-user';
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-md px-4 py-2 rounded-lg ${
                            isOwn
                              ? 'bg-primary-600 text-white'
                              : 'bg-white text-gray-900 border'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p
                            className={`text-xs mt-1 ${isOwn ? 'text-primary-100' : 'text-gray-500'}`}
                          >
                            {format(new Date(message.createdAt), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="bg-white border-t p-4">
                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                      title="Attach image"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                      title="Attach file"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                      title="Emoji"
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                  </div>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageCircle className="w-16 h-16 mb-4" />
              <p className="text-center">Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Import MessageCircle icon that was missing
import { MessageCircle } from 'lucide-react';
