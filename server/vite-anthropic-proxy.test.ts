import { describe, it, expect } from 'vitest';
import {
  buildAnthropicRequest,
  buildSummaryRequest,
  presentAnalysisTool,
  PRESENT_ANALYSIS_TOOL,
  QUERY_DATASET_TOOL,
} from './vite-anthropic-proxy';

describe('buildAnthropicRequest (full mode)', () => {
  const dataset = {
    columns: ['region', 'revenue'],
    rows: [{ region: 'North', revenue: 100 }, { region: 'South', revenue: 80 }],
  };

  it('uses the Sonnet 4.6 model', () => {
    const req = buildAnthropicRequest('Total by region?', dataset);
    expect(req.model).toBe('claude-sonnet-4-6');
  });

  it('includes a system message that names the tool', () => {
    const req = buildAnthropicRequest('Q', dataset);
    const sys = Array.isArray(req.system) ? req.system.map((b) => b.text).join('\n') : (req.system ?? '');
    expect(sys.toLowerCase()).toContain('present_analysis');
  });

  it('forces the present_analysis tool — full mode keeps single-tool surface', () => {
    const req = buildAnthropicRequest('Q', dataset);
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'present_analysis' });
    expect(req.tools).toHaveLength(1);
    expect(req.tools[0]).toEqual(PRESENT_ANALYSIS_TOOL);
  });

  it('passes the dataset and question to the user message', () => {
    const req = buildAnthropicRequest('What is the total?', dataset);
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe('user');
    const content = req.messages[0].content;
    const text = Array.isArray(content) ? content.map((b: any) => b.text).join('\n') : content;
    expect(text).toContain('What is the total?');
    expect(text).toContain('"region"');
    expect(text).toContain('North');
  });

  it('marks the dataset block as cacheable', () => {
    const req = buildAnthropicRequest('Q', dataset);
    const blocks = req.messages[0].content as any[];
    const datasetBlock = blocks.find((b) => b.type === 'text' && b.text.includes('"columns"'));
    expect(datasetBlock.cache_control).toEqual({ type: 'ephemeral' });
  });
});

describe('present_analysis tool shape', () => {
  it('declares the right top-level shape', () => {
    expect(PRESENT_ANALYSIS_TOOL.name).toBe('present_analysis');
    const props = PRESENT_ANALYSIS_TOOL.input_schema.properties;
    expect(props.insight.type).toBe('string');
    expect(props.charts.type).toBe('array');
    expect(props.charts.maxItems).toBe(4);
  });

  it('default enum includes all three chart types', () => {
    const props = PRESENT_ANALYSIS_TOOL.input_schema.properties;
    expect(props.charts.items.properties.type.enum).toEqual(['bar', 'line', 'pie']);
  });
});

describe('presentAnalysisTool — chart type filtering', () => {
  it('restricts the type enum to the allowed list', () => {
    const tool = presentAnalysisTool(['bar']);
    expect(tool.input_schema.properties.charts.items.properties.type.enum).toEqual(['bar']);
  });

  it('falls back to all three when given an empty list', () => {
    const tool = presentAnalysisTool([]);
    expect(tool.input_schema.properties.charts.items.properties.type.enum).toEqual(['bar', 'line', 'pie']);
  });

  it('keeps name and tool surface stable when filtering', () => {
    const tool = presentAnalysisTool(['line', 'pie']);
    expect(tool.name).toBe('present_analysis');
    expect(tool.input_schema.properties.charts.maxItems).toBe(4);
  });
});

describe('buildAnthropicRequest with allowedChartTypes', () => {
  const dataset = { columns: ['a'], rows: [{ a: 1 }] };

  it('passes allowed types through to the tool enum', () => {
    const req = buildAnthropicRequest('Q', dataset, ['bar', 'line']);
    const tool = req.tools[0];
    expect(tool.input_schema.properties.charts.items.properties.type.enum).toEqual(['bar', 'line']);
  });

  it('defaults to all three when no allowed types are given', () => {
    const req = buildAnthropicRequest('Q', dataset);
    const tool = req.tools[0];
    expect(tool.input_schema.properties.charts.items.properties.type.enum).toEqual(['bar', 'line', 'pie']);
  });
});

