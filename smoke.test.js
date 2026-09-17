const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ROOT, billFromFile, makeRequest, extractBills, compareBills, numberOrNull, markdownReport, run } = require('./billboy');

const previous = {
  provider: 'City Power', period: 'August', currency: 'INR', total: '₹2,520',
  usage: '220', usage_unit: 'kWh', breakdown_visible: true,
  charges: [{ label: 'Energy', amount: '2100' }, { label: 'Tax', amount: '420' }]
};
const current = {
  provider: 'City Power', period: 'September', currency: 'INR', total: '₹3,180',
  usage: '225', usage_unit: 'kWh', breakdown_visible: true,
  charges: [
    { label: 'Energy', amount: '2180' }, { label: 'Tax', amount: '420' },
    { label: 'Fuel surcharge', amount: '580' }
  ]
};
const previousImage = { name: 'old.png', mimeType: 'image/png', data: 'AQID' };
const currentImage = { name: 'new.jpg', mimeType: 'image/jpeg', data: 'BAUG' };

test('screenshots use free NVIDIA vision before free Nemotron text comparison', async () => {
  const request = makeRequest(
    { name: 'old.png', mimeType: 'text/plain', text: 'old bill text' },
    { name: 'new.jpg', mimeType: 'text/plain', text: 'new bill text' }
  );
  assert.equal(request.model, 'nvidia/nemotron-3-ultra-550b-a55b:free');
  assert.equal(request.plugins, undefined);
  assert.equal(request.messages[0].content.filter(part => part.type === 'text').length, 4);
  assert.match(request.messages[0].content[0].text, /PREVIOUS MONTH/);
  assert.equal(request.response_format, undefined);
  let calls = 0;
  const fakeFetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    if (body.model.includes('nano-omni')) {
      assert.match(body.messages[0].content[1].image_url.url, /^data:image\/(png|jpeg);base64,/);
      return { ok: true, text: async () => JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: 'Transcribed bill text' } }],
        usage: { prompt_tokens: 100 }
      }) };
    }
    assert.equal(body.model, 'nvidia/nemotron-3-ultra-550b-a55b:free');
    assert.match(body.messages[0].content[3].text, /Transcribed bill text/);
    return { ok: true, text: async () => JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ previous, current }) } }],
      usage: { prompt_tokens: 1200, completion_tokens: 180,
        completion_tokens_details: { reasoning_tokens: 60 } }
    }) };
  };
  const result = await extractBills(previousImage, currentImage, 'test-key', fakeFetch);
  assert.equal(result.extracted.current.total, '₹3,180');
  assert.equal(result.usage.promptTokenCount, 1400);
  assert.equal(calls, 3);
});

test('arithmetic identifies the total, usage, and printed surcharge change', () => {
  const result = compareBills(previous, current);
  assert.equal(result.difference, 660);
  assert.equal(result.percentChange, 26.19);
  assert.equal(result.usageDifference, 5);
  assert.match(result.explanation, /Fuel surcharge/);
  assert.equal(numberOrNull('₹2,520.00'), 2520);
});

test('unstructured Nemotron output is rejected instead of becoming a report', async () => {
  const pdf = { name: 'sample.pdf', mimeType: 'application/pdf', data: 'AQID' };
  const fakeFetch = async () => ({ ok: true, text: async () => JSON.stringify({
    choices: [{ finish_reason: 'stop', message: { content: 'I found a bill but cannot format it.' } }]
  }) });
  await assert.rejects(() => extractBills(pdf, pdf, 'test-key', fakeFetch),
    /Nemotron did not return usable bill JSON/);
});

test('an incomplete breakdown does not invent a cause', () => {
  const result = compareBills({ ...previous, breakdown_visible: false }, current);
  assert.equal(result.difference, 660);
  assert.match(result.explanation, /does not establish a specific cause/);
  assert.doesNotMatch(result.explanation, /Fuel surcharge/);
});

test('missing totals and mismatched bills are refused', () => {
  assert.throws(() => compareBills({ ...previous, total: '' }, current), /payable totals/);
  assert.throws(() => compareBills({ ...previous, provider: 'Other Power' }, current), /different providers/);
  assert.throws(() => compareBills({ ...previous, currency: 'USD' }, current), /currency/);
});

