import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildRequestBody, resolveLLMConfig } from './llm-provider.js';
import {
  buildEvaluationBatchData,
  buildEvaluationMessages,
  buildEvaluationPrompt,
  buildValidCategoriesString,
} from './evaluation-prompt.js';
import { sanitizeDescription, shouldBlockProject } from './project-filters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFile = path.join(__dirname, '../data/projects.json');
const queueFile = path.join(__dirname, '../data/pending-projects.json');
const defaultOutputDir = path.join(__dirname, '../.omx/sensitive-word-debug');

const { provider: LLM_PROVIDER, baseUrl: LLM_BASE_URL, apiKey: LLM_API_KEY, model: LLM_MODEL } = resolveLLMConfig();

function printHelp() {
  console.log(`Usage:
  node scripts/locate-sensitive-words.js --debug .omx/sensitive-word-debug/sensitive-...json --steps 4
  node scripts/locate-sensitive-words.js --queue 5 --steps 3
  node scripts/locate-sensitive-words.js --file suspect.txt --strategy words --steps 8
  cat suspect.txt | node scripts/locate-sensitive-words.js --stdin --strategy lines --steps 5

Options:
  --debug <file>          Load a debug JSON emitted by discover-and-evaluate.js.
  --file <file>           Load raw text, a debug JSON, or a previous bisect JSON.
  --stdin                 Read raw text from stdin.
  --text <text>           Diagnose this literal text.
  --queue [count]         Rebuild an evaluation prompt from pending-projects.json.
  --offset <n>            Queue offset for --queue. Default: 0.
  --steps <n>             Number of binary narrowing rounds. Default: 6.
  --strategy <name>       auto, projects, lines, words, or chars. Default: auto.
  --content-key <key>     For debug JSON: auto, prompt, batchData, batch, or requestBody.
  --delay-ms <n>          Delay between LLM probes. Default: 0.
  --out-dir <dir>         Output directory for suspect files.
  --print-chars <n>       Print this many chars of the final suspect text. Default: 4000.
  --skip-full-check       Do not probe the full input before bisecting.
  --help                  Show this help.
`);
}

function readJson(filePath, defaultValue = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return defaultValue;
  }
}

function parseArgs(argv) {
  const opts = {
    steps: 6,
    strategy: 'auto',
    contentKey: 'auto',
    offset: 0,
    delayMs: 0,
    outDir: defaultOutputDir,
    printChars: 4000,
    skipFullCheck: false,
  };

  const valueOptions = new Set([
    'debug',
    'file',
    'text',
    'steps',
    'strategy',
    'content-key',
    'offset',
    'delay-ms',
    'out-dir',
    'print-chars',
  ]);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '--stdin') {
      opts.stdin = true;
      continue;
    }
    if (arg === '--skip-full-check') {
      opts.skipFullCheck = true;
      continue;
    }
    if (arg === '--queue') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        opts.queue = Number(next);
        i++;
      } else {
        opts.queue = true;
      }
      continue;
    }
    if (arg.startsWith('--queue=')) {
      opts.queue = Number(arg.slice('--queue='.length));
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const eqIndex = arg.indexOf('=');
    const rawName = arg.slice(2, eqIndex === -1 ? undefined : eqIndex);
    if (!valueOptions.has(rawName)) {
      throw new Error(`Unknown option: --${rawName}`);
    }

    const value = eqIndex === -1 ? argv[++i] : arg.slice(eqIndex + 1);
    if (value === undefined) {
      throw new Error(`Missing value for --${rawName}`);
    }

    const key = rawName.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    opts[key] = value;
  }

  opts.steps = Number(opts.steps);
  opts.offset = Number(opts.offset);
  opts.delayMs = Number(opts.delayMs);
  opts.printChars = Number(opts.printChars);

  if (!Number.isInteger(opts.steps) || opts.steps < 0) {
    throw new Error('--steps must be a non-negative integer.');
  }
  if (!Number.isInteger(opts.offset) || opts.offset < 0) {
    throw new Error('--offset must be a non-negative integer.');
  }
  if (!Number.isFinite(opts.delayMs) || opts.delayMs < 0) {
    throw new Error('--delay-ms must be a non-negative number.');
  }
  if (!['auto', 'projects', 'lines', 'words', 'chars'].includes(opts.strategy)) {
    throw new Error('--strategy must be auto, projects, lines, words, or chars.');
  }
  if (!['auto', 'prompt', 'batchData', 'batch', 'requestBody'].includes(opts.contentKey)) {
    throw new Error('--content-key must be auto, prompt, batchData, batch, or requestBody.');
  }

  return opts;
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function extractValidCategoriesString(prompt = '') {
  const marker = 'Valid Categories and their Subcategories:\n';
  const start = prompt.indexOf(marker);
  if (start === -1) return '';
  const bodyStart = start + marker.length;
  const end = prompt.indexOf('\n\nFor each project', bodyStart);
  return prompt.slice(bodyStart, end === -1 ? undefined : end).trim();
}

