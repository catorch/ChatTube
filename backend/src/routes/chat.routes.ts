import { Router } from "express";
import * as chatController from "../controllers/chat.controller";
import * as sourceController from "../controllers/source.controller";
import { authenticateUser } from "../middlewares/user.middleware";

const chatRouter = Router();

// All chat routes require authentication
chatRouter.use(authenticateUser);

// Create a new chat
chatRouter.post("/", chatController.createChat);

// Get user's chats
chatRouter.get("/", chatController.getUserChats);

// Get messages for a specific chat
chatRouter.get("/:chatId/messages", chatController.getChatMessages);

// Send a message to a chat and get AI response
chatRouter.post("/:chatId/messages", chatController.sendMessage);

// Stream a message to a chat with real-time AI response
chatRouter.post("/:chatId/stream", chatController.streamMessage);

// Subscribe to chat events (metadata updates)
chatRouter.get("/:chatId/events", chatController.chatEvents);

// ----- Sources within a chat -----
// List sources for a specific chat
chatRouter.get("/:chatId/sources", sourceController.listSources);

// Add sources to a specific chat
chatRouter.post("/:chatId/sources", sourceController.addSources);

// Remove a specific source from a chat
chatRouter.delete("/:chatId/sources/:sourceId", sourceController.removeSource);

// Update chat (title, etc.)
chatRouter.put("/:chatId", chatController.updateChat);

// Delete a chat
chatRouter.delete("/:chatId", chatController.deleteChat);

export default chatRouter;
