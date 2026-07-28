import type { NodeType, Platform } from "@/lib/types/database";

export interface FlowNode {
  id: string;
  type: NodeType;
  data: NodeData;
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

export type NodeData =
  | TriggerNodeData
  | SendMessageNodeData
  | ConditionNodeData
  | DelayNodeData
  | TagNodeData
  | SetFieldNodeData
  | HttpRequestNodeData
  | GoToFlowNodeData
  | HumanTakeoverNodeData
  | ABSplitNodeData
  | SmartDelayNodeData
  | SubscribeNodeData
  | CommentReplyNodeData
  | PrivateReplyNodeData
  | AiResponseNodeData
  | EnrollSequenceNodeData;

export interface TriggerNodeData {
  triggerType: string;
  keywords?: Array<{
    value: string;
    matchType: "exact" | "contains" | "startsWith";
  }>;
  payload?: string;
}

export interface SendMessageNodeData {
  messages: Array<{
    text?: string;
    imageUrl?: string;
    quickReplies?: Array<{ title: string; payload: string }>;
    buttons?: Array<{
      title: string;
      type: "postback" | "url";
      payload?: string;
      url?: string;
    }>;
    carousel?: {
      elements: Array<{
        imageUrl?: string;
        title: string;
        subtitle?: string;
        buttons?: Array<{
          type: "postback" | "url";
          title: string;
          payload?: string;
          url?: string;
        }>;
      }>;
    };
  }>;
}

export interface ConditionNodeData {
  conditions: Array<{
    field: string;
    operator: "equals" | "not_equals" | "contains" | "exists" | "gt" | "lt";
    value: string;
  }>;
  logic: "and" | "or";
}

export interface DelayNodeData {
  duration: number;
  unit: "seconds" | "minutes" | "hours" | "days";
}

export interface TagNodeData {
  action: "add" | "remove";
  tagName: string;
}

export interface SetFieldNodeData {
  fieldSlug: string;
  value: string;
}

export interface HttpRequestNodeData {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: string;
  responseVariable?: string;
}

export interface GoToFlowNodeData {
  flowId: string;
  returnAfter: boolean;
}

export interface HumanTakeoverNodeData {
  message?: string;
}

export interface ABSplitNodeData {
  paths: Array<{ name: string; weight: number }>;
}

export interface SmartDelayNodeData {
  timeout: number;
  timeoutUnit: "minutes" | "hours" | "days";
}

export interface SubscribeNodeData {
  action: "subscribe" | "unsubscribe";
}

export interface CommentReplyNodeData {
  /** Text to reply to the comment with. Supports {{variable}} interpolation. */
  text: string;
}

export interface PrivateReplyNodeData {
  /** Text to send as a private DM to the commenter. Supports {{variable}} interpolation. */
  text: string;
  imageUrl?: string;
}

export interface AiResponseNodeData {
  label?: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  contextMessages: number;
  /**
   * The generated text is always stored in the ai_response variable. When false,
   * the node ONLY stores it (no send), so a later Send Message node can use
   * {{ai_response}} without double-sending. Defaults to true for back-compat.
   */
  sendDirectly?: boolean;
}

export interface EnrollSequenceNodeData {
  /** The ID of the sequence to enroll the contact into */
  sequenceId: string;
}

export interface FlowExecutionContext {
  triggerId: string;
  flowId: string;
  channelId: string;
  contactId: string;
  conversationId: string;
  workspaceId: string;
  /** The Zernio API conversation ID (from conversations.late_conversation_id) */
  lateConversationId?: string;
  /** The Zernio API account ID (from channels.late_account_id) */
  lateAccountId?: string;
  incomingMessage: {
    text?: string;
    postbackPayload?: string;
    quickReplyPayload?: string;
    callbackData?: string;
    sender?: { id: string; name?: string; username?: string };
  };
  variables?: Record<string, string>;
  platform?: Platform;
}
