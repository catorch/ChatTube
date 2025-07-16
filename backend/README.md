# ChatTube Backend - YouTube RAG Chatbot

A Node.js/Express backend for an AI chatbot that provides Retrieval Augmented Generation (RAG) capabilities for YouTube videos using MongoDB Atlas Vector Search.

## Features

- **YouTube Video Processing**: Extract metadata and transcripts from YouTube videos
- **Vector Embeddings**: Generate embeddings for video content chunks using OpenAI
- **MongoDB Vector Search**: High-performance semantic search using MongoDB Atlas Vector Search
- **RAG Chat**: AI-powered chat with context from processed YouTube videos
- **User Authentication**: JWT-based authentication system
- **MongoDB Storage**: Store videos, chunks, chats, and messages

## Prerequisites

- Node.js 18+
- **MongoDB Atlas** (for vector search capabilities)
- OpenAI API key

## Installation

1. Clone the repository and navigate to the backend directory:

```bash
cd ChatTube/backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with the following variables:

```env
# Database Configuration (MongoDB Atlas required for vector search)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chattube?retryWrites=true&w=majority

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Server Configuration
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3000
```

4. **Set up MongoDB Atlas Vector Search Index** (Required):

   - Create a database named `chattube`
   - Create the `videochunks` collection
   - Create a vector search index with these settings:

   ```json
   {
     "name": "vector_index",
     "type": "vectorSearch",
     "definition": {
       "fields": [
         {
           "type": "vector",
           "path": "embedding",
           "numDimensions": 1536,
           "similarity": "cosine"
         }
       ]
     }
   }
   ```

5. Start the development server:

```bash
npm run dev
```

## MongoDB Atlas Vector Search Setup

### Step-by-Step Setup:

1. **Create MongoDB Atlas Account**: Visit [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create an account

2. **Create Cluster**: Set up a new cluster (M0 free tier supports vector search)

3. **Database Setup**:

   - Database name: `chattube`
   - Collections: `users`, `videos`, `videochunks`, `chats`, `messages`

4. **Vector Search Index Creation**:

   - Navigate to your cluster → Browse Collections → `videochunks` collection
   - Go to "Search Indexes" tab → "Create Index" → "Atlas Vector Search"
   - Use the following configuration:

   ```json
   {
     "name": "vector_index",
     "type": "vectorSearch",
     "definition": {
       "fields": [
         {
           "type": "vector",
           "path": "embedding",
           "numDimensions": 1536,
           "similarity": "cosine"
         }
       ]
     }
   }
   ```

5. **Wait for Index**: Vector search index creation can take several minutes

### Alternative: Atlas CLI Setup

```bash
# Install Atlas CLI
brew install mongodb-atlas-cli

# Login
atlas auth login

# Create vector search index
atlas clusters search indexes create \
  --clusterName <your-cluster-name> \
  --file vector-index.json
```

Where `vector-index.json` contains:

```json
{
  "name": "vector_index",
  "type": "vectorSearch",
  "database": "chattube",
  "collection": "videochunks",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 1536,
        "similarity": "cosine"
      }
    ]
  }
}
```

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/check` - Check authentication status

### Videos

- `POST /api/videos/process` - Process a YouTube video (extract metadata and transcript)
- `GET /api/videos` - Get all processed videos (with pagination)
- `GET /api/videos/:videoId` - Get specific video details
- `POST /api/videos/search` - Search video chunks using vector search

### Chats

- `POST /api/chats` - Create a new chat session
- `GET /api/chats` - Get user's chat sessions
- `GET /api/chats/:chatId/messages` - Get messages for a chat
- `POST /api/chats/:chatId/messages` - Send message and get AI response
- `DELETE /api/chats/:chatId` - Delete a chat session

### Health Check

- `GET /api/health` - API health status

## Data Models

### User

- Email, password (hashed)
- First name, last name (optional)
- Timestamps

### Video

- YouTube video ID, title, description
- Channel information, duration, view count
- Processing status and metadata
- Timestamps

### VideoChunk

- Reference to video, chunk index
- Start/end timestamps, text content
- **Vector embedding (1536 dimensions)** for MongoDB Vector Search
- Token count

