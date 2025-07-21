import { Response } from "express";

class SSEManager {
  private connections: Map<string, Set<Response>> = new Map();

  addConnection(chatId: string, res: Response) {
    if (!this.connections.has(chatId)) {
      this.connections.set(chatId, new Set());
    }
    this.connections.get(chatId)!.add(res);
    res.on("close", () => {
      this.removeConnection(chatId, res);
    });
  }

  removeConnection(chatId: string, res: Response) {
    const set = this.connections.get(chatId);
    if (set) {
      set.delete(res);
      if (set.size === 0) {
        this.connections.delete(chatId);
      }
    }
  }

  sendEvent(chatId: string, event: any) {
    const set = this.connections.get(chatId);
    if (set) {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      for (const res of set) {
        res.write(data);
      }
    }
  }
}

export default new SSEManager();
