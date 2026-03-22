export type Provider = "claude" | "openai" | "gemini";

export interface Session {
  sessionId: string;
  provider: Provider;
  /** Raw API key — never leaves the server */
  apiKey: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface JwtPayload {
  sessionId: string;
  provider: Provider;
  iat?: number;
  exp?: number;
}

export interface AuthValidateRequest {
  provider: Provider;
  apiKey: string;
}

export interface AuthValidateResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ToolCallRequest {
  arguments: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}