describe('query_dataset tool shape', () => {
  it('has the expected name and required fields', () => {
    expect(QUERY_DATASET_TOOL.name).toBe('query_dataset');
    expect(QUERY_DATASET_TOOL.input_schema.required).toContain('limit');
  });

  it('declares filter ops and aggregator functions', () => {
    const props = QUERY_DATASET_TOOL.input_schema.properties as any;
    expect(props.filter.items.properties.op.enum).toEqual(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']);
    expect(props.aggregate.items.properties.fn.enum).toEqual(['sum', 'mean', 'count', 'min', 'max']);
    expect(props.direction.enum).toEqual(['asc', 'desc']);
  });

  it('description tells Claude when to use this vs the summary', () => {
    expect(QUERY_DATASET_TOOL.description).toContain('FULL');
    expect(QUERY_DATASET_TOOL.description).toContain('summary');
  });
});

describe('buildSummaryRequest', () => {
  const summary = {
    totalRows: 50_000,
    schema: [
      { name: 'region', type: 'categorical' },
      { name: 'revenue', type: 'numeric' },
    ],
    stats: {
      region: { type: 'categorical', count: 50000, nulls: 0, distinct: 4, top: [['North', 14201]] },
      revenue: { type: 'numeric', count: 50000, nulls: 0, min: 12, max: 8400, mean: 1842, sum: 92100000, p25: 540, p50: 1620, p75: 2880 },
    },
    groupBys: [{ by: 'region', metric: 'revenue', groups: [{ category: 'North', sum: 26000000, mean: 1830, count: 14201 }] }],
    sample: [{ region: 'North', revenue: 1234 }],
  };

  it('uses Sonnet 4.6 and lets Claude pick a tool (tool_choice: any)', () => {
    const req = buildSummaryRequest('Q', summary);
    expect(req.model).toBe('claude-sonnet-4-6');
    expect(req.tool_choice).toEqual({ type: 'any' });
  });

  it('exposes BOTH present_analysis and query_dataset tools', () => {
    const req = buildSummaryRequest('Q', summary);
    expect(req.tools).toHaveLength(2);
    const names = req.tools.map((t: any) => t.name);
    expect(names).toContain('present_analysis');
    expect(names).toContain('query_dataset');
  });

  it('system prompt explains both tools with examples', () => {
    const req = buildSummaryRequest('Q', summary);
    const sys = (req.system as any[]).map((b) => b.text).join('\n');
    expect(sys).toContain('present_analysis');
    expect(sys).toContain('query_dataset');
    expect(sys.toLowerCase()).toContain('summary');
    expect(sys.toLowerCase()).toContain('sample');
  });

  it('embeds the summary JSON in the user message and passes through the question', () => {
    const req = buildSummaryRequest('What is the total revenue by region?', summary);
    const blocks = req.messages[0].content as any[];
    const summaryBlock = blocks.find((b) => b.text.includes('"totalRows"'));
    expect(summaryBlock).toBeDefined();
    expect(summaryBlock.text).toContain('"totalRows":50000');
    expect(summaryBlock.text).toContain('"groupBys"');
    expect(summaryBlock.cache_control).toEqual({ type: 'ephemeral' });
    const questionBlock = blocks.find((b) => b.text?.startsWith('Question:'));
    expect(questionBlock.text).toContain('What is the total revenue by region?');
  });

  it('passes allowedChartTypes through to the present_analysis tool enum', () => {
    const req = buildSummaryRequest('Q', summary, ['pie']);
    const tool = req.tools.find((t: any) => t.name === 'present_analysis') as any;
    expect(tool.input_schema.properties.charts.items.properties.type.enum).toEqual(['pie']);
  });
});

describe('buildSummaryRequest with priorTurns', () => {
  const summary = {
    totalRows: 1000,
    schema: [{ name: 'x', type: 'numeric' }],
    stats: { x: { type: 'numeric', count: 1000, nulls: 0, min: 0, max: 100, mean: 50, sum: 50000, p25: 25, p50: 50, p75: 75 } },
    groupBys: [],
    sample: [],
  };

  it('with no priorTurns, messages contains just the initial user turn', () => {
    const req = buildSummaryRequest('Q', summary, ['bar', 'line', 'pie'], []);
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe('user');
  });

  it('with one priorTurn, appends assistant tool_use + user tool_result', () => {
    const priorTurns = [
      {
        toolUseId: 'toolu_abc123',
        toolInput: { sortBy: 'x', direction: 'desc', limit: 5 },
        toolResult: { rows: [{ x: 99 }, { x: 98 }], totalMatched: 1000, truncated: true },
      },
    ];
    const req = buildSummaryRequest('Q', summary, ['bar', 'line', 'pie'], priorTurns);
    expect(req.messages).toHaveLength(3);

    const [first, second, third] = req.messages;
    expect(first.role).toBe('user');

    expect(second.role).toBe('assistant');
    const useBlocks = second.content as any[];
    expect(useBlocks[0].type).toBe('tool_use');
    expect(useBlocks[0].id).toBe('toolu_abc123');
    expect(useBlocks[0].name).toBe('query_dataset');
    expect(useBlocks[0].input).toEqual({ sortBy: 'x', direction: 'desc', limit: 5 });

    expect(third.role).toBe('user');
    const resultBlocks = third.content as any[];
    expect(resultBlocks[0].type).toBe('tool_result');
    expect(resultBlocks[0].tool_use_id).toBe('toolu_abc123');
    const parsed = JSON.parse(resultBlocks[0].content);
    expect(parsed.totalMatched).toBe(1000);
    expect(parsed.rows[0].x).toBe(99);
  });

  it('with multiple priorTurns, alternates assistant/user blocks in order', () => {
    const priorTurns = [
      { toolUseId: 't1', toolInput: { limit: 5 }, toolResult: { rows: [], totalMatched: 0, truncated: false } },
      { toolUseId: 't2', toolInput: { limit: 10 }, toolResult: { rows: [{ x: 1 }], totalMatched: 1, truncated: false } },
    ];
    const req = buildSummaryRequest('Q', summary, ['bar', 'line', 'pie'], priorTurns);
    // 1 initial + 2 turns × 2 messages = 5 messages
    expect(req.messages).toHaveLength(5);
    expect(req.messages[0].role).toBe('user');
    expect(req.messages[1].role).toBe('assistant');
    expect(req.messages[2].role).toBe('user');
    expect(req.messages[3].role).toBe('assistant');
    expect(req.messages[4].role).toBe('user');
    expect(((req.messages[1].content as any[])[0]).id).toBe('t1');
    expect(((req.messages[3].content as any[])[0]).id).toBe('t2');
  });
});
