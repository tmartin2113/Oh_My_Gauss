import Anthropic from "@anthropic-ai/sdk";
import { queryRelevant, RetrievedContext } from "../vectorstore/index.js";

const SYSTEM_PROMPT = `You are Oh My Gauss, an enthusiastic and knowledgeable science tutor. Your goal is to help students understand scientific concepts clearly and accurately.

Guidelines:
- Use the provided source material to give accurate, up-to-date answers
- Explain concepts at an appropriate level — start accessible, then go deeper if asked
- Always cite your sources by mentioning the article title and URL
- If the sources don't contain relevant information, say so and provide your best knowledge with a caveat
- Use analogies and examples to make complex topics understandable
- Encourage curiosity — suggest related topics the student might find interesting
- Be concise but thorough. Aim for clarity over complexity.`;

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

function buildContextBlock(contexts: RetrievedContext[]): string {
  if (contexts.length === 0) {
    return "No relevant sources found in the knowledge base.";
  }

  return contexts
    .map(
      (ctx, i) =>
        `[Source ${i + 1}] "${ctx.title}" (${ctx.field})\nURL: ${ctx.url}\nRelevance: ${(ctx.score * 100).toFixed(0)}%\n\n${ctx.text}`
    )
    .join("\n\n---\n\n");
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export async function askTutor(
  question: string,
  history: ConversationMessage[] = []
): Promise<{ answer: string; sources: RetrievedContext[] }> {
  const client = getClient();

  // Retrieve relevant context from ChromaDB
  const contexts = await queryRelevant(question, 5);
  const contextBlock = buildContextBlock(contexts);

  // Build message with context
  const userMessage = `Here are relevant sources from my science knowledge base:

<sources>
${contextBlock}
</sources>

Student's question: ${question}`;

  // Build conversation messages
  const messages: Anthropic.MessageParam[] = [
    ...history.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  const answer =
    response.content[0].type === "text" ? response.content[0].text : "";

  return { answer, sources: contexts };
}