function normalizePendingDb(value) {
  return value && Array.isArray(value.queue) ? value : { queue: [] };
}

function normalizeProjectDb(value) {
  return value && Array.isArray(value.categories) ? value : { categories: [] };
}

async function readStdin() {
  return await new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function buildContextFromQueue(opts) {
  const pendingDb = normalizePendingDb(readJson(queueFile, { queue: [] }));
  const projectDb = normalizeProjectDb(readJson(dataFile, { categories: [] }));
  const limit = opts.queue === true ? Number(process.env.EVALUATE_BATCH_SIZE || 5) : Number(opts.queue);

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('--queue count must be a positive integer.');
  }

  const rawBatch = pendingDb.queue.slice(opts.offset, opts.offset + limit);
  if (rawBatch.length === 0) {
    throw new Error(`No pending projects found at offset ${opts.offset}.`);
  }

  const batch = [];
  for (const item of rawBatch) {
    const blockCheck = shouldBlockProject(item);
    if (blockCheck.blocked) continue;
    batch.push({
      ...item,
      description: sanitizeDescription(item.description),
    });
  }

  if (batch.length === 0) {
    throw new Error('The selected queue range is empty after local project filters.');
  }

  const batchData = buildEvaluationBatchData(batch);
  const validCategoriesStr = buildValidCategoriesString(projectDb.categories);

  return {
    source: `queue:${opts.offset}:${limit}`,
    mode: 'evaluation',
    batchData,
    validCategoriesStr,
    prompt: buildEvaluationPrompt(batchData, validCategoriesStr),
  };
}

function buildContextFromDebugObject(debugObject, source, opts) {
  const contentKey = opts.contentKey;

  if (debugObject?.kind === 'sensitive-bisect-result') {
    if (Array.isArray(debugObject.batchData) && debugObject.validCategoriesStr) {
      return {
        source,
        mode: 'evaluation',
        batchData: debugObject.batchData,
        validCategoriesStr: debugObject.validCategoriesStr,
        prompt: buildEvaluationPrompt(debugObject.batchData, debugObject.validCategoriesStr),
      };
    }
    return {
      source,
      mode: 'raw',
      text: String(debugObject.candidateText || debugObject.prompt || ''),
    };
  }

  if ((contentKey === 'auto' || contentKey === 'batchData') && Array.isArray(debugObject?.batchData)) {
    const validCategoriesStr = debugObject.validCategoriesStr || extractValidCategoriesString(debugObject.prompt || '');
    if (!validCategoriesStr) {
      throw new Error('Debug JSON has batchData but no categories section in prompt.');
    }
    return {
      source,
      mode: 'evaluation',
      batchData: debugObject.batchData,
      validCategoriesStr,
      prompt: buildEvaluationPrompt(debugObject.batchData, validCategoriesStr),
    };
  }

  if (contentKey === 'batch' && Array.isArray(debugObject?.batch)) {
    const validCategoriesStr = debugObject.validCategoriesStr || extractValidCategoriesString(debugObject.prompt || '');
    if (!validCategoriesStr) {
      throw new Error('Debug JSON has batch but no categories section in prompt.');
    }
    const batchData = buildEvaluationBatchData(debugObject.batch);
    return {
      source,
      mode: 'evaluation',
      batchData,
      validCategoriesStr,
      prompt: buildEvaluationPrompt(batchData, validCategoriesStr),
    };
  }

  if ((contentKey === 'auto' || contentKey === 'prompt') && typeof debugObject?.prompt === 'string') {
    return {
      source,
      mode: 'raw',
      text: debugObject.prompt,
    };
  }

  if (contentKey === 'requestBody' && debugObject?.requestBody) {
    return {
      source,
      mode: 'raw',
      text: JSON.stringify(debugObject.requestBody, null, 2),
    };
  }

  throw new Error(`Could not find usable content in ${source}.`);
}

