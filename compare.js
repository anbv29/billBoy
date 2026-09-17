const { run } = require('./billboy');

async function main() {
  const [, , previous, current] = process.argv;
  if (!previous || !current || process.argv.length !== 4) {
    console.error('Usage: node compare.js "last-month.pdf" "this-month.pdf"');
    process.exitCode = 2;
    return;
  }
  try {
    const result = await run(previous, current, process.env.OPENROUTER_API_KEY);
    console.log(result.duplicate ? 'These files were already compared; no API call was made.' :
      'Comparison complete.');
    console.log(result.report.comparison.explanation);
    console.log('Full report: ' + result.markdownPath);
  } catch (error) {
    console.error('BillBoy: ' + error.message);
    process.exitCode = 1;
  }
}

main();
