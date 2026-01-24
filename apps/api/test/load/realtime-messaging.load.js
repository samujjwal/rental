import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import http from 'k6/http';

// Custom metrics
const errorRate = new Rate('errors');
const connectionTime = new Trend('connection_time');
const messageLatency = new Trend('message_latency');
const messagesReceived = new Counter('messages_received');
const messagesSent = new Counter('messages_sent');

// Test configuration - sustained WebSocket connections
export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 concurrent connections
    { duration: '1m', target: 50 }, // Ramp up to 50 connections
    { duration: '3m', target: 100 }, // Peak: 100 concurrent connections
    { duration: '1m', target: 50 }, // Ramp down
    { duration: '30s', target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    ws_connecting: ['p(95)<500'], // Connection time < 500ms
    ws_session_duration: ['p(95)<300000'], // Session duration
    errors: ['rate<0.05'], // Error rate < 5%
    message_latency: ['p(95)<200', 'p(99)<500'], // Message delivery < 200ms p95
    connection_time: ['p(95)<400'],
  },
  ext: {
    loadimpact: {
      name: 'Real-time Messaging Load Test',
      projectID: 3596745,
    },
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';
const API_VERSION = 'v1';
const API_BASE = `${BASE_URL}/api/${API_VERSION}`;

/**
 * Setup function - creates test users
 */
export function setup() {
  console.log('Setting up messaging test users...');

  const users = [];

  // Create multiple test users for messaging
  for (let i = 0; i < 10; i++) {
    const userSignup = http.post(
      `${API_BASE}/auth/signup`,
      JSON.stringify({
        email: `msg_user_${i}_${Date.now()}@loadtest.com`,
        password: 'LoadTest123!@#',
        name: `Message User ${i}`,
        role: i % 2 === 0 ? 'owner' : 'renter',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (userSignup.status === 201) {
      const userData = JSON.parse(userSignup.body);
      users.push({
        id: userData.user.id,
        token: userData.accessToken,
        name: userData.user.name,
      });
    }
  }

  // Create some conversations
  const conversations = [];
  for (let i = 0; i < users.length - 1; i += 2) {
    const convRes = http.post(
      `${API_BASE}/conversations`,
      JSON.stringify({
        participantId: users[i + 1].id,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${users[i].token}`,
        },
      },
    );

    if (convRes.status === 201) {
      const convData = JSON.parse(convRes.body);
      conversations.push({
        id: convData.id,
        user1: users[i],
        user2: users[i + 1],
      });
    }
  }

  console.log(
    `Setup complete. Created ${users.length} users and ${conversations.length} conversations.`,
  );

  return {
    users,
    conversations,
  };
}

/**
 * Main VU code - WebSocket connection simulation
 */
export default function (data) {
  const { users, conversations } = data;

  if (users.length === 0 || conversations.length === 0) {
    console.error('No users or conversations available for testing');
    return;
  }

  // Select a random conversation
  const conversation = conversations[Math.floor(Math.random() * conversations.length)];
  const user = Math.random() > 0.5 ? conversation.user1 : conversation.user2;
  const otherUser = user === conversation.user1 ? conversation.user2 : conversation.user1;

  const url = `${WS_URL}?token=${user.token}`;
  let messagesSentCount = 0;
  let messagesReceivedCount = 0;
  let connectionStartTime;

  const res = ws.connect(
    url,
    { headers: { Authorization: `Bearer ${user.token}` } },
    function (socket) {
      connectionStartTime = new Date();

      socket.on('open', () => {
        const connTime = new Date() - connectionStartTime;
        connectionTime.add(connTime);

        console.log(`[${user.name}] Connected to WebSocket`);

        // Join the conversation room
        socket.send(
          JSON.stringify({
            event: 'join_conversation',
            data: {
              conversationId: conversation.id,
            },
          }),
        );

        // Send typing indicator
        socket.send(
          JSON.stringify({
            event: 'user_typing',
            data: {
              conversationId: conversation.id,
            },
          }),
        );

        // Send a message every 3-5 seconds
        const sendInterval = setInterval(
          () => {
            const messageStartTime = new Date();
            const messageText = `Load test message from ${user.name} at ${new Date().toISOString()}`;

            socket.send(
              JSON.stringify({
                event: 'send_message',
                data: {
                  conversationId: conversation.id,
                  content: messageText,
                },
              }),
            );

            messagesSentCount++;
            messagesSent.add(1);

            // Stop typing after sending
            socket.setTimeout(() => {
              socket.send(
                JSON.stringify({
                  event: 'user_stopped_typing',
                  data: {
                    conversationId: conversation.id,
                  },
                }),
              );
            }, 500);

            // Stop after 30 seconds or 10 messages
            if (messagesSentCount >= 10 || new Date() - connectionStartTime > 30000) {
              clearInterval(sendInterval);
              socket.close();
            }
          },
          Math.random() * 2000 + 3000,
        ); // 3-5 seconds
      });

      socket.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          messagesReceivedCount++;
          messagesReceived.add(1);

          check(message, {
            'message has event type': (m) => m.event !== undefined,
            'message has data': (m) => m.data !== undefined,
          }) || errorRate.add(1);

          // Track message latency for new_message events
          if (message.event === 'new_message') {
            const messageTime = new Date(message.data.createdAt);
            const latency = new Date() - messageTime;
            messageLatency.add(latency);

            console.log(
              `[${user.name}] Received message: ${message.data.content.substring(0, 50)}... (latency: ${latency}ms)`,
            );
          }

          // Handle typing indicators
          if (message.event === 'user_typing') {
            console.log(`[${user.name}] ${message.data.userName} is typing...`);
          }

          // Handle unread count
          if (message.event === 'unread_count') {
            console.log(`[${user.name}] Unread count: ${message.data.count}`);
          }
        } catch (e) {
          console.error(`[${user.name}] Error parsing message:`, e);
          errorRate.add(1);
        }
      });

      socket.on('close', () => {
        console.log(
          `[${user.name}] Disconnected. Sent: ${messagesSentCount}, Received: ${messagesReceivedCount}`,
        );
      });

      socket.on('error', (e) => {
        console.error(`[${user.name}] WebSocket error:`, e);
        errorRate.add(1);
      });

      // Keep connection alive for 30-60 seconds
      socket.setTimeout(
        () => {
          console.log(`[${user.name}] Closing connection after timeout`);
          socket.close();
        },
        Math.random() * 30000 + 30000,
      );
    },
  );

  check(res, {
    'WebSocket connection successful': (r) => r && r.status === 101,
  }) || errorRate.add(1);

  sleep(1);
}

/**
 * Teardown function
 */
export function teardown(data) {
  console.log('Messaging load test completed.');
}