function buildContextFromText(text, source, opts) {
  const parsed = parseMaybeJson(text);

  if (parsed && typeof parsed === 'object') {
    if (!Array.isArray(parsed)) {
      try {
        return buildContextFromDebugObject(parsed, source, opts);
      } catch (e) {
        if (opts.contentKey !== 'auto') throw e;
      }
    }

    const projectDb = normalizeProjectDb(readJson(dataFile, { categories: [] }));
    const looksLikeBatchData = parsed.every(item => item && typeof item === 'object' && 'name' in item);
    if (looksLikeBatchData) {
      const batchData = parsed.every(item => 'id' in item && 'topics' in item)
        ? parsed
        : buildEvaluationBatchData(parsed);
      const validCategoriesStr = buildValidCategoriesString(projectDb.categories);
      return {
        source,
        mode: 'evaluation',
        batchData,
        validCategoriesStr,
        prompt: buildEvaluationPrompt(batchData, validCategoriesStr),
      };
    }
  }

  return {
    source,
    mode: 'raw',
    text,
  };
}

async function buildInputContext(opts) {
  if (opts.debug) {
    const filePath = path.resolve(opts.debug);
    return buildContextFromText(fs.readFileSync(filePath, 'utf-8'), filePath, opts);
  }
  if (opts.file) {
    const filePath = path.resolve(opts.file);
    return buildContextFromText(fs.readFileSync(filePath, 'utf-8'), filePath, opts);
  }
  if (opts.text !== undefined) {
    return buildContextFromText(String(opts.text), '--text', opts);
  }
  if (opts.stdin) {
    return buildContextFromText(await readStdin(), 'stdin', opts);
  }
  if (opts.queue !== undefined) {
    return buildContextFromQueue(opts);
  }

  throw new Error('No input source was provided.');
}

function splitRawText(text, strategy) {
  if (strategy === 'lines') {
    return text.match(/[^\n]*(?:\n|$)/g).filter(Boolean);
  }
  if (strategy === 'words') {
    return text.match(/\S+\s*/g) || [];
  }
  if (strategy === 'chars') {
    return Array.from(text);
  }

  const lines = text.match(/[^\n]*(?:\n|$)/g).filter(Boolean);
  if (lines.length > 1) return lines;
  const words = text.match(/\S+\s*/g) || [];
  if (words.length > 1) return words;
  return Array.from(text);
}

function prepareBisectSubject(context, strategy) {
  const effectiveStrategy = strategy === 'auto'
    ? (context.mode === 'evaluation' ? 'projects' : 'auto')
    : strategy;

  if (context.mode === 'evaluation' && effectiveStrategy === 'projects') {
    return {
      unitKind: 'projects',
      units: context.batchData,
      renderProbeText: units => buildEvaluationPrompt(units, context.validCategoriesStr),
      renderCandidateText: units => JSON.stringify(units, null, 2),
      batchData: context.batchData,
      validCategoriesStr: context.validCategoriesStr,
    };
  }

  const rawText = context.mode === 'evaluation' ? context.prompt : context.text;
  const rawStrategy = effectiveStrategy === 'projects' ? 'auto' : effectiveStrategy;
  const units = splitRawText(rawText, rawStrategy);
  return {
    unitKind: rawStrategy,
    units,
    renderProbeText: units => units.join(''),
    renderCandidateText: units => units.join(''),
  };
}

