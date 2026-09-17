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
const previousImage = { mimeType: 'image/png', data: 'AQID' };
const currentImage = { mimeType: 'image/jpeg', data: 'BAUG' };

test('request sends two labelled images and expects structured records', async () => {
  const request = makeRequest(previousImage, currentImage);
  assert.equal(request.contents[0].parts.filter(part => part.inlineData).length, 2);
  assert.match(request.contents[0].parts[0].text, /PREVIOUS MONTH/);
  assert.equal(request.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(request.generationConfig.responseJsonSchema.required, ['previous', 'current']);
  const fakeFetch = async (_url, options) => {
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    assert.equal(JSON.parse(options.body).contents[0].parts[3].inlineData.mimeType, 'image/jpeg');
    return { ok: true, text: async () => JSON.stringify({
      candidates: [{ finishReason: 'STOP', content: { parts: [
        { text: JSON.stringify({ previous, current }) }
      ] } }],
      usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 180, thoughtsTokenCount: 60 }
    }) };
  };
  const result = await extractBills(previousImage, currentImage, 'test-key', fakeFetch);
  assert.equal(result.extracted.current.total, '₹3,180');
  assert.equal(result.usage.promptTokenCount, 1200);
});

test('arithmetic identifies the total, usage, and printed surcharge change', () => {
  const result = compareBills(previous, current);
  assert.equal(result.difference, 660);
  assert.equal(result.percentChange, 26.19);
  assert.equal(result.usageDifference, 5);
  assert.match(result.explanation, /Fuel surcharge/);
  assert.equal(numberOrNull('₹2,520.00'), 2520);
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
    const fakeFetch = async () => {
      calls++;
      return { ok: true, text: async () => JSON.stringify({
        candidates: [{ finishReason: 'STOP', content: { parts: [
          { text: JSON.stringify({ previous, current }) }
        ] } }],
        usageMetadata: { promptTokenCount: 1200 }
      }) };
    };
    const first = await run(previousName, currentName, 'test-key', fakeFetch, prefix);
    assert.equal(first.duplicate, false);
    assert.equal(first.report.model, 'gemini-3.5-flash-lite');
    assert.equal(first.report.comparison.difference, 660);
    assert.match(fs.readFileSync(path.join(ROOT, prefix + '.md'), 'utf8'), /Fuel surcharge/);
    const second = await run(previousName, currentName, '', fakeFetch, prefix);
    assert.equal(second.duplicate, true);
    assert.equal(calls, 1);
    const oldReport = JSON.parse(fs.readFileSync(path.join(ROOT, prefix + '.json'), 'utf8'));
    oldReport.model = 'another-model';
    fs.writeFileSync(path.join(ROOT, prefix + '.json'), JSON.stringify(oldReport));
    const third = await run(previousName, currentName, 'test-key', fakeFetch, prefix);
    assert.equal(third.duplicate, false);
    assert.equal(calls, 2);
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
      const parts = JSON.parse(options.body).contents[0].parts;
      assert.deepEqual(parts.filter(part => part.inlineData)
        .map(part => part.inlineData.mimeType), ['application/pdf', 'application/pdf']);
      return { ok: true, text: async () => JSON.stringify({
        candidates: [{ finishReason: 'STOP', content: { parts: [
          { text: JSON.stringify({ previous, current }) }
        ] } }]
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
