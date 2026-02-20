import { tool } from "ai"
import { z } from "zod"

export const exampleEchoTool = tool({
  description: "Echoes a short text payload for smoke tests and wiring checks.",
  inputSchema: z.object({
    text: z.string().min(1).max(500),
  }),
  execute: async ({ text }) => {
    return {
      echoed: text,
      length: text.length,
    }
  },
})