function parseLLMErrorPayload(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function hasSensitiveWordsMarker(...values) {
  return values.some(value => String(value || '').includes('sensitive_words_detected'));
}

async function sleep(ms) {
  if (!ms) return;
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function probeText(text, delayMs) {
  await sleep(delayMs);

  const messages = [
    { role: 'system', content: 'Return only {"ok":true} as JSON.' },
    { role: 'user', content: text },
  ];
  const body = buildRequestBody(LLM_PROVIDER, LLM_MODEL, messages, {
    temperature: 0,
    responseFormat: { type: 'json_object' },
  });

  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const responseText = await res.text();
    const responseJson = parseLLMErrorPayload(responseText);
    if (hasSensitiveWordsMarker(responseJson?.error?.code, responseJson?.error?.message, responseText)) {
      return {
        sensitive: true,
        status: res.status,
        statusText: res.statusText,
        responseText,
      };
    }

    throw new Error(`LLM API error: ${res.status} ${res.statusText} - ${responseText}`);
  }

  await res.text();
  return {
    sensitive: false,
    status: res.status,
    statusText: res.statusText,
  };
}

async function probeEvaluationPrompt(prompt, delayMs) {
  await sleep(delayMs);

  const body = buildRequestBody(LLM_PROVIDER, LLM_MODEL, buildEvaluationMessages(prompt), {
    temperature: 0.1,
    responseFormat: { type: 'json_object' },
  });

  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const responseText = await res.text();
    const responseJson = parseLLMErrorPayload(responseText);
    if (hasSensitiveWordsMarker(responseJson?.error?.code, responseJson?.error?.message, responseText)) {
      return {
        sensitive: true,
        status: res.status,
        statusText: res.statusText,
        responseText,
      };
    }

    throw new Error(`LLM API error: ${res.status} ${res.statusText} - ${responseText}`);
  }

  await res.text();
  return {
    sensitive: false,
    status: res.status,
    statusText: res.statusText,
  };
}

function unitStats(subject, units) {
  const probeText = subject.renderProbeText(units);
  return {
    units: units.length,
    chars: probeText.length,
  };
}

async function probeUnits(subject, units, delayMs) {
  const probeTextValue = subject.renderProbeText(units);
  if (subject.unitKind === 'projects') {
    return await probeEvaluationPrompt(probeTextValue, delayMs);
  }
  return await probeText(probeTextValue, delayMs);
}

async function runBisect(subject, opts) {
  let current = subject.units;
  const steps = [];
  let stopReason = '';

  if (current.length === 0) {
    throw new Error('Input content is empty after splitting.');
  }

  if (!opts.skipFullCheck) {
    const result = await probeUnits(subject, current, opts.delayMs);
    console.log(`[full] sensitive=${result.sensitive} units=${current.length} chars=${unitStats(subject, current).chars}`);
    if (!result.sensitive) {
      stopReason = 'full input did not trigger sensitive_words_detected';
      return { current, steps, stopReason, fullSensitive: false };
    }
  }

  for (let step = 1; step <= opts.steps; step++) {
    if (current.length <= 1) {
      stopReason = 'only one unit remains';
      break;
    }

    const mid = Math.ceil(current.length / 2);
    const left = current.slice(0, mid);
    const right = current.slice(mid);
    const leftStats = unitStats(subject, left);
    const rightStats = unitStats(subject, right);

    console.log(`[step ${step}] test left: units=${leftStats.units} chars=${leftStats.chars}`);
    const leftResult = await probeUnits(subject, left, opts.delayMs);
    if (leftResult.sensitive) {
      steps.push({ step, chosen: 'left', left: leftStats, right: rightStats });
      current = left;
      console.log(`[step ${step}] choose left`);
      continue;
    }

    console.log(`[step ${step}] left clean; test right: units=${rightStats.units} chars=${rightStats.chars}`);
    const rightResult = await probeUnits(subject, right, opts.delayMs);
    if (rightResult.sensitive) {
      steps.push({ step, chosen: 'right', left: leftStats, right: rightStats });
      current = right;
      console.log(`[step ${step}] choose right`);
      continue;
    }

    steps.push({ step, chosen: 'combined-only', left: leftStats, right: rightStats });
    stopReason = 'neither half triggered alone; the trigger may require combined context';
    console.log(`[step ${step}] neither half triggered alone; stop`);
    break;
  }

  if (!stopReason) {
    stopReason = `completed ${opts.steps} step(s)`;
  }

  return { current, steps, stopReason, fullSensitive: true };
}

