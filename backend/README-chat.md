# Chat Endpoint with OpenAI Agents SDK

This document explains the streaming chat endpoint implementation using the OpenAI Agents SDK with database persistence.

## Setup

### 1. Environment Variables

Make sure you have the `OPENAI_API_KEY` environment variable set in your `.env` file:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 2. Dependencies

The required package `openai-agents-js` is already installed. If you need to reinstall it:

```bash
npm install openai-agents-js
```

### 3. Database Setup

The chat messages are persisted in PostgreSQL using Prisma. The migration has already been applied, creating the `ChatMessage` table.

## Endpoints

### Streaming Chat Endpoint

#### POST `/api/chat`

**Authentication**: Required (uses existing `authenticateUser` middleware)

**Request Body**:
```json
{
  "message": "Hello, how can you help me?",
  "previousResponseId": "optional-response-id-for-conversation-continuity"
}
```

**Response**: Server-Sent Events (SSE) stream

**Event Types**:
- `delta`: Text chunks as they're generated
- `done`: Stream completion with optional response ID
- `error`: Error messages
- `tool_call`: Tool execution events (if tools are configured)

**Database Behavior**:
- User messages are saved to the database before streaming begins
- Assistant messages are created with empty content and updated as the stream progresses
- Final content and metadata (including response ID) are saved when streaming completes

### CRUD Endpoints for Chat Messages

All message endpoints require authentication and users can only access their own messages.

#### GET `/api/chat/messages`

Get user's chat messages with pagination.

**Query Parameters**:
- `limit` (optional): Number of messages to retrieve (1-100, default: 50)
- `offset` (optional): Number of messages to skip (default: 0)
- `message_type` (optional): Filter by message type (USER, AGENT, SYSTEM)

**Response**:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

#### GET `/api/chat/messages/:id`

Get a specific message by ID.

#### POST `/api/chat/messages`

Create a new chat message manually.

**Request Body**:
```json
{
  "content": "Message content",
  "message_type": "USER|AGENT|SYSTEM",
  "response_id": "optional",
  "parent_id": "optional-uuid",
  "metadata": {}
}
```

#### PUT `/api/chat/messages/:id`

Update a chat message (content and metadata only).

#### DELETE `/api/chat/messages/:id`

Delete a specific chat message.

#### DELETE `/api/chat/messages`

Clear all chat messages for the authenticated user.

#### GET `/api/chat/messages/:id/thread`

Get a conversation thread (message and all its replies).

## Database Schema

The `ChatMessage` model includes:

- `id`: Unique identifier
- `user_id`: Reference to the user
- `content`: Message content
- `message_type`: USER, AGENT, or SYSTEM
- `response_id`: OpenAI response ID for conversation continuity
- `parent_id`: Reference to parent message for threading
- `metadata`: JSON field for additional data
- `created_at`/`updated_at`: Timestamps

## Agent Configuration

The chat agent is configured as a "PugFocus Companion" with instructions to:
- Help users with habit tracking motivation
- Provide encouragement and tips
- Be friendly, empathetic, and constructive
- Keep responses concise but meaningful

## Frontend Integration

The chat functionality is integrated with your existing `CompanionChat` component through the `ChatContext`. The frontend automatically:
- **Loads chat history** from the database on initialization
- **Handles authentication** via cookies
- **Streams responses** in real-time
- **Updates the UI** as text arrives
- **Handles errors** gracefully
- **Clears database** when clearing chat

### Chat History Loading

When the chat component loads:
1. Fetches the last 50 messages from `/api/chat/messages`
2. Displays them in chronological order
3. Falls back to welcome message if no history exists

## Testing

1. **Start the backend server**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test the chat**:
   - Navigate to the chat interface in your app
   - Send a message like "Help me stay motivated with my habits"
   - You should see the AI response streaming in real-time
   - Refresh the page - your conversation history should persist

4. **Test CRUD operations**:
   ```bash
   # Get messages
   curl -X GET "http://localhost:3000/api/chat/messages" \
     -H "Cookie: authToken=your-token"
   
   # Clear all messages
   curl -X DELETE "http://localhost:3000/api/chat/messages" \
     -H "Cookie: authToken=your-token"
   ```

## Customization

### Adding Tools

You can add tools to the agent by modifying the `chatAgent` configuration in `src/controllers/chat.controller.ts`:

```typescript
import { FunctionTool } from 'openai-agents-js';

const habitTool = new FunctionTool({
  name: 'get_habit_progress',
  description: 'Get user habit progress',
  params_json_schema: {
    type: 'object',
    properties: {
      habitId: { type: 'string' }
    },
    required: ['habitId']
  },
  on_invoke_tool: async ({ context, input }) => {
    // Implementation here
  },
});

const chatAgent = new Agent({
  // ... existing config
  tools: [habitTool],
});
```

### Modifying Instructions

Update the agent instructions in `src/controllers/chat.controller.ts` to change the AI's behavior and personality.

## Security Considerations

- Rate limiting is applied to all `/api` routes (100 requests per 15 minutes per IP)
- Authentication is required for all chat requests
- Users can only access their own messages (enforced at database level)
- User context is passed to the agent for personalization
- Abort controllers handle client disconnections properly

## Error Handling

The implementation includes comprehensive error handling:
- Network errors are caught and displayed to users
- Server errors are logged and sanitized for production
- Stream interruptions are handled gracefully
- Client disconnections abort ongoing requests
- Database errors don't break the chat experience

## Performance Considerations

- Chat messages are indexed by user_id and created_at for efficient queries
- Pagination prevents loading too many messages at once
- Message threading is supported via parent_id relationships
- Database operations are non-blocking and don't interfere with streaming 