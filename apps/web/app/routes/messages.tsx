import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import {
  redirect,
  useLoaderData,
  useSearchParams,
  useRevalidator,
} from "react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Send,
  Search,
  Image as ImageIcon,
  ArrowLeft,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "~/lib/utils";
import { toast } from "~/lib/toast";
import { UnifiedButton, Badge, RouteErrorBoundary } from "~/components/ui";
import {
  messagingApi,
  type Conversation as ApiConversation,
  type Message as ApiMessage,
} from "~/lib/api/messaging";
import { uploadApi } from "~/lib/api/upload";
import { bookingsApi } from "~/lib/api/bookings";
import { listingsApi } from "~/lib/api/listings";
import { useAuthStore } from "~/lib/store/auth";
import { useSocket } from "~/hooks/use-socket";
import { getUser } from "~/utils/auth";
import { PortalPageLayout } from "~/components/layout";
import {
  getPortalNavSections,
  resolvePortalNavRole,
} from "~/config/navigation";
import {
  ApiErrorType,
  getActionableErrorMessage,
  parseApiError,
} from "~/lib/api-error";

export const meta: MetaFunction = () => {
  return [{ title: "Messages | GharBatai Rentals" }];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CONVERSATION_SEARCH_LENGTH = 100;

const isValidEntityId = (value: string | null | undefined): value is string =>
  Boolean(value && (UUID_PATTERN.test(value) || SAFE_ID_PATTERN.test(value)));
const safeTimeLabel = (value: unknown, pattern = "h:mm a"): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Unknown time" : format(date, pattern);
};
const safeRelativeTimeLabel = (value: unknown): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime())
    ? "Unknown time"
    : formatDistanceToNow(date, { addSuffix: true });
};
const safeLower = (value: unknown): string =>
  (typeof value === "string" ? value : "").toLowerCase();
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};

function getMessagesResponseMessage(error: unknown): string | undefined {
  return error && typeof error === "object" && "response" in error
    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
    : undefined;
}

const PRESERVED_MESSAGES_ROUTE_ERRORS = new Set([
  "You are not part of this booking conversation.",
  "Unable to resolve conversation participant.",
  "Invalid listing conversation target.",
]);

function getMessagesContextualError(
  error: unknown,
  fallbackMessage: string,
  overrides: Partial<Record<ApiErrorType, string>> = {}
): string {
  const responseMessage = getMessagesResponseMessage(error);
  if (responseMessage) {
    return responseMessage;
  }

  if (
    error instanceof Error &&
    PRESERVED_MESSAGES_ROUTE_ERRORS.has(error.message)
  ) {
    return error.message;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return overrides[ApiErrorType.OFFLINE] || fallbackMessage;
  }

  const parsed = parseApiError(error);
  if (parsed.type === ApiErrorType.UNKNOWN_ERROR) {
    return fallbackMessage;
  }

  return overrides[parsed.type] || parsed.message || fallbackMessage;
}

export function getMessagesLoadError(
  error: unknown,
  fallbackMessage = "Failed to load messages. Please try again."
): string {
  const responseMessage = getMessagesResponseMessage(error);
  if (responseMessage) {
    return responseMessage;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try loading messages again.";
  }
  return getActionableErrorMessage(error, fallbackMessage, {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try loading messages again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Loading messages timed out. Try again.",
  });
}

