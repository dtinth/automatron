import { type ToolResultPart, type ToolSet } from 'ai'
import { z, type ZodTypeAny } from 'zod'

export const tools = {} satisfies ToolSet

export type ToolResult = { output: any; isError?: boolean }

export type ToolImplementation<TOOLS extends ToolSet> = {
  [K in keyof TOOLS]?: (
    args: TOOLS[K]['inputSchema'] extends z.ZodTypeAny
      ? z.infer<TOOLS[K]['inputSchema']>
      : unknown
  ) => Promise<ToolResult>
}
