import type { Plugin } from 'vite';
import Anthropic from '@anthropic-ai/sdk';

interface Dataset {
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
}

interface DatasetSummary {
  totalRows: number;
  schema: Array<{ name: string; type: string }>;
  stats: Record<string, any>;
  groupBys: Array<{ by: string; metric: string; groups: any[] }>;
  sample: Array<Record<string, string | number | null>>;
}

export type ChartType = 'bar' | 'line' | 'pie';
const ALL_CHART_TYPES: ChartType[] = ['bar', 'line', 'pie'];

export function presentAnalysisTool(allowedTypes: ChartType[] = ALL_CHART_TYPES) {
  const types = allowedTypes.length > 0 ? allowedTypes : ALL_CHART_TYPES;
  return {
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
              type: { type: 'string', enum: types },
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
}

// Backwards-compatible default export — used by the existing tests and as a fallback.
export const PRESENT_ANALYSIS_TOOL = presentAnalysisTool();

const SYSTEM_PROMPT_FULL =
  `You are a senior data analyst. The user has uploaded a CSV and is asking a question about it.
You MUST respond by calling the present_analysis tool — do not write a normal text reply.
Choose chart types that best fit the question: bar for category comparisons, line for time series or ordered trends, pie for parts-of-a-whole. Return 1 to 4 charts. Compute values directly from the rows the user provided. Be concise in the insight.`;

const SYSTEM_PROMPT_SUMMARY =
  `You are a senior data analyst. The user has uploaded a large CSV and is asking a question about it. You are NOT seeing every row — you are seeing a precomputed summary plus a random 100-row sample.

The summary contains:
- "totalRows" — the true row count of the full dataset
- "schema" — column names and inferred types (numeric / categorical / date / text)
- "stats" — exact per-column statistics computed over the FULL dataset (not the sample). For numeric columns: count, nulls, min, max, mean, sum, p25, p50, p75. For categorical columns: distinct count plus the top 10 values with their counts. For dates: min and max.
- "groupBys" — exact group-by tables for low-cardinality (≤20 distinct) categorical × numeric pairs. Each entry has the top-10 categories by sum, with sum/mean/count over the full dataset.
- "sample" — 100 random rows for context only

For exact values, USE the stats and groupBys (those are exact over the full data). Use the sample only to understand row shape and individual examples. If a question requires looking at specific rows you do not have access to (e.g., "find the row where X is highest"), say so explicitly and answer with whatever the stats/groupBys can support.

You MUST respond by calling the present_analysis tool — do not write a normal text reply.
Choose chart types that best fit the question: bar for category comparisons, line for time series or ordered trends, pie for parts-of-a-whole. Return 1 to 4 charts. Be concise in the insight.`;

export function buildAnthropicRequest(
  question: string,
  dataset: Dataset,
  allowedChartTypes: ChartType[] = ALL_CHART_TYPES,
) {
  const datasetJson = JSON.stringify({ columns: dataset.columns, rows: dataset.rows });
  return {
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      { type: 'text' as const, text: SYSTEM_PROMPT_FULL, cache_control: { type: 'ephemeral' as const } },
    ],
    tools: [presentAnalysisTool(allowedChartTypes)],
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

export function buildSummaryRequest(
  question: string,
  summary: DatasetSummary,
  allowedChartTypes: ChartType[] = ALL_CHART_TYPES,
) {
  const summaryJson = JSON.stringify(summary);
  return {
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      { type: 'text' as const, text: SYSTEM_PROMPT_SUMMARY, cache_control: { type: 'ephemeral' as const } },
    ],
    tools: [presentAnalysisTool(allowedChartTypes)],
    tool_choice: { type: 'tool' as const, name: 'present_analysis' },
    messages: [
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: `Dataset summary (JSON):\n${summaryJson}`,
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
        const t0 = Date.now();
        console.log(`[anthropic] ${req.method} received`);
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
          const sizeKb = Math.round(JSON.stringify(body).length / 1024);
          const mode = body.summary ? 'summary' : 'full';
          const rowsForLog = mode === 'summary' ? body.summary.totalRows : (body.rows?.length ?? 0);
          const allowed: ChartType[] = Array.isArray(body.allowedChartTypes) && body.allowedChartTypes.length > 0
            ? body.allowedChartTypes.filter((t: any) => ALL_CHART_TYPES.includes(t))
            : ALL_CHART_TYPES;
          console.log(`[anthropic] body parsed in ${Date.now() - t0}ms — mode=${mode}, ${rowsForLog} rows, ${sizeKb} KB on wire, charts=${allowed.join('/')}`);
          const requestBody = mode === 'summary'
            ? buildSummaryRequest(body.question, body.summary, allowed)
            : buildAnthropicRequest(body.question, { columns: body.columns, rows: body.rows }, allowed);
          const client = new Anthropic({ apiKey });
          const tApi = Date.now();
          const response = await client.messages.create(requestBody as any);
          const u = response.usage as any;
          console.log(
            `[anthropic] Claude responded in ${Date.now() - tApi}ms — ` +
            `in ${u?.input_tokens ?? '?'} | out ${u?.output_tokens ?? '?'} | ` +
            `cache write ${u?.cache_creation_input_tokens ?? 0} | cache read ${u?.cache_read_input_tokens ?? 0}`
          );
          const toolUse = response.content.find((b) => b.type === 'tool_use');
          if (!toolUse || toolUse.type !== 'tool_use') {
            console.log(`[anthropic] no tool_use in response, content types: ${response.content.map((b) => b.type).join(',')}`);
            res.statusCode = 502;
            res.setHeader('content-type', 'application/json');
            return res.end(JSON.stringify({ error: 'Claude did not call the present_analysis tool.' }));
          }
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(toolUse.input));
          console.log(`[anthropic] OK — total ${Date.now() - t0}ms`);
        } catch (e: any) {
          console.log(`[anthropic] FAIL after ${Date.now() - t0}ms: ${e?.status ?? '?'} — ${e?.message ?? 'unknown'}`);
          res.statusCode = e?.status ?? 500;
          res.setHeader('content-type', 'application/json');
          const raw = e?.message ?? 'Anthropic call failed';
          const friendly = /prompt is too long/i.test(raw)
            ? `Your dataset is too large to send to Claude in one request. Try a smaller CSV (under ~5,000 rows for v1).`
            : raw;
          res.end(JSON.stringify({ error: friendly }));
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