export function getMessagesConversationLoadError(error: unknown): string {
  return getMessagesContextualError(
    error,
    "Unable to load this conversation right now. Try again.",
    {
      [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try loading this conversation again.",
      [ApiErrorType.TIMEOUT_ERROR]: "Loading this conversation timed out. Try again.",
      [ApiErrorType.NETWORK_ERROR]: "We could not load this conversation right now. Try again in a moment.",
    }
  );
}

export function getMessagesStartConversationError(
  error: unknown,
  fallbackMessage = "Failed to start conversation. Please try again."
): string {
  const responseMessage = getMessagesResponseMessage(error);
  if (responseMessage) {
    return responseMessage;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try starting the conversation again.";
  }
  return getActionableErrorMessage(error, fallbackMessage, {
    [ApiErrorType.CONFLICT]: "This conversation already exists. Refresh and open it again.",
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try starting the conversation again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Starting the conversation timed out. Try again.",
  });
}

export function getMessagesBookingBootstrapError(error: unknown): string {
  return getMessagesContextualError(
    error,
    "Unable to open the conversation for this booking right now. Try again.",
    {
      [ApiErrorType.CONFLICT]: "This conversation already exists. Refresh and open it again.",
      [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try opening the booking conversation again.",
      [ApiErrorType.TIMEOUT_ERROR]: "Opening the booking conversation timed out. Try again.",
      [ApiErrorType.NETWORK_ERROR]: "We could not open the booking conversation right now. Try again in a moment.",
    }
  );
}

export function getMessagesListingBootstrapError(error: unknown): string {
  return getMessagesContextualError(
    error,
    "Unable to start a conversation for this listing right now. Try again.",
    {
      [ApiErrorType.CONFLICT]: "This conversation already exists. Refresh and open it again.",
      [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try starting the listing conversation again.",
      [ApiErrorType.TIMEOUT_ERROR]: "Starting the listing conversation timed out. Try again.",
      [ApiErrorType.NETWORK_ERROR]: "We could not start the listing conversation right now. Try again in a moment.",
    }
  );
}

export function getMessagesSendError(
  error: unknown,
  fallbackMessage = "Failed to send message. Please try again."
): string {
  const responseMessage = getMessagesResponseMessage(error);
  if (responseMessage) {
    return responseMessage;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try sending the message again.";
  }
  return getActionableErrorMessage(error, fallbackMessage, {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try sending the message again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Sending the message timed out. Try again.",
  });
}

export function getMessagesAttachmentError(
  error: unknown,
  fallbackMessage = "Failed to upload attachments. Please try again."
): string {
  const responseMessage = getMessagesResponseMessage(error);
  if (responseMessage) {
    return responseMessage;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try uploading attachments again.";
  }
  return getActionableErrorMessage(error, fallbackMessage, {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try uploading attachments again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Uploading attachments timed out. Try again.",
  });
}

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
  attachments?: string[];
  createdAt: string;
  read: boolean;
}

const getInitials = (firstName: string, lastName: string | null) => {
  const first = firstName?.[0] || "";
  const last = lastName?.[0] || "";
  return (first + last).toUpperCase() || "U";
};

// Transform API conversation to UI format
function transformConversation(
  conv: ApiConversation,
  currentUserId: string
): TransformedConversation {
  const otherParticipant = conv.participants.find(
    (p) => p.userId !== currentUserId
  );
  const user = otherParticipant?.user;
  const listingTitle =
    typeof conv.listing?.title === "string" && conv.listing.title.trim()
      ? conv.listing.title
      : "Listing";

  return {
    id: conv.id,
    otherUser: {
      id: user?.id || "",
      firstName: user?.firstName || "Unknown",
      lastName: user?.lastName || null,
      avatar: user?.profilePhotoUrl || null,
      online: false, // Would need WebSocket for real-time status
    },
    lastMessage: conv.lastMessage
      ? {
          content:
            conv.lastMessage.content ||
            (conv.lastMessage.attachments?.length ? "Attachment" : ""),
          createdAt: conv.lastMessage.createdAt,
          read:
            (conv.lastMessage.senderId === currentUserId ||
              conv.lastMessage.readReceipts?.some(
                (r) => r.userId === currentUserId
              )) ??
            false,
          senderId: conv.lastMessage.senderId,
        }
      : null,
    listing: conv.listing
      ? {
          id: conv.listing.id,
          title: listingTitle,
          image: conv.listing.images?.[0] || "",
        }
      : undefined,
    unreadCount: conv.unreadCount ?? conv._count?.messages ?? 0,
  };
}

// Transform API message to UI format
function transformMessage(
  msg: ApiMessage,
  currentUserId: string
): TransformedMessage {
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    content: msg.content,
    attachments: msg.attachments || [],
    createdAt: msg.createdAt,
    read: msg.readReceipts?.some((r) => r.userId === currentUserId) ?? false,
  };
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }
  const portalRole = resolvePortalNavRole(user.role);

  const url = new URL(request.url);
  const rawConversationId = url.searchParams.get("conversation");
  const conversationId = isValidEntityId(rawConversationId)
    ? rawConversationId
    : null;

  try {
    // Fetch conversations from real API
    const { conversations: apiConversations } =
      await messagingApi.getConversations({
        limit: 50,
      });
    const conversationIds = new Set(
      apiConversations.map((conversation) => conversation.id)
    );
    const selectedConversationId =
      conversationId && conversationIds.has(conversationId)
        ? conversationId
        : null;

    // Fetch messages if conversation is selected
    let messages: ApiMessage[] = [];
    if (selectedConversationId) {
      try {
        const { messages: apiMessages } = await messagingApi.getMessages(
          selectedConversationId,
          {
            limit: 100,
          }
        );
        messages = apiMessages;
        await messagingApi.markAsRead(selectedConversationId);
      } catch (error) {
        toast.error(getMessagesConversationLoadError(error));
      }
    }

    return {
      rawConversations: apiConversations,
      rawMessages: messages,
      currentUserId: user.id,
      portalRole,
      error: null,
    };
  } catch (error) {
    return {
      rawConversations: [],
      rawMessages: [],
      currentUserId: user.id,
      portalRole,
      error: getMessagesLoadError(error),
    };
  }
}

