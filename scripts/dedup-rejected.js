#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rejectedDir = path.join(__dirname, '../data/rejected-projects');
const pendingFile = path.join(__dirname, '../data/pending-projects.json');
const projectsFile = path.join(__dirname, '../data/projects.json');
const CHUNK_SIZE = 30000;

export function normalizeRepoUrl(url = '') {
  return String(url || '').trim().toLowerCase().replace(/\/+$/, '').replace(/\.git$/, '');
}

function parsePartNumber(fileName) {
  const match = fileName.match(/^rejected-part-(\d+)\.json$/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

export function listRejectedFiles(dir = rejectedDir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => {
      const diff = parsePartNumber(a) - parsePartNumber(b);
      return diff !== 0 ? diff : a.localeCompare(b);
    });
}

function parseTimestamp(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function toCleanEntry(item) {
  const entry = {
    name: item.name || '',
    url: String(item.url || item.html_url || '').trim(),
    description: item.description || '',
    topics: Array.isArray(item.topics) ? item.topics : [],
    rejected_at: item.rejected_at || new Date(0).toISOString(),
    reason: item.reason || '',
  };
  if (item.previous_category) {
    entry.previous_category = item.previous_category;
  }
  return entry;
}

function mergeEntries(existing, incoming) {
  const next = toCleanEntry(incoming);
  const keepIncoming = parseTimestamp(next.rejected_at) >= parseTimestamp(existing.rejected_at);
  const primary = keepIncoming ? next : existing;
  const fallback = keepIncoming ? existing : next;

  const merged = {
    name: primary.name || fallback.name,
    url: primary.url || fallback.url,
    description: primary.description || fallback.description,
    topics: primary.topics.length > 0 ? primary.topics : fallback.topics,
    rejected_at: primary.rejected_at || fallback.rejected_at,
    reason: primary.reason || fallback.reason,
  };
  const previousCategory = primary.previous_category || fallback.previous_category;
  if (previousCategory) {
    merged.previous_category = previousCategory;
  }
  return merged;
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function cleanPendingQueue(rejectedUrls, isDryRun) {
  if (!fs.existsSync(pendingFile)) return;

  const approvedUrls = new Set();
  if (fs.existsSync(projectsFile)) {
    const projectDb = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
    for (const category of projectDb.categories || []) {
      if (category.id === 'trending') continue;
      for (const project of category.projects || []) {
        const key = normalizeRepoUrl(project.url || project.html_url);
        if (key) approvedUrls.add(key);
      }
    }
  }

  const pendingDb = JSON.parse(fs.readFileSync(pendingFile, 'utf-8'));
  const queue = Array.isArray(pendingDb.queue) ? pendingDb.queue : [];
  const seenQueue = new Set();
  const kept = [];
  let removedRejected = 0;
  let removedApproved = 0;
  let removedDuplicate = 0;

  for (const item of queue) {
    const key = normalizeRepoUrl(item.html_url || item.url);
    if (!key || seenQueue.has(key)) {
      removedDuplicate++;
      continue;
    }
    if (approvedUrls.has(key)) {
      removedApproved++;
      continue;
    }
    if (rejectedUrls.has(key)) {
      removedRejected++;
      continue;
    }
    seenQueue.add(key);
    kept.push(item);
  }

  console.log(`\n🧹 [Pending Queue] 原始队列: ${queue.length} -> 清理后: ${kept.length} (剔除已拒绝: ${removedRejected}, 已收录: ${removedApproved}, 队列内重复: ${removedDuplicate})`);
  if (!isDryRun && kept.length !== queue.length) {
    const tmpFile = `${pendingFile}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify({ ...pendingDb, queue: kept }, null, 2), 'utf-8');
    fs.renameSync(tmpFile, pendingFile);
    console.log('✅ 已更新 data/pending-projects.json');
  }
}

function run() {
  const isDryRun = process.argv.includes('--dry-run');
  const shouldCleanPending = process.argv.includes('--clean-pending');

  const files = listRejectedFiles(rejectedDir);
  if (files.length === 0) {
    console.log('⚠️ 未找到任何 rejected-projects 分片文件。');
    return;
  }

  let totalBefore = 0;
  let missingUrlCount = 0;
  let bytesBefore = 0;
  const uniqueMap = new Map();

  for (const file of files) {
    const filePath = path.join(rejectedDir, file);
    bytesBefore += fs.statSync(filePath).size;
    // 若任意分片损坏则直接抛错中止，避免误删旧分片导致数据丢失
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const entries = Array.isArray(content.rejected) ? content.rejected : [];
    totalBefore += entries.length;

    for (const item of entries) {
      const key = normalizeRepoUrl(item.url || item.html_url);
      if (!key) {
        missingUrlCount++;
        continue;
      }
      const existing = uniqueMap.get(key);
      uniqueMap.set(key, existing ? mergeEntries(existing, item) : toCleanEntry(item));
    }
  }

  const deduped = Array.from(uniqueMap.values());
  const numParts = Math.max(1, Math.ceil(deduped.length / CHUNK_SIZE));
  const duplicateCount = totalBefore - deduped.length - missingUrlCount;

  console.log('📊 [Rejected Projects Deduplication]');
  console.log(`- 扫描分片数: ${files.length} (${formatBytes(bytesBefore)})`);
  console.log(`- 原始记录数: ${totalBefore}`);
  console.log(`- 去重后记录: ${deduped.length}`);
  console.log(`- 移除重复项: ${duplicateCount}${missingUrlCount > 0 ? ` (另跳过无URL项: ${missingUrlCount})` : ''}`);
  console.log(`- 目标分片数: ${numParts} (每片上限 ${CHUNK_SIZE} 条)`);

  if (isDryRun) {
    if (shouldCleanPending) cleanPendingQueue(uniqueMap, true);
    console.log('\nℹ️  当前为 --dry-run 预览模式，未修改任何磁盘文件。');
    return;
  }

  // 先写 .tmp 再原子替换，全部写完后再清理多余分片，确保中断安全
  const keepFiles = new Set();
  let bytesAfter = 0;

  for (let i = 0; i < numParts; i++) {
    const chunk = deduped.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const fileName = `rejected-part-${i + 1}.json`;
    const targetPath = path.join(rejectedDir, fileName);
    const tmpPath = `${targetPath}.tmp`;

    fs.writeFileSync(tmpPath, JSON.stringify({ rejected: chunk }, null, 2), 'utf-8');
    fs.renameSync(tmpPath, targetPath);
    bytesAfter += fs.statSync(targetPath).size;
    keepFiles.add(fileName);
  }

  let removedFiles = 0;
  for (const file of files) {
    if (!keepFiles.has(file)) {
      fs.unlinkSync(path.join(rejectedDir, file));
      removedFiles++;
    }
  }

  const savedPercent = bytesBefore > 0 ? (((bytesBefore - bytesAfter) / bytesBefore) * 100).toFixed(1) : '0.0';
  console.log(`\n✅ 去重完成！已写入 ${numParts} 个分片 (${formatBytes(bytesAfter)})，清理旧分片 ${removedFiles} 个，节省空间 ${savedPercent}%。`);

  if (shouldCleanPending) {
    cleanPendingQueue(uniqueMap, false);
  }
}

if (process.argv[1] === __filename) {
  run();
}
