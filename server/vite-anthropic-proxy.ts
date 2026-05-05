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

export interface PriorTurn {
  toolUseId: string;
  toolInput: any;
  toolResult: any;
}

export type ChartType = 'bar' | 'line' | 'pie';
const ALL_CHART_TYPES: ChartType[] = ['bar', 'line', 'pie'];

export function presentAnalysisTool(allowedTypes: ChartType[] = ALL_CHART_TYPES) {
  const types = allowedTypes.length > 0 ? allowedTypes : ALL_CHART_TYPES;
  return {
    name: 'present_analysis',
    description: 'Return the final answer to the user — plain-English insight plus 1 to 4 charts. Call this when you have everything you need to answer the question, either from the summary directly or after a query_dataset result.',
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

export const QUERY_DATASET_TOOL = {
  name: 'query_dataset',
  description:
    `Run a structured query against the user's FULL in-memory dataset. The browser executes this against every row and returns the result.

USE THIS when the question requires data the summary does not already contain:
  • finding individual rows ("which transaction had the highest profit?")
  • top-N / bottom-N row queries ("show the top 10 customers by revenue")
  • filters by exact values ("rows where region='North' AND year=2025")
  • aggregations the precomputed groupBys don't cover (the summary's groupBys only sum/mean numeric × low-cardinality categorical pairs)

DO NOT use this if the question can be answered from the summary's stats and groupBys (totals/means/counts on standard categorical × numeric pairs are already exact in the summary).

After you receive the tool result, call present_analysis to give the user the final written insight + charts.`,
  input_schema: {
    type: 'object',
    required: ['limit'],
    properties: {
      select: {
        type: 'array',
        items: { type: 'string' },
        description: 'Which columns to return. Omit to return all columns.',
      },
      filter: {
        type: 'array',
        description: 'AND-combined filter clauses.',
        items: {
          type: 'object',
          required: ['column', 'op', 'value'],
          properties: {
            column: { type: 'string' },
            op: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] },
            value: { type: ['string', 'number'] },
          },
        },
      },
      groupBy: {
        type: 'string',
        description: 'When set, returns one row per unique value of this column with the aggregate metrics applied.',
      },
      aggregate: {
        type: 'array',
        description: 'Aggregations to compute when groupBy is set. Each adds a column to the result rows.',
        items: {
          type: 'object',
          required: ['column', 'fn'],
          properties: {
            column: { type: 'string' },
            fn: { type: 'string', enum: ['sum', 'mean', 'count', 'min', 'max'] },
            alias: { type: 'string', description: 'Output column name. Defaults to "<column>_<fn>".' },
          },
        },
      },
      sortBy: { type: 'string', description: 'Column to sort by (use the alias / output column when groupBy is set).' },
      direction: { type: 'string', enum: ['asc', 'desc'] },
      limit: { type: 'number', description: 'Required. Server-clamped to a max of 50.' },
    },
  },
} as const;

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
- "stats" — exact per-column statistics computed over the FULL dataset (count, nulls, min/max/mean/sum, percentiles for numerics; distinct + top-10 values for categoricals; min/max for dates)
- "groupBys" — exact group-by tables for low-cardinality (≤20 distinct) categorical × numeric pairs (top 10 categories by sum, with sum/mean/count over the full dataset)
- "sample" — 100 random rows for context only

You have TWO tools:

1) **present_analysis** — call this when the summary already contains the answer. Most "X by Y" questions, ratios, totals, and trend descriptions can be answered directly from "stats" and "groupBys" (those are exact over the full dataset).

2) **query_dataset** — call this FIRST when the question needs raw rows or aggregations the summary doesn't cover (e.g., "top 10 individual transactions by profit", "find the row where X is highest", "filter rows by an exact value"). The browser will execute the query against the full dataset and return the result. Then call present_analysis with the final insight and charts.

Examples:
  • "Total revenue by region" → present_analysis directly (groupBys["region","revenue"] is exact)
  • "Which 5 products had the highest profit?" → query_dataset({ sortBy: "profit", direction: "desc", limit: 5 }) then present_analysis
  • "Average revenue for orders over $1000" → query_dataset({ filter: [{column:"revenue", op:"gt", value:1000}], groupBy: <suitable column>, aggregate: [{column:"revenue", fn:"mean"}], limit: 50 })