export default function Messages() {
  const { t } = useTranslation();
  const {
    rawConversations,
    rawMessages,
    currentUserId: loaderUserId,
    portalRole,
    error,
  } = useLoaderData<typeof clientLoader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const bookingIdParam = searchParams.get("booking");
  const listingIdParam = searchParams.get("listing");
  const participantIdParam = searchParams.get("participant");

  // Get current user from auth store
  const { user } = useAuthStore();
  const currentUserId = loaderUserId || user?.id || "";

  // Transform data for UI
  const conversations = rawConversations.map((c) =>
    transformConversation(c, currentUserId)
  );
  const initialMessages = rawMessages.map((m) =>
    transformMessage(m, currentUserId)
  );

  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(searchParams.get("conversation") || (conversations[0]?.id ?? null));
  const conversationParam = searchParams.get("conversation");

  // Pass selectedConversation so the socket auto-rejoins on reconnect
  const { socket, isConnected } = useSocket(selectedConversation);

  const [messages, setMessages] =
    useState<TransformedMessage[]>(initialMessages);
  const [isStartingConversation, setIsStartingConversation] = useState(false);

  // Create a separate state for conversations to handle real-time updates
  const [conversationsList, setConversationsList] = useState(conversations);

  useEffect(() => {
    setConversationsList(conversations);
  }, [rawConversations, currentUserId]); // Update when loader data changes

  useEffect(() => {
    setMessages(initialMessages);
  }, [rawMessages, currentUserId]);

  const [newMessage, setNewMessage] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const conversationExists = (id: string | null) =>
      Boolean(id && conversationsList.some((conversation) => conversation.id === id));

    if (conversationParam && conversationExists(conversationParam)) {
      if (selectedConversation !== conversationParam) {
        setSelectedConversation(conversationParam);
      }
      return;
    }

    if (selectedConversation && conversationExists(selectedConversation)) {
      return;
    }

    if (conversationsList.length > 0) {
      const fallbackConversationId = conversationsList[0].id;
      if (selectedConversation !== fallbackConversationId) {
        setSelectedConversation(fallbackConversationId);
      }
      return;
    }

    if (selectedConversation !== null) {
      setSelectedConversation(null);
    }
  }, [conversationParam, conversationsList, selectedConversation]);

  // Fetch messages when conversation changes
  const fetchMessages = useCallback(
    async (conversationId: string) => {
      setIsLoadingMessages(true);
      try {
        const { messages: apiMessages } = await messagingApi.getMessages(
          conversationId,
          {
            limit: 100,
          }
        );
        setMessages(apiMessages.map((m) => transformMessage(m, currentUserId)));

        // Mark messages as read
        await messagingApi.markAsRead(conversationId);
        setConversationsList((prev) =>
          prev.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  unreadCount: 0,
                  lastMessage: conv.lastMessage
                    ? { ...conv.lastMessage, read: true }
                    : conv.lastMessage,
                }
              : conv
          )
        );
      } catch (error) {
        toast.error(getMessagesConversationLoadError(error));
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [currentUserId]
  );

  const prevConversationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Leave previous conversation before joining new one (prevents race)
    if (
      prevConversationRef.current &&
      prevConversationRef.current !== selectedConversation
    ) {
      socket.emit("leave_conversation", {
        conversationId: prevConversationRef.current,
      });
    }
    prevConversationRef.current = selectedConversation;

    if (selectedConversation) {
      socket.emit("join_conversation", {
        conversationId: selectedConversation,
      });
    }

    const handleUserStatus = (payload: {
      userId: string;
      status: "online" | "offline";
    }) => {
      setConversationsList((prev) =>
        prev.map((conv) => {
          if (conv.otherUser.id !== payload.userId) return conv;
          return {
            ...conv,
            otherUser: {
              ...conv.otherUser,
              online: payload.status === "online",
            },
          };
        })
      );
    };

    const handleNewMessage = (message: ApiMessage) => {
      const transformedMsg = transformMessage(message, currentUserId);

      if (
        selectedConversation &&
        message.conversationId === selectedConversation
      ) {
        if (message.senderId !== currentUserId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;
            return [...prev, transformedMsg];
          });
          socket.emit("mark_read", { messageId: message.id });
        }
      }

      setConversationsList((prev) => {
        const existingIdx = prev.findIndex(
          (c) => c.id === message.conversationId
        );
        const newList = [...prev];
        let updatedConv;

        if (existingIdx !== -1) {
          updatedConv = { ...prev[existingIdx] };
          newList.splice(existingIdx, 1);
        } else {
          return prev;
        }

        updatedConv.lastMessage = {
          content:
            transformedMsg.content ||
            (transformedMsg.attachments?.length ? "Attachment" : ""),
          createdAt: transformedMsg.createdAt,
          read:
            message.senderId === currentUserId ||
            selectedConversation === message.conversationId,
          senderId: transformedMsg.senderId,
        };

        if (
          message.senderId !== currentUserId &&
          selectedConversation !== message.conversationId
        ) {
          updatedConv.unreadCount = (updatedConv.unreadCount || 0) + 1;
        }

        return [updatedConv, ...newList];
      });
    };

    socket.on("user_status", handleUserStatus);
    socket.on("new_message", handleNewMessage);

    return () => {
      socket.off("user_status", handleUserStatus);
      socket.off("new_message", handleNewMessage);
      if (selectedConversation) {
        socket.emit("leave_conversation", {
          conversationId: selectedConversation,
        });
      }
    };
  }, [socket, isConnected, selectedConversation, currentUserId]);

  // Subscribe to real-time presence for all conversation participants.
  // The server immediately replies with current online/offline for each userId,
  // and streams updates whenever their status changes.
  useEffect(() => {
    if (!socket || !isConnected) return;
    conversationsList.forEach((conv) => {
      if (conv.otherUser.id) {
        socket.emit("subscribe_presence", { userId: conv.otherUser.id });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-subscribe when socket reconnects or conversation list grows
  }, [socket, isConnected, conversationsList.length]);

  useEffect(() => {
    if (!bookingIdParam || !currentUserId || isStartingConversation) return;
    if (!isValidEntityId(bookingIdParam)) return;
    let isActive = true;

    const startConversationFromBooking = async () => {
      try {
        setIsStartingConversation(true);
        const booking = await bookingsApi.getBookingById(bookingIdParam);
        const isParticipant =
          booking.renterId === currentUserId ||
          booking.ownerId === currentUserId;
        if (!isParticipant) {
          throw new Error("You are not part of this booking conversation.");
        }
        const participantId =
          booking.renterId === currentUserId
            ? booking.ownerId
            : booking.renterId;

        if (!participantId) {
          throw new Error("Unable to resolve conversation participant.");
        }

        const conversation = await messagingApi.createConversation({
          listingId: booking.listingId,
          participantId,
        });

        if (!isActive) return;
        const detailed = await messagingApi.getConversation(conversation.id);
        setConversationsList((prev) => {
          if (prev.some((conv) => conv.id === detailed.id)) return prev;
          const transformed = transformConversation(detailed, currentUserId);
          return [transformed, ...prev];
        });
        const next = new URLSearchParams(searchParams);
        next.delete("booking");
        next.set("conversation", conversation.id);
        setSearchParams(next, { replace: true });
        setSelectedConversation(conversation.id);
        setShowMobileChat(true);
        await fetchMessages(conversation.id);
      } catch (err) {
        toast.error(getMessagesBookingBootstrapError(err));
      } finally {
        if (isActive) setIsStartingConversation(false);
      }
    };

    startConversationFromBooking();
    return () => {
      isActive = false;
    };
  }, [
    bookingIdParam,
    currentUserId,
    isStartingConversation,
    searchParams,
    setSearchParams,
    fetchMessages,
  ]);

  useEffect(() => {
    if (
      !listingIdParam ||
      !participantIdParam ||
      !currentUserId ||
      isStartingConversation
    )
      return;
    if (
      !isValidEntityId(listingIdParam) ||
      !isValidEntityId(participantIdParam) ||
      participantIdParam === currentUserId
    ) {
      return;
    }
    let isActive = true;

    const startConversationFromListing = async () => {
      try {
        setIsStartingConversation(true);
        const listing = await listingsApi.getListingById(listingIdParam);
        const canStartConversation =
          listing.ownerId === participantIdParam &&
          listing.ownerId !== currentUserId;
        if (!canStartConversation) {
          throw new Error("Invalid listing conversation target.");
        }

        const conversation = await messagingApi.createConversation({
          listingId: listingIdParam,
          participantId: participantIdParam,
        });

        if (!isActive) return;
        const detailed = await messagingApi.getConversation(conversation.id);
        setConversationsList((prev) => {
          if (prev.some((conv) => conv.id === detailed.id)) return prev;
          const transformed = transformConversation(detailed, currentUserId);
          return [transformed, ...prev];
        });
        const next = new URLSearchParams(searchParams);
        next.delete("listing");
        next.delete("participant");
        next.set("conversation", conversation.id);
        setSearchParams(next, { replace: true });
        setSelectedConversation(conversation.id);
        setShowMobileChat(true);
        await fetchMessages(conversation.id);
      } catch (err) {
        toast.error(getMessagesListingBootstrapError(err));
      } finally {
        if (isActive) setIsStartingConversation(false);
      }
    };

    startConversationFromListing();
    return () => {
      isActive = false;
    };
  }, [
    listingIdParam,
    participantIdParam,
    currentUserId,
    isStartingConversation,
    searchParams,
    setSearchParams,
    fetchMessages,
  ]);

  // Use the state list for rendering instead of derived prop
  const visibleConversations = conversationsList;

  const currentConversation = visibleConversations.find(
    (c) => c.id === selectedConversation
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (!selectedConversation) {
      if (next.has("conversation")) {
        next.delete("conversation");
        setSearchParams(next, { replace: true });
      }
      return;
    }

    if (next.get("conversation") !== selectedConversation) {
      next.set("conversation", selectedConversation);
      setSearchParams(next, { replace: true });
    }
  }, [selectedConversation, searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedConversation) return;
    if (
      messages.length > 0 &&
      messages[0].conversationId === selectedConversation
    ) {
      return;
    }
    fetchMessages(selectedConversation);
  }, [selectedConversation, messages, fetchMessages]);

  const handleSelectConversation = async (conversationId: string) => {
    setSelectedConversation(conversationId);
    const next = new URLSearchParams(searchParams);
    next.set("conversation", conversationId);
    setSearchParams(next, { replace: true });
    setShowMobileChat(true);
    await fetchMessages(conversationId);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedMessage = newMessage.slice(0, MAX_MESSAGE_LENGTH);
    if (
      (!sanitizedMessage.trim() && pendingAttachments.length === 0) ||
      !selectedConversation ||
      isSending
    )
      return;
    if (sanitizedMessage.trim().length > MAX_MESSAGE_LENGTH) {
      return;
    }
    if (pendingAttachments.length > MAX_ATTACHMENTS) {
      return;
    }

    setIsSending(true);

    // Optimistic update
    const optimisticMessage: TransformedMessage = {
      id: `temp-${Date.now()}`,
      conversationId: selectedConversation,
      senderId: currentUserId,
      content: sanitizedMessage,
      attachments: pendingAttachments,
      createdAt: new Date().toISOString(),
      read: false,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    const messageContent = sanitizedMessage;
    const messageAttachments = pendingAttachments;
    setNewMessage("");
    setPendingAttachments([]);

    try {
      if (socket && isConnected) {
        const response = await new Promise<ApiMessage>((resolve, reject) => {
          socket.emit(
            "send_message",
            {
              conversationId: selectedConversation,
              content: messageContent,
              attachments: messageAttachments,
            },
            (ack: {
              success: boolean;
              message?: ApiMessage;
              error?: string;
            }) => {
              if (ack?.success && ack.message) {
                resolve(ack.message);
              } else {
                reject(new Error(ack?.error || "Failed to send message"));
              }
            }
          );
        });

        const transformedSent = transformMessage(response, currentUserId);
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMessage.id ? transformedSent : m))
        );

        setConversationsList((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversation
              ? {
                  ...conv,
                  lastMessage: {
                    content:
                      transformedSent.content ||
                      (transformedSent.attachments?.length ? "Attachment" : ""),
                    createdAt: transformedSent.createdAt,
                    read: true,
                    senderId: transformedSent.senderId,
                  },
                }
              : conv
          )
        );
      } else {
        const sentMessage = await messagingApi.sendMessage(
          selectedConversation,
          {
            content: messageContent,
            attachments: messageAttachments,
          }
        );

        const transformedSent = transformMessage(sentMessage, currentUserId);
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMessage.id ? transformedSent : m))
        );

        setConversationsList((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversation
              ? {
                  ...conv,
                  lastMessage: {
                    content:
                      transformedSent.content ||
                      (transformedSent.attachments?.length ? "Attachment" : ""),
                    createdAt: transformedSent.createdAt,
                    read: true,
                    senderId: transformedSent.senderId,
                  },
                }
              : conv
          )
        );
      }
    } catch (error) {
      toast.error(getMessagesSendError(error));
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      setNewMessage(messageContent); // Restore the message
      setPendingAttachments(messageAttachments);
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachmentUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selectedFiles = Array.from(files);
    const acceptedFiles = selectedFiles.filter((file) =>
      file.type.startsWith("image/")
    );
    if (acceptedFiles.length + pendingAttachments.length > MAX_ATTACHMENTS) {
      return;
    }
    if (acceptedFiles.some((file) => file.size > MAX_ATTACHMENT_FILE_SIZE)) {
      return;
    }
    if (acceptedFiles.length === 0) return;
    setIsUploading(true);
    try {
      const uploaded = await uploadApi.uploadImages(acceptedFiles);
      const urls = uploaded.map((file) => file.url);
      setPendingAttachments((prev) =>
        [...prev, ...urls].slice(0, MAX_ATTACHMENTS)
      );
    } catch (error) {
      toast.error(getMessagesAttachmentError(error));
    } finally {
      setIsUploading(false);
    }
  };

  const filteredConversations = visibleConversations.filter((conv) => {
    const name = safeLower(
      `${conv.otherUser.firstName} ${conv.otherUser.lastName || ""}`
    );
    const listingTitle = safeLower(conv.listing?.title);
    const query = safeLower(searchQuery);
    return name.includes(query) || listingTitle.includes(query);
  });

  return (
    <PortalPageLayout
      title={
        portalRole === "owner"
          ? t("messages.ownerInbox", "Owner Inbox")
          : t("messages.title", "Messages")
      }
      description={
        portalRole === "owner"
          ? "Coordinate with renters, answer questions, and keep bookings moving."
          : "Chat with owners and keep your bookings on track."
      }
      sidebarSections={getPortalNavSections(portalRole)}
      banner={
        error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : !isConnected ? (
          // G3 fix: Surface WebSocket disconnect as a prominent banner so users know
          // messages may not arrive in real-time and can take action.
          <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-warning animate-pulse" />
            <span>
              <strong>Offline —</strong> real-time messaging is unavailable. Messages you send will
              be delivered, but you won&apos;t receive new ones until reconnected.
            </span>
            <UnifiedButton
              variant="ghost"
              className="ml-auto h-auto flex-shrink-0 p-0 underline font-medium hover:no-underline"
              onClick={() => revalidator.revalidate()}
            >
              Reconnect
            </UnifiedButton>
          </div>
        ) : null
      }
      actions={
        isConnected ? (
          <Badge variant="success">
            {t("messages.connected", "Live")}
          </Badge>
        ) : null
      }
      containerSize="large"
      containerClassName="py-6"
      contentClassName="min-h-[calc(100vh-15rem)]"
    >
      {error ? (
        <div className="flex min-h-[calc(100vh-15rem)] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/60 px-6 text-center">
          <MessageCircle className="mb-4 h-16 w-16 text-muted-foreground" />
          <p className="mb-4 text-lg text-muted-foreground">{error}</p>
          <UnifiedButton onClick={() => revalidator.revalidate()}>
            {t("messages.retry")}
          </UnifiedButton>
        </div>
      ) : (
        <div className="flex min-h-[calc(100vh-15rem)] overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
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
                  onChange={(e) =>
                    setSearchQuery(
                      e.target.value.slice(0, MAX_CONVERSATION_SEARCH_LENGTH)
                    )
                  }
                  placeholder={t("messages.searchConversations")}
                  aria-label={t("messages.searchConversations")}
                  data-testid="conversation-search"
                  className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                />
              </div>
            </div>

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto" data-testid="conversation-list">
              {filteredConversations.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center h-full text-muted-foreground"
                  data-testid="conversation-empty-state"
                >
                  <MessageCircle className="w-16 h-16 mb-4" />
                  <p className="text-center">{t("messages.noConversations")}</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation.id)}
                      data-testid="conversation-item"
                      className={cn(
                        "w-full p-4 text-left hover:bg-muted transition-colors",
                        selectedConversation === conversation.id &&
                          "bg-primary/5"
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="relative flex-shrink-0">
                          {conversation.otherUser.avatar ? (
                            <img
                              src={conversation.otherUser.avatar}
                              alt={conversation.otherUser.firstName}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground">
                              {getInitials(
                                conversation.otherUser.firstName,
                                conversation.otherUser.lastName
                              )}
                            </div>
                          )}
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
                                {safeRelativeTimeLabel(
                                  conversation.lastMessage.createdAt
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
                      {currentConversation.otherUser.avatar ? (
                        <img
                          src={currentConversation.otherUser.avatar}
                          alt={currentConversation.otherUser.firstName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground">
                          {getInitials(
                            currentConversation.otherUser.firstName,
                            currentConversation.otherUser.lastName
                          )}
                        </div>
                      )}
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
                          ? t("messages.online")
                          : t("messages.offline")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Listing Context (if available) */}
                {currentConversation.listing && (
                  <div className="bg-primary/5 border-b px-4 py-3 flex items-center gap-3">
                    {(() => {
                      const listingId = safeText(
                        currentConversation.listing?.id
                      );
                      const listingTitle = safeText(
                        currentConversation.listing?.title,
                        "Listing"
                      );
                      return (
                        <>
                          {currentConversation.listing.image ? (
                            <img
                              src={currentConversation.listing.image}
                              alt={listingTitle}
                              className="w-12 h-12 rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-sm font-semibold text-foreground">
                              {listingTitle[0] || "L"}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-muted-foreground">
                              {t("messages.discussing")}
                            </p>
                            <p className="font-medium text-foreground truncate">
                              {listingTitle}
                            </p>
                          </div>
                          <a
                            href={
                              listingId ? `/listings/${listingId}` : "/listings"
                            }
                            className="text-sm text-primary hover:text-primary/90 font-medium transition-colors"
                          >
                            {t("messages.viewListing")}
                          </a>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div
                      className="flex flex-col items-center justify-center h-full text-muted-foreground"
                      data-testid="message-empty-state"
                    >
                      <p>{t("messages.startConversation")}</p>
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
                            {message.content ? (
                              <p className="text-sm">{message.content}</p>
                            ) : null}
                            {message.attachments &&
                              message.attachments.length > 0 && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  {message.attachments.map((url) => (
                                    <a
                                      key={url}
                                      href={url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <img
                                        src={url}
                                        alt="Attachment"
                                        className="w-full h-24 object-cover rounded"
                                      />
                                    </a>
                                  ))}
                                </div>
                              )}
                            <p
                              className={cn(
                                "text-xs mt-1",
                                isOwn
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground"
                              )}
                            >
                              {safeTimeLabel(message.createdAt)}
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
                      <label
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                        data-testid="message-attachment-button"
                      >
                        <ImageIcon className="w-5 h-5" />
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            handleAttachmentUpload(e.target.files)
                          }
                        />
                      </label>
                    </div>
                    {pendingAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {pendingAttachments.map((url) => (
                          <div key={url} className="relative">
                            <img
                              src={url}
                              alt="Attachment"
                              className="w-12 h-12 rounded object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setPendingAttachments((prev) =>
                                  prev.filter((item) => item !== url)
                                )
                              }
                              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea
                      value={newMessage}
                      onChange={(e) =>
                        setNewMessage(
                          e.target.value.slice(0, MAX_MESSAGE_LENGTH)
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder={t("messages.typeMessage")}
                      rows={1}
                      maxLength={MAX_MESSAGE_LENGTH}
                      data-testid="message-composer"
                      className="flex-1 px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors resize-none"
                    />
                    <UnifiedButton
                      type="submit"
                      disabled={
                        (!newMessage.trim() &&
                          pendingAttachments.length === 0) ||
                        isSending ||
                        isUploading
                      }
                      loading={isSending || isUploading}
                      className="p-2"
                    >
                      {!isSending && <Send className="w-5 h-5" />}
                    </UnifiedButton>
                  </form>
                </div>
              </>
            ) : (
              <div
                className="flex flex-col items-center justify-center h-full text-muted-foreground"
                data-testid="message-empty-prompt"
              >
                <MessageCircle className="w-16 h-16 mb-4" />
                <p className="text-center">
                  {t("messages.selectConversation")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </PortalPageLayout>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
