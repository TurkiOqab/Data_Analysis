import type { Plugin } from 'vite';
import Anthropic from '@anthropic-ai/sdk';

interface Dataset {
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
}

export const PRESENT_ANALYSIS_TOOL = {
  name: 'present_analysis',
  description: 'Return the analysis as a plain-English insight plus 1 to 4 charts.',
  input_schema: {
    type: 'object',
    required: ['insight', 'charts'],
    properties: {
      insight: {
        type: 'string',
        description: '1–4 short paragraphs in plain English answering the question.',
      },
      charts: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          required: ['type', 'title', 'data'],
          properties: {
            type: { type: 'string', enum: ['bar', 'line', 'pie'] },
            title: { type: 'string' },
            xLabel: { type: 'string' },
            yLabel: { type: 'string' },
            data: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                description:
                  'For bar/pie: { label: string, value: number }. For line: { x: string|number, y: number }.',
              },
            },
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT =
  `You are a senior data analyst. The user has uploaded a CSV and is asking a question about it.
You MUST respond by calling the present_analysis tool — do not write a normal text reply.
Choose chart types that best fit the question: bar for category comparisons, line for time series or ordered trends, pie for parts-of-a-whole. Return 1 to 4 charts. Compute values directly from the rows the user provided. Be concise in the insight.`;

export function buildAnthropicRequest(question: string, dataset: Dataset) {
  const datasetJson = JSON.stringify({ columns: dataset.columns, rows: dataset.rows });
  return {
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      { type: 'text' as const, text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
    ],
    tools: [PRESENT_ANALYSIS_TOOL],
    tool_choice: { type: 'tool' as const, name: 'present_analysis' },
    messages: [
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: `Dataset (JSON):\n${datasetJson}`,
            cache_control: { type: 'ephemeral' as const },
          },
          { type: 'text' as const, text: `Question: ${question}` },
        ],
      },
    ],
  };
}

export function anthropicProxy(): Plugin {
  return {
    name: 'anthropic-proxy',
    configureServer(server) {
      server.middlewares.use('/api/anthropic', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method not allowed');
        }
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          return res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in .env' }));
        }
        try {
          const body = await readJson(req);
          const requestBody = buildAnthropicRequest(body.question, {
            columns: body.columns,
            rows: body.rows,
          });
          const client = new Anthropic({ apiKey });
          const response = await client.messages.create(requestBody as any);
          const toolUse = response.content.find((b) => b.type === 'tool_use');
          if (!toolUse || toolUse.type !== 'tool_use') {
            res.statusCode = 502;
            res.setHeader('content-type', 'application/json');
            return res.end(JSON.stringify({ error: 'Claude did not call the present_analysis tool.' }));
          }
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(toolUse.input));
        } catch (e: any) {
          res.statusCode = e?.status ?? 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: e?.message ?? 'Anthropic call failed' }));
        }
      });
    },
  };
}

function readJson(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}
