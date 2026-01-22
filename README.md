# 🎬 ChatTube

**AI-powered conversational interface for video, web, and document content.**

ChatTube is a modern, full-stack application that allows you to chat with various content sources using advanced AI models. Simply add a YouTube video, paste a URL, or upload a document, and start having intelligent conversations with your content.

![ChatTube Demo](https://img.shields.io/badge/status-active-success.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8.0.0-orange)
![License](https://img.shields.io/badge/license-ISC-blue)

---

## ✨ Features

### 📹 Multi-Source Content Support
- **YouTube Videos** - Extract transcripts and metadata from any YouTube video
- **Web Pages** - Parse and process content from web articles and pages
- **PDF Documents** - Upload and analyze PDF files
- **File Uploads** - Support for various document types (up to 300MB)

### 🤖 AI-Powered Chat
- **Multi-Model Support** - Choose from leading AI providers:
  - **OpenAI** (GPT models)
  - **Anthropic** (Claude models)
  - **Google** (Gemini models)
- **Contextual Conversations** - AI understands your content and provides relevant answers
- **Auto-Summarization** - Automatically generates titles and summaries for your chats
- **Chunk-Based Processing** - Intelligent content splitting for optimal context handling

### 💾 Smart Content Processing
- **Background Worker Queue** - Asynchronous processing for large content
- **Content Chunking** - Text is intelligently split with embeddings for semantic search
- **Progress Tracking** - Real-time processing status updates
- **Error Recovery** - Robust error handling and retry mechanisms

### 🎨 Modern User Interface
- **Beautiful Design** - Clean, modern UI built with Next.js 15 and Tailwind CSS 4
- **Dark Mode** - Full dark mode support with `next-themes`
- **Responsive Layout** - Works seamlessly on desktop and mobile devices
- **Framer Motion Animations** - Smooth, delightful user interactions
- **Radix UI Components** - Accessible, high-quality UI primitives

### 🔐 Security & Authentication
- **JWT Authentication** - Secure token-based authentication
- **Google OAuth** - Sign in with Google integration
- **Rate Limiting** - API rate limiting to prevent abuse
- **CORS Protection** - Configurable cross-origin resource sharing

---

## 🏗️ Architecture

ChatTube uses a **monorepo structure** with two main packages:

```
chattube/
├── frontend/          # Next.js 15 application
│   ├── app/           # App router pages
│   ├── components/    # React components
│   │   ├── auth/      # Authentication components
│   │   ├── layout/    # Layout components (chat panel, sources panel)
│   │   ├── modals/    # Modal dialogs
│   │   ├── providers/ # React context providers
│   │   └── ui/        # Reusable UI components
│   └── lib/           # Utility functions and hooks
│
├── backend/           # Express.js API server
│   └── src/
│       ├── config/        # Configuration management
│       ├── controllers/   # Route controllers
│       ├── db/            # Database connection (MongoDB)
│       ├── ingestion/     # Content processing pipeline
│       │   └── processors/  # Source-specific processors
│       ├── middlewares/   # Express middlewares
│       ├── models/        # Mongoose models
│       ├── prompts/       # AI prompt templates
│       ├── routes/        # API routes
│       ├── services/      # Business logic services
│       │   └── llm/       # LLM provider clients
│       ├── utils/         # Utility functions
│       └── workers/       # Background job workers
│
├── package.json       # Root workspace configuration
└── pnpm-workspace.yaml
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **MongoDB** (local or Atlas)
- **FFmpeg** (for audio processing)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/chattube.git
   cd chattube
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   Create `.env` files in both `frontend/` and `backend/` directories:

   **backend/.env**
   ```env
   # Server
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/chattube
   
   # Authentication
   JWT_SECRET=your-super-secret-jwt-key
   GOOGLE_CLIENT_ID=your-google-client-id
   
   # AI Providers (add the ones you want to use)
   OPENAI_API_KEY=your-openai-api-key
   ANTHROPIC_API_KEY=your-anthropic-api-key
   GEMINI_API_KEY=your-gemini-api-key
   ```

   **frontend/.env**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
   ```

4. **Start the development servers**
   ```bash
   # Start both frontend and backend
   pnpm dev
   
   # Or start individually
   pnpm dev:frontend   # Next.js on http://localhost:3000
   pnpm dev:backend    # Express on http://localhost:3001
   ```

5. **Start the background worker** (in a separate terminal)
   ```bash
   pnpm worker:dev
   ```

---

## 📝 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start both frontend and backend in development mode |
| `pnpm dev:frontend` | Start only the frontend (Next.js) |
| `pnpm dev:backend` | Start only the backend (Express) |
| `pnpm build` | Build both packages for production |
| `pnpm start` | Start both packages in production mode |
| `pnpm lint` | Run linting across all packages |
| `pnpm worker` | Start the ingestion worker (production) |
| `pnpm worker:dev` | Start the ingestion worker (development) |
| `pnpm worker:status` | Check worker status |
| `pnpm worker:cleanup` | Clean up stale jobs |

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login with email/password |
| `POST` | `/api/auth/google` | Login with Google OAuth |

### Chats
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chats` | Get all user chats |
| `POST` | `/api/chats` | Create a new chat |
| `GET` | `/api/chats/:id` | Get a specific chat |
| `DELETE` | `/api/chats/:id` | Delete a chat |
| `POST` | `/api/chats/:id/messages` | Send a message |

### Sources
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sources` | Add a new source |
| `GET` | `/api/sources/:id` | Get source details |
| `GET` | `/api/sources/:id/status` | Get processing status |
| `DELETE` | `/api/sources/:id` | Delete a source |

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15 with App Router & Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **State Management**: Redux Toolkit with Redux Persist
- **UI Components**: Radix UI primitives
- **Animations**: Framer Motion
- **Forms**: React Hook Form with Zod validation
- **Markdown**: React Markdown with syntax highlighting

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT + bcrypt
- **File Processing**: FFmpeg, yt-dlp
- **AI SDKs**: OpenAI, Anthropic, Google GenAI
- **Text Processing**: LangChain text splitters

---

## 🔧 Development

### Project Structure Conventions

- **Components**: Use PascalCase for component files (`ChatPanel.tsx`)
- **Utilities**: Use camelCase for utility files (`fileCleanup.ts`)
- **Models**: Mongoose models use PascalCase (`User.ts`, `Chat.ts`)
- **Routes**: Route files use kebab-case with suffix (`chat.routes.ts`)

### Adding a New Content Processor

1. Create a new processor in `backend/src/ingestion/processors/`
2. Implement the `SourceProcessor` interface
3. Register it in `backend/src/ingestion/registry.ts`

### Adding a New LLM Provider

1. Create a new client in `backend/src/services/llm/clients/`
2. Implement the `LLMClient` interface
3. Register it in `backend/src/services/llm/factory.ts`

---

## 📦 Deployment

### Building for Production

```bash
pnpm build
```

This will:
- Build the Next.js frontend to `.next/`
- Compile the TypeScript backend to `dist/`

### Production Environment Variables

Ensure all environment variables are set for your production environment. Key differences:
- `NODE_ENV=production`
- Use secure, random strings for `JWT_SECRET`
- Set appropriate `FRONTEND_URL` for CORS
- Use MongoDB Atlas or a managed MongoDB instance

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the ISC License.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Express.js](https://expressjs.com/) - Fast, unopinionated web framework
- [MongoDB](https://www.mongodb.com/) - The database for modern applications
- [Radix UI](https://www.radix-ui.com/) - Unstyled, accessible UI components
- [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework
- [OpenAI](https://openai.com/), [Anthropic](https://www.anthropic.com/), [Google](https://cloud.google.com/vertex-ai) - AI model providers

---

<p align="center">
  Made with ❤️ by the ChatTube team
</p>