test('report stays human-readable and includes token use', () => {
  const report = {
    comparison: compareBills(previous, current),
    sources: { previous: { name: 'old.png' }, current: { name: 'new.png' } },
    usage: { promptTokenCount: 1200, candidatesTokenCount: 180, thoughtsTokenCount: 60 }
  };
  const markdown = markdownReport(report);
  assert.match(markdown, /# BillBoy comparison/);
  assert.match(markdown, /input: 1200, output: 180, thinking: 60/);
});

test('local run writes reports inside billBoy and reuses a matching pair', async () => {
  const suffix = crypto.randomBytes(6).toString('hex');
  const previousName = 'test-' + suffix + '-previous.png';
  const currentName = 'test-' + suffix + '-current.png';
  const prefix = 'test-' + suffix;
  const files = [previousName, currentName, prefix + '.json', prefix + '.md'];
  const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  let calls = 0;
  try {
    fs.writeFileSync(path.join(ROOT, previousName), Buffer.concat([pngHeader, Buffer.from([1])]));
    fs.writeFileSync(path.join(ROOT, currentName), Buffer.concat([pngHeader, Buffer.from([2])]));
    const fakeFetch = async (_url, options) => {
      calls++;
      const model = JSON.parse(options.body).model;
      return { ok: true, text: async () => JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: model.includes('nano-omni') ?
          'Readable screenshot text' : JSON.stringify({ previous, current }) } }],
        usage: { prompt_tokens: 1200 }
      }) };
    };
    const first = await run(previousName, currentName, 'test-key', fakeFetch, prefix);
    assert.equal(first.duplicate, false);
    assert.equal(first.report.model, 'nvidia/nemotron-3-ultra-550b-a55b:free');
    assert.equal(first.report.ocrModel, 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free');
    assert.equal(first.report.comparison.difference, 660);
    assert.match(fs.readFileSync(path.join(ROOT, prefix + '.md'), 'utf8'), /Fuel surcharge/);
    const second = await run(previousName, currentName, '', fakeFetch, prefix);
    assert.equal(second.duplicate, true);
    assert.equal(calls, 3);
  } finally {
    for (const name of files) {
      const target = path.join(ROOT, name);
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
  }
});

test('two local PDF bills are sent as PDFs and produce a comparison', async () => {
  const suffix = crypto.randomBytes(6).toString('hex');
  const previousName = 'test-' + suffix + '-previous.pdf';
  const currentName = 'test-' + suffix + '-current.pdf';
  const prefix = 'test-' + suffix;
  const files = [previousName, currentName, prefix + '.json', prefix + '.md'];
  try {
    fs.writeFileSync(path.join(ROOT, previousName), '%PDF-1.4\nprevious\n%%EOF');
    fs.writeFileSync(path.join(ROOT, currentName), '%PDF-1.4\ncurrent\n%%EOF');
    assert.equal(billFromFile(previousName).mimeType, 'application/pdf');
    const fakeFetch = async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.equal(request.model, 'nvidia/nemotron-3-ultra-550b-a55b:free');
      assert.deepEqual(request.plugins, [{ id: 'file-parser', pdf: { engine: 'cloudflare-ai' } }]);
      assert.equal(request.response_format, undefined);
      const parts = request.messages[0].content;
      assert.deepEqual(parts.filter(part => part.type === 'file')
        .map(part => part.file.filename), [previousName, currentName]);
      assert.ok(parts.filter(part => part.type === 'file')
        .every(part => part.file.file_data.startsWith('data:application/pdf;base64,')));
      return { ok: true, text: async () => JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ previous, current }) } }]
      }) };
    };
    const result = await run(previousName, currentName, 'test-key', fakeFetch, prefix);
    assert.equal(result.report.comparison.difference, 660);
    assert.match(fs.readFileSync(path.join(ROOT, prefix + '.md'), 'utf8'), /Previous bill/);
  } finally {
    for (const name of files) {
      const target = path.join(ROOT, name);
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
  }
});
