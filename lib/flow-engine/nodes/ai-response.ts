import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { FlowExecutionContext, AiResponseNodeData } from "../types";
import { createZernioClient } from "@/lib/zernio-client";
import { generateText, createGateway } from "ai";

// Halt the run: continuing would let a downstream Send Message deliver the
// literal "{{ai_response}}" token to the contact (same pause mechanism as
// humanTakeover, but the session is cancelled rather than completed).
async function cancelRun(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<"pause"> {
  await supabase
    .from("flow_sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionId);
  return "pause";
}

export async function executeAiResponse(
  supabase: SupabaseClient<Database>,
  data: AiResponseNodeData,
  context: FlowExecutionContext,
  sessionId: string
) {
  // Get workspace for Zernio API key + AI Gateway key
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("late_api_key_encrypted, ai_api_key")
    .eq("id", context.workspaceId)
    .single();

  if (!workspace?.late_api_key_encrypted) {
    console.error("No Zernio API key for workspace:", context.workspaceId);
    return cancelRun(supabase, sessionId);
  }

  const zernio = createZernioClient(workspace.late_api_key_encrypted);

  // Resolve late_account_id from channel if not in context
  let lateAccountId = context.lateAccountId;
  if (!lateAccountId) {
    const { data: channel } = await supabase
      .from("channels")
      .select("late_account_id, platform")
      .eq("id", context.channelId)
      .single();

    if (!channel) {
      console.error("No channel found for id:", context.channelId);
      return cancelRun(supabase, sessionId);
    }
    lateAccountId = channel.late_account_id;
    if (!context.platform) {
      context.platform = channel.platform as FlowExecutionContext["platform"];
    }
  }

  // Resolve late_conversation_id from conversation if not in context
  let lateConversationId = context.lateConversationId;
  if (!lateConversationId) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("late_conversation_id")
      .eq("id", context.conversationId)
      .single();

    if (!conversation?.late_conversation_id) {
      console.error("No late_conversation_id found for conversation:", context.conversationId);
      return cancelRun(supabase, sessionId);
    }
    lateConversationId = conversation.late_conversation_id;
  }

  // Fetch last N messages from the conversation for context
  // Include attachments so the AI knows when a message contained an
  // image/sticker/etc it cannot see — prevents hallucinated guesses.
  const contextMessages = data.contextMessages || 10;
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("direction, text, attachments")
    .eq("conversation_id", context.conversationId)
    .order("created_at", { ascending: false })
    .limit(contextMessages);

  // Build messages array for the AI
  const aiMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (recentMessages && recentMessages.length > 0) {
    // Reverse to get chronological order (oldest first)
    const chronological = [...recentMessages].reverse();
    for (const msg of chronological) {
      if (!msg.text && !msg.attachments) continue;
      let content = msg.text || "";
      // Append attachment metadata so the AI knows there was an image/sticker
      // it cannot process. This lets the system prompt's SKIP rule fire.
      const rawAttachments = msg.attachments;
      const attachmentList = Array.isArray(rawAttachments) ? rawAttachments : [];
      if (attachmentList.length > 0) {
        const types = attachmentList
          .map((a: unknown) => {
            if (typeof a === "object" && a !== null && "type" in a) {
              return String((a as { type?: string }).type || "attachment");
            }
            return "attachment";
          })
          .join(", ");
        content += content ? ` [Attachment: ${types}]` : `[Attachment: ${types}]`;
      }
      aiMessages.push({
        role: msg.direction === "inbound" ? "user" : "assistant",
        content,
      });
    }
  }

  // ── RAG Knowledge Base Search ──────────────────────────────────────────
  // Search the knowledge_base table for relevant context based on the
  // latest user message. Inject the results into the system prompt so the
  // AI has accurate, specific information to answer with.
  let ragContext = "";
  const aiGatewayKeyEarly = workspace.ai_api_key || process.env.AI_GATEWAY_API_KEY;

  if (aiGatewayKeyEarly) {
    try {
      // Get the latest inbound message (the user's current question)
      const latestUserMsg = aiMessages
        .filter((m) => m.role === "user")
        .pop();

      if (latestUserMsg && latestUserMsg.content.trim().length > 2) {
        // Generate embedding for the user's message via Vercel AI Gateway
        const embedResponse = await fetch(
          "https://ai-gateway.vercel.sh/v1/embeddings",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${aiGatewayKeyEarly}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/text-embedding-3-small",
              input: latestUserMsg.content.slice(0, 1000),
            }),
          }
        );

        if (embedResponse.ok) {
          const embedData = await embedResponse.json();
          const queryEmbedding: number[] = embedData.data[0].embedding;
          const embeddingStr = `[${queryEmbedding.join(",")}]`;
          const escapedQuery = latestUserMsg.content.replace(/'/g, "''").slice(0, 500);

          // Call hybrid search RPC (keyword + semantic with RRF fusion)
          const { data: searchResults, error: searchError } = await supabase.rpc(
            "hybrid_search_kb" as never,
            {
              query_text: escapedQuery,
              query_embedding: embeddingStr,
              match_count: 3,
              full_text_weight: 1.0,
              semantic_weight: 1.5, // Slightly favor semantic for conversational queries
              rrf_k: 50,
            } as never
          ) as { data: Array<{ question: string; answer: string; score: number }> | null; error: unknown };

          if (!searchError && searchResults && searchResults.length > 0) {
            // Build context string from search results
            const contextParts = searchResults.map(
              (r: { question: string; answer: string }) => `Q: ${r.question}\nA: ${r.answer}`
            );
            ragContext = `\n\n---\n## KNOWLEDGE BASE RESULTS (use these to answer the user's question accurately)\n${contextParts.join("\n\n")}\n---\n`;
          }
        }
      }
    } catch (ragError) {
      // RAG failure should NOT block the response — just log and continue
      console.warn("RAG search failed (non-blocking), continuing with base prompt:", ragError);
    }
  }

  try {
    const model = data.model || "openai/gpt-4o-mini";
    const aiGatewayKey = workspace.ai_api_key || process.env.AI_GATEWAY_API_KEY;

    // Retry with exponential backoff for transient errors (rate limits,
    // timeouts, 5xx responses). Classifies errors so permanent failures
    // (auth, bad request) don't waste retry attempts.
    const maxRetries = data.maxRetries ?? 3;
    let lastError: Error | null = null;

    const isTransient = (err: unknown): boolean => {
      const msg = err instanceof Error ? err.message : String(err);
      const transient = [
        "rate limit", "rate_limit", "429", "timeout", "timed out",
        "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "fetch failed",
        "503", "502", "500", "network", "temporarily unavailable",
        "overloaded", "capacity",
      ];
      return transient.some((t) => msg.toLowerCase().includes(t.toLowerCase()));
    };

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    let text = "";

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const gw = createGateway({ apiKey: aiGatewayKey || undefined });
        const result = await generateText({
          model: gw(model),
          system: (data.systemPrompt || "You are a helpful customer support agent.") + ragContext,
          messages: aiMessages,
          temperature: data.temperature ?? 0.7,
          maxOutputTokens: data.maxTokens ?? 500,
        });

        text = result.text;
        lastError = null;
        break; // success
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxRetries && isTransient(err)) {
          // Exponential backoff: 1s, 2s, 4s, 8s...
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 8000);
          await sleep(backoffMs);
          continue;
        }

        // Permanent error or out of retries — stop retrying
        break;
      }
    }

    // All retries exhausted — send fallback instead of ghosting the contact
    if (lastError) {
      throw lastError;
    }

    // ── SKIP detection ──────────────────────────────────────────────────────
    // The AI may decide it cannot confidently help with this message.
    // In that case it returns exactly "SKIP" (enforced by the system prompt).
    // When it does, we DON'T send any message to the contact — silence is
    // better than a confused or hallucinated reply.
    if (text.trim().toUpperCase() === "SKIP") {
      // Log the skip for monitoring so we can calibrate the threshold later
      await supabase.from("analytics_events").insert({
        workspace_id: context.workspaceId,
        flow_id: context.flowId,
        contact_id: context.contactId,
        event_type: "ai_skipped",
        metadata: { reason: "AI returned SKIP — not confident enough to reply" },
      });

      // Cancel the session — no message sent, downstream nodes don't run
      return cancelRun(supabase, sessionId);
    }

    // Expose the generated text to downstream nodes as {{ai_response}}
    context.variables = { ...(context.variables ?? {}), ai_response: text };

    if (data.sendDirectly !== false) {
      // Send via Zernio REST API (same pattern as executeSendMessage)
      const response = await zernio.messages.sendInboxMessage({
        path: { conversationId: lateConversationId },
        body: { accountId: lateAccountId, message: text },
      });

      // Store outbound message
      await supabase.from("messages").insert({
        conversation_id: context.conversationId,
        direction: "outbound",
        text,
        attachments: null,
        sent_by_flow_id: context.flowId,
        sent_by_node_id: null,
        platform_message_id: response.data?.data?.messageId || null,
        status: "sent",
      });

      await supabase.from("analytics_events").insert({
        workspace_id: context.workspaceId,
        flow_id: context.flowId,
        contact_id: context.contactId,
        event_type: "message_sent",
      });
    }
  } catch (error) {
    console.error("Failed to generate or send AI response:", error);

    // Send a user-facing fallback instead of "[AI response failed]" so the
    // contact is not left hanging. Falls back to a generic message.
    const fallbackMessage =
      data.fallbackMessage ||
      "I'm having trouble responding right now, but I'll get back to you shortly! 😊";

    // Try to send the fallback via Zernio
    try {
      await zernio.messages.sendInboxMessage({
        path: { conversationId: lateConversationId },
        body: { accountId: lateAccountId, message: fallbackMessage },
      });

      await supabase.from("messages").insert({
        conversation_id: context.conversationId,
        direction: "outbound",
        text: fallbackMessage,
        sent_by_flow_id: context.flowId,
        platform_message_id: null,
        status: "sent",
      });
    } catch (sendErr) {
      console.error("Failed to send AI fallback message:", sendErr);
    }

    await supabase.from("analytics_events").insert({
      workspace_id: context.workspaceId,
      flow_id: context.flowId,
      contact_id: context.contactId,
      event_type: "message_failed",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
        fallback_sent: true,
      },
    });

    return cancelRun(supabase, sessionId);
  }
}