function writeResultFiles(context, subject, result, opts) {
  fs.mkdirSync(opts.outDir, { recursive: true });
  const timestamp = new Date().toISOString();
  const fileStamp = timestamp.replace(/[:.]/g, '-');
  const basePath = path.join(opts.outDir, `bisect-${fileStamp}`);
  const candidateText = subject.renderCandidateText(result.current);
  const prompt = subject.renderProbeText(result.current);
  const resultJson = {
    kind: 'sensitive-bisect-result',
    createdAt: timestamp,
    source: context.source,
    provider: LLM_PROVIDER,
    baseUrl: LLM_BASE_URL,
    model: LLM_MODEL,
    unitKind: subject.unitKind,
    stopReason: result.stopReason,
    fullSensitive: result.fullSensitive,
    steps: result.steps,
    currentUnitCount: result.current.length,
    currentCharCount: prompt.length,
    candidateText,
    prompt,
  };

  if (subject.unitKind === 'projects') {
    resultJson.batchData = result.current;
    resultJson.validCategoriesStr = subject.validCategoriesStr;
  }

  const jsonFile = `${basePath}.json`;
  const candidateFile = `${basePath}.candidate.txt`;
  const promptFile = `${basePath}.prompt.txt`;

  fs.writeFileSync(jsonFile, JSON.stringify(resultJson, null, 2), 'utf-8');
  fs.writeFileSync(candidateFile, candidateText, 'utf-8');
  fs.writeFileSync(promptFile, prompt, 'utf-8');

  return { jsonFile, candidateFile, promptFile, candidateText, prompt };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const context = await buildInputContext(opts);
  const subject = prepareBisectSubject(context, opts.strategy);
  const stats = unitStats(subject, subject.units);

  console.log(`[init] source=${context.source}`);
  console.log(`[init] provider=${LLM_PROVIDER} model=${LLM_MODEL}`);
  console.log(`[init] mode=${context.mode} strategy=${opts.strategy} unitKind=${subject.unitKind}`);
  console.log(`[init] units=${stats.units} chars=${stats.chars} steps=${opts.steps}`);

  const result = await runBisect(subject, opts);
  const files = writeResultFiles(context, subject, result, opts);

  console.log(`[result] ${result.stopReason}`);
  console.log(`[result] units=${result.current.length} chars=${files.prompt.length}`);
  console.log(`[result] json=${files.jsonFile}`);
  console.log(`[result] candidate=${files.candidateFile}`);
  console.log(`[result] prompt=${files.promptFile}`);

  if (opts.printChars > 0) {
    const preview = files.candidateText.slice(0, opts.printChars);
    console.log('[candidate preview]');
    console.log(preview);
    if (files.candidateText.length > opts.printChars) {
      console.log(`[candidate preview truncated: ${files.candidateText.length - opts.printChars} chars omitted]`);
    }
  }
}

main().catch(err => {
  console.error(`[error] ${err.message}`);
  process.exitCode = 1;
});
