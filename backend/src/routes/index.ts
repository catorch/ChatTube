import { Router } from "express";
import authRouter from "./auth.routes";
import userRouter from "./user.routes";
import chatRouter from "./chat.routes";
import videoRouter from "./video.routes";

const mainRouter = Router();

mainRouter.use("/auth", authRouter);
mainRouter.use("/users", userRouter);
mainRouter.use("/chats", chatRouter);
mainRouter.use("/videos", videoRouter);

// Health check endpoint
mainRouter.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "ChatTube API is running",
    timestamp: new Date().toISOString(),
  });
});

export default mainRouter;
