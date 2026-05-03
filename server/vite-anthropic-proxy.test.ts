import { describe, it, expect } from 'vitest';
import { buildAnthropicRequest, PRESENT_ANALYSIS_TOOL } from './vite-anthropic-proxy';

describe('buildAnthropicRequest', () => {
  const dataset = {
    columns: ['region', 'revenue'],
    rows: [{ region: 'North', revenue: 100 }, { region: 'South', revenue: 80 }],
  };

  it('uses the Haiku 4.5 model', () => {
    const req = buildAnthropicRequest('Total by region?', dataset);
    expect(req.model).toBe('claude-haiku-4-5-20251001');
  });

  it('includes a system message that names the tool', () => {
    const req = buildAnthropicRequest('Q', dataset);
    const sys = Array.isArray(req.system) ? req.system.map((b) => b.text).join('\n') : (req.system ?? '');
    expect(sys.toLowerCase()).toContain('present_analysis');
  });

  it('forces the present_analysis tool', () => {
    const req = buildAnthropicRequest('Q', dataset);
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'present_analysis' });
    expect(req.tools[0]).toBe(PRESENT_ANALYSIS_TOOL);
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
});