### Chat

- User reference, title
- Associated video references
- Activity tracking, timestamps

### Message

- Chat reference, role (user/assistant/system)
- Content, metadata (video references, token count, relevance scores)
- Timestamps

## Video Processing Flow

1. User submits YouTube URL
2. Extract video metadata using `ytdl-core`
3. Fetch transcript using `youtube-transcript`
4. Chunk transcript into manageable pieces (~500 words)
5. Generate embeddings for each chunk using OpenAI ada-002
6. Store video, chunks, and embeddings in MongoDB
7. **Vector search index automatically indexes embeddings**

## RAG Chat Flow

1. User sends message in chat
2. Generate embedding for user query using OpenAI
3. **Execute MongoDB Vector Search** with `$vectorSearch` aggregation:
   - Query against `vector_index`
   - Returns top-k most relevant chunks with similarity scores
   - Includes video metadata via lookup
4. Construct enhanced prompt with relevant context
5. Generate AI response using OpenAI GPT-4
6. Store messages with relevance scores and return response

## Vector Search Architecture

```
User Query → OpenAI Embeddings → MongoDB $vectorSearch → Relevant Chunks → GPT-4 → Response
```

### Vector Search Pipeline Example:

```javascript
const pipeline = [
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 50,
      limit: 3,
    },
  },
  {
    $addFields: {
      score: { $meta: "vectorSearchScore" },
    },
  },
  {
    $lookup: {
      from: "videos",
      localField: "videoId",
      foreignField: "_id",
      as: "video",
    },
  },
];
```

## Development

### Project Structure

```
src/
├── controllers/     # Request handlers
├── models/         # MongoDB schemas
├── routes/         # API route definitions
├── middlewares/    # Authentication, validation
├── db/            # Database connection
└── types/         # TypeScript definitions
```

### Key Dependencies

- Express.js - Web framework
- Mongoose - MongoDB ODM
- OpenAI - AI model integration
- ytdl-core - YouTube video metadata
- youtube-transcript - Transcript extraction
- JWT - Authentication tokens
- bcrypt - Password hashing

## Environment Variables

| Variable       | Description                            | Required |
| -------------- | -------------------------------------- | -------- |
| MONGODB_URI    | MongoDB Atlas connection string        | Yes      |
| JWT_SECRET     | Secret for JWT token signing           | Yes      |
| OPENAI_API_KEY | OpenAI API key for embeddings and chat | Yes      |
| NODE_ENV       | Environment (development/production)   | No       |
| PORT           | Server port (default: 3000)            | No       |
| FRONTEND_URL   | Frontend URL for CORS                  | No       |

## Performance Considerations

### Vector Search Optimization

- **Index Configuration**: Uses cosine similarity for semantic relevance
- **Candidate Selection**: `numCandidates` parameter controls search quality vs speed
- **Chunk Size**: 500-word chunks balance context and search granularity
- **Embedding Dimensions**: 1536 dimensions (OpenAI ada-002 standard)

### Scaling

- MongoDB Atlas automatically scales vector search
- Consider connection pooling for high traffic
- Implement caching for frequently accessed videos
- Use background processing for video ingestion

## Troubleshooting

### Vector Search Issues

1. **Index Creation Failed**: Ensure MongoDB Atlas cluster supports vector search
2. **Search Returns No Results**: Verify index is active and properly configured
3. **Slow Search Performance**: Adjust `numCandidates` parameter
4. **Embedding Dimension Errors**: Ensure all embeddings are exactly 1536 dimensions

### Common Issues

- **Authentication Errors**: Check JWT_SECRET configuration
- **Video Processing Fails**: Verify YouTube video is publicly accessible
- **OpenAI API Errors**: Check API key and quota limits
- **Database Connection**: Ensure MongoDB Atlas IP whitelist includes your server

## Notes

- **MongoDB Atlas Required**: Vector search requires MongoDB Atlas (not local MongoDB)
- Vector search provides superior performance compared to basic similarity calculations
- Transcript processing is asynchronous to avoid blocking the API
- Rate limiting implemented to prevent abuse
- All chat routes require authentication
- Relevance scores are included in AI responses for transparency
