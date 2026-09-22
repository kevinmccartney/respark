import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { ToolResult } from '@respark/schemas/chat';

import type { ChatTool, ToolContext } from './types';

type ToolThrowLogger = {
  error: (obj: object, msg: string) => void;
};

export const executeChatTool = async (
  tool: ChatTool<unknown, unknown>,
  rawInput: unknown,
  ctx: ToolContext,
  logger?: ToolThrowLogger,
): Promise<ToolResult<unknown>> => {
  const parsed = tool.inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    return {
      ok: false,
      code: 'invalid_args',
      message: `${path}${issue?.message ?? 'Invalid tool arguments'}`,
    };
  }
  try {
    return await tool.execute(parsed.data, ctx);
  } catch (err) {
    if (err instanceof NotFoundException) {
      return { ok: false, code: 'not_found', message: err.message };
    }
    if (err instanceof BadRequestException) {
      return { ok: false, code: 'bad_request', message: err.message };
    }
    logger?.error({ event: 'chat.tool_failed', err, name: tool.name }, 'Chat tool threw');
    return { ok: false, code: 'internal', message: 'Tool failed' };
  }
};
