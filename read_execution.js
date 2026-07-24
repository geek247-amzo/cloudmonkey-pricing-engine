const { parse } = require('flatted');
const Database = require('better-sqlite3');
const db = new Database('/tmp/n8n.sqlite');
const row = db.prepare('SELECT data FROM execution_data ORDER BY executionId DESC LIMIT 1').get();
const parsed = parse(row.data);
const runData = parsed.resultData.runData;

const executedNodes = Object.keys(runData).map(nodeName => {
  const nodeRun = runData[nodeName][0];
  return {
    node: nodeName,
    error: nodeRun.error ? nodeRun.error.message : null,
    outputLength: nodeRun.data.main[0] ? nodeRun.data.main[0].length : 0
  };
});

console.log(JSON.stringify(executedNodes, null, 2));
