import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import fileUpload from "express-fileupload";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import database from "./db/mongodb";
import apiRouter from "./routes/index";
import { startGlobalCleanup, stopGlobalCleanup } from "./utils/fileCleanup";

const app = express();

// --- Middlewares ---
// CORS configuration for both frontend and public API
const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:3000", // Frontend
      "http://localhost:3001", // Development alternative or backend itself
    ];

    // Allow if the origin is in the list OR if in development mode (allows any origin in dev)
    if (
      process.env.NODE_ENV === "development" ||
      allowedOrigins.includes(origin)
    ) {
      callback(null, true);
    } else {
      // If not in development and origin is not explicitly allowed, reject it.
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: false, // No longer needed with JWT in headers
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 600, // Cache preflight requests for 10 minutes
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(fileUpload({ limits: { fileSize: 300 * 1024 * 1024 } }));
app.use(bodyParser.json({ limit: "300mb" }));
app.use(bodyParser.urlencoded({ limit: "300mb", extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use("/api", apiLimiter);

// --- Routes ---
app.use("/api", apiRouter);

// --- Health Check ---
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    version: "1.0.0",
  });
});

// --- Error Handling Middleware ---
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Middleware Error:", err);
    if (err?.name === "UnauthorizedError") {
      res.status(401).json({ status: "ERROR", message: "Unauthorized user" });
    } else if (err?.type === "entity.too.large") {
      res
        .status(413)
        .json({ status: "ERROR", message: "Payload is too large" });
    } else {
      res.status(500).json({
        status: "ERROR",
        message: err?.message || "Internal Server Error",
      });
    }
  }
);

// --- Server Startup Logic ---
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Connect to MongoDB first
    await database.connect();

    // Start file cleanup manager for temporary audio files
    startGlobalCleanup();

    const server = app.listen(PORT, () => {
      console.log(
        `HTTP Server running on port ${PORT}. Mode: ${
          process.env.NODE_ENV || "development"
        }`
      );
    });

    return server;
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// --- Graceful Shutdown & Global Error Handling ---
let runningServer: ReturnType<typeof app.listen> | null = null;

const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  let exitCode = 0;
  try {
    // Stop file cleanup manager
    stopGlobalCleanup();

    if (runningServer) {
      runningServer.close(async () => {
        console.log("HTTP server closed.");
        await database.disconnect();
        console.log("MongoDB disconnected.");
        process.exit(exitCode);
      });
    } else {
      await database.disconnect();
      console.log("MongoDB disconnected.");
      process.exit(exitCode);
    }
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    exitCode = 1;
    process.exit(exitCode);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("uncaughtException", async (error) => {
  console.error("Uncaught Exception:", error);
  try {
    await database.disconnect();
  } catch (e) {
    console.error("Error disconnecting MongoDB on uncaughtException:", e);
  }
  process.exit(1);
});

process.on("unhandledRejection", async (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  try {
    await database.disconnect();
  } catch (e) {
    console.error("Error disconnecting MongoDB on unhandledRejection:", e);
  }
  process.exit(1);
});

// --- Initiate Server Start ---
startServer().then((server) => {
  if (server) {
    runningServer = server;
  }
});
