import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { getOwnedFinalDeliverable, listOwnedRuns } from "./runs";

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function createMurmurMcpServer(ownerId: string) {
  const server = new McpServer(
    { name: "murmur", version: "1.0.0" },
    {
      instructions:
        "Read-only access to this Murmur account. Call list_runs to discover retained runs, then " +
        "get_final_deliverable with a runId. Deliverables can include source-linked live web research " +
        "from Murmur's Researcher agent. Run data is available only during Murmur's server retention window.",
    },
  );

  server.registerTool(
    "list_runs",
    {
      title: "List Murmur runs",
      description: "List recent runs owned by the connected Murmur account.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional().describe("Maximum runs to return (1-50)."),
      },
      annotations: READ_ONLY,
    },
    async ({ limit }) => {
      const runs = await listOwnedRuns(ownerId, limit ?? 20);
      const output = {
        runs,
        retentionNote: "Only runs still inside Murmur's server retention window are available.",
      };
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    "get_final_deliverable",
    {
      title: "Get final deliverable",
      description:
        "Read the final Markdown deliverable, including any retained Researcher source links, for " +
        "one run owned by this Murmur account.",
      inputSchema: {
        runId: z.uuid().describe("Run ID returned by list_runs."),
      },
      annotations: READ_ONLY,
    },
    async ({ runId }) => {
      const deliverable = await getOwnedFinalDeliverable(ownerId, runId);
      if (!deliverable) {
        return {
          content: [{ type: "text", text: "Run not found, expired, or not owned by this account." }],
          isError: true,
        };
      }
      if (!deliverable.final) {
        return {
          content: [{ type: "text", text: `Run ${runId} has no final deliverable yet.` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: deliverable.final }],
        structuredContent: deliverable,
      };
    },
  );

  return server;
}
