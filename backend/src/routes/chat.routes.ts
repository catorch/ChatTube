import { Router } from "express";
import * as chatController from "../controllers/chat.controller";
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

// Delete a chat
chatRouter.delete("/:chatId", chatController.deleteChat);

export default chatRouter;