You MUST respond by calling exactly one tool. Do not write a normal text reply.`;

interface ProxyRequestBody {
  question: string;
  columns?: string[];
  rows?: Array<Record<string, string | number | null>>;
  summary?: DatasetSummary;
  allowedChartTypes?: ChartType[];
  priorTurns?: PriorTurn[];
}

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
  priorTurns: PriorTurn[] = [],
) {
  const summaryJson = JSON.stringify(summary);

  const messages: any[] = [
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
  ];

  // Append the conversation history: each prior turn is an assistant tool_use
  // followed by a user tool_result.
  for (const turn of priorTurns) {
    messages.push({
      role: 'assistant' as const,
      content: [
        {
          type: 'tool_use' as const,
          id: turn.toolUseId,
          name: 'query_dataset',
          input: turn.toolInput,
        },
      ],
    });
    messages.push({
      role: 'user' as const,
      content: [
        {
          type: 'tool_result' as const,
          tool_use_id: turn.toolUseId,
          content: JSON.stringify(turn.toolResult),
        },
      ],
    });
  }

  return {
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      { type: 'text' as const, text: SYSTEM_PROMPT_SUMMARY, cache_control: { type: 'ephemeral' as const } },
    ],
    tools: [presentAnalysisTool(allowedChartTypes), QUERY_DATASET_TOOL],
    tool_choice: { type: 'any' as const },
    messages,
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
          const body = await readJson(req) as ProxyRequestBody;
          const sizeKb = Math.round(JSON.stringify(body).length / 1024);
          const mode = body.summary ? 'summary' : 'full';
          const rowsForLog = mode === 'summary' ? body.summary!.totalRows : (body.rows?.length ?? 0);
          const allowed: ChartType[] = Array.isArray(body.allowedChartTypes) && body.allowedChartTypes.length > 0
            ? (body.allowedChartTypes.filter((t: any) => ALL_CHART_TYPES.includes(t)) as ChartType[])
            : ALL_CHART_TYPES;
          const turn = (body.priorTurns?.length ?? 0) + 1;
          console.log(`[anthropic] body parsed in ${Date.now() - t0}ms — mode=${mode}, ${rowsForLog} rows, ${sizeKb} KB on wire, charts=${allowed.join('/')}, turn=${turn}`);

          const requestBody = mode === 'summary'
            ? buildSummaryRequest(body.question, body.summary!, allowed, body.priorTurns ?? [])
            : buildAnthropicRequest(body.question, { columns: body.columns!, rows: body.rows! }, allowed);

          const client = new Anthropic({ apiKey });
          const tApi = Date.now();
          const response = await client.messages.create(requestBody as any);
          const u = response.usage as any;
          console.log(
            `[anthropic] Claude responded in ${Date.now() - tApi}ms — ` +
            `in ${u?.input_tokens ?? '?'} | out ${u?.output_tokens ?? '?'} | ` +
            `cache write ${u?.cache_creation_input_tokens ?? 0} | cache read ${u?.cache_read_input_tokens ?? 0}`
          );

          const toolUse = response.content.find((b) => b.type === 'tool_use') as any;
          if (!toolUse || toolUse.type !== 'tool_use') {
            console.log(`[anthropic] no tool_use in response, content types: ${response.content.map((b) => b.type).join(',')}`);
            res.statusCode = 502;
            res.setHeader('content-type', 'application/json');
            return res.end(JSON.stringify({ error: 'Claude did not call a tool.' }));
          }

          console.log(`[anthropic] OK — total ${Date.now() - t0}ms — tool=${toolUse.name}`);
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({
            kind: toolUse.name,
            input: toolUse.input,
            toolUseId: toolUse.id,
          }));
        } catch (e: any) {
          console.log(`[anthropic] FAIL after ${Date.now() - t0}ms: ${e?.status ?? '?'} — ${e?.message ?? 'unknown'}`);
          res.statusCode = e?.status ?? 500;
          res.setHeader('content-type', 'application/json');
          const raw = e?.message ?? 'Anthropic call failed';
          const friendly = /prompt is too long/i.test(raw)
            ? `Your dataset is too large to send to Claude in one request.`
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
