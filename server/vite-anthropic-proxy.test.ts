import { describe, it, expect } from 'vitest';
import { buildAnthropicRequest, buildSummaryRequest, presentAnalysisTool, PRESENT_ANALYSIS_TOOL } from './vite-anthropic-proxy';

describe('buildAnthropicRequest', () => {
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

  it('forces the present_analysis tool', () => {
    const req = buildAnthropicRequest('Q', dataset);
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'present_analysis' });
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

  it('declares a present_analysis tool with the right shape', () => {
    expect(PRESENT_ANALYSIS_TOOL.name).toBe('present_analysis');
    const props = PRESENT_ANALYSIS_TOOL.input_schema.properties;
    expect(props.insight.type).toBe('string');
    expect(props.charts.type).toBe('array');
    expect(props.charts.maxItems).toBe(4);
  });

  it('default tool enum includes all three chart types', () => {
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

describe('buildSummaryRequest with allowedChartTypes', () => {
  const summary = {
    totalRows: 1000,
    schema: [{ name: 'a', type: 'numeric' }],
    stats: { a: { type: 'numeric', count: 1000, nulls: 0, min: 0, max: 100, mean: 50, sum: 50000, p25: 25, p50: 50, p75: 75 } },
    groupBys: [],
    sample: [],
  };

  it('passes allowed types through to the tool enum', () => {
    const req = buildSummaryRequest('Q', summary, ['pie']);
    const tool = req.tools[0];
    expect(tool.input_schema.properties.charts.items.properties.type.enum).toEqual(['pie']);
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

  it('uses the Sonnet 4.6 model and forces the tool', () => {
    const req = buildSummaryRequest('Q', summary);
    expect(req.model).toBe('claude-sonnet-4-6');
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'present_analysis' });
  });

  it('includes a system prompt that explains summary mode and warns about row-level questions', () => {
    const req = buildSummaryRequest('Q', summary);
    const sys = (req.system as any[]).map((b) => b.text).join('\n');
    expect(sys).toContain('summary');
    expect(sys.toLowerCase()).toContain('sample');
    expect(sys).toContain('groupBys');
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
});
