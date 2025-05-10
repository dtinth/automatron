import {
  type ToolExecutionOptions,
  type ToolResultPart,
  type ToolSet,
} from 'ai'
import { z } from 'zod'

export const tools = {} satisfies ToolSet

export type ToolResult = Pick<ToolResultPart, 'isError' | 'result'>

export type ToolImplementation<TOOLS extends ToolSet> = {
  [K in keyof TOOLS]?: (
    args: z.infer<TOOLS[K]['parameters']>,
    options: ToolExecutionOptions
  ) => Promise<ToolResult>
}
