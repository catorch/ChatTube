// Chat request types
export interface ChatRequest {
  message: string;
  previousResponseId?: string;
}

// Server-Sent Event types
export type ChatEventType = 'delta' | 'done' | 'error' | 'tool_call';

export interface ChatDeltaEvent {
  type: 'delta';
  content: string;
}

export interface ChatDoneEvent {
  type: 'done';
  responseId?: string;
}

export interface ChatErrorEvent {
  type: 'error';
  message: string;
}

export interface ChatToolCallEvent {
  type: 'tool_call';
  name?: string;
  status: 'started' | 'completed';
  output?: any;
}

export type ChatEvent = ChatDeltaEvent | ChatDoneEvent | ChatErrorEvent | ChatToolCallEvent; 