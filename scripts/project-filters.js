import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const MAX_DESCRIPTION_LENGTH = 1200;
const BLOCKED_OWNER_HASHES = new Set([
  '35da9d414d581761515118f0890eb5ad28f54d2252e9f59e3a01a59d56d8d971',
]);
const DEFAULT_BLOCKLIST_DIR = path.resolve(process.cwd(), 'data/local-blocklists');
const listCache = new Map();

function envList(name) {
  return String(process.env[name] || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

function configuredListPath(name, defaultFileName) {
  const configuredPath = String(process.env[name] || '').trim();
  return configuredPath || path.join(DEFAULT_BLOCKLIST_DIR, defaultFileName);
}

function fileList(name, defaultFileName) {
  const filePath = path.resolve(configuredListPath(name, defaultFileName));
  if (listCache.has(filePath)) return listCache.get(filePath);
  if (!fs.existsSync(filePath)) {
    listCache.set(filePath, []);
    return [];
  }

  const values = fs.readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .map(line => line.replace(/#.*$/, '').trim().toLowerCase())
    .filter(Boolean);

  listCache.set(filePath, values);
  return values;
}

function configuredBlockedOwners() {
  return new Set([
    ...envList('BLOCKED_GITHUB_OWNERS'),
    ...fileList('BLOCKED_GITHUB_OWNERS_FILE', 'github-owners.txt'),
  ]);
}

function configuredBlockedTerms() {
  return [
    ...envList('BLOCKED_REPO_TERMS'),
    ...fileList('BLOCKED_REPO_TERMS_FILE', 'repo-terms.txt'),
  ];
}

function parseGithubUrl(url = '') {
  const match = String(url).match(/github\.com\/([^/\s]+)\/([^/#?\s]+)/i);
  if (!match) return { owner: '', repo: '' };
  return {
    owner: match[1].toLowerCase(),
    repo: match[2].replace(/\.git$/i, '').toLowerCase(),
  };
}

function sha256(value = '') {
  return crypto.createHash('sha256').update(String(value).toLowerCase()).digest('hex');
}

function isBlockedOwner(owner = '') {
  if (!owner) return false;
  if (configuredBlockedOwners().has(owner)) return true;
  return BLOCKED_OWNER_HASHES.has(sha256(owner));
}

function parseRepoIdentity(item = {}) {
  const urlParts = parseGithubUrl(item.html_url || item.url || '');
  if (urlParts.owner) return urlParts;

  if (item.full_name && String(item.full_name).includes('/')) {
    const [owner, repo] = String(item.full_name).split('/');
    return {
      owner: owner.toLowerCase(),
      repo: (repo || '').replace(/\.git$/i, '').toLowerCase(),
    };
  }

  return { owner: '', repo: String(item.name || '').toLowerCase() };
}

function hasSuspiciousDescription(description = '') {
  const text = String(description || '');
  if (text.length > MAX_DESCRIPTION_LENGTH) {
    return {
      suspicious: true,
      reason: `Description exceeds ${MAX_DESCRIPTION_LENGTH} characters`,
    };
  }

  const normalizedText = text.toLowerCase();
  const matchedTerm = configuredBlockedTerms().find(term => normalizedText.includes(term));
  if (matchedTerm) {
    return {
      suspicious: true,
      reason: 'Description matches configured blocked metadata term',
    };
  }

  return { suspicious: false, reason: '' };
}

function shouldBlockProject(item = {}) {
  const { owner, repo } = parseRepoIdentity(item);
  if (isBlockedOwner(owner)) {
    return {
      blocked: true,
      reason: 'Blocked by configured GitHub owner',
    };
  }

  const searchableMetadata = [
    owner,
    repo,
    item.full_name,
    item.html_url,
    item.url,
    item.name,
  ].join(' ').toLowerCase();
  const matchedTerm = configuredBlockedTerms().find(term => searchableMetadata.includes(term));
  if (matchedTerm) {
    return {
      blocked: true,
      reason: 'Blocked by configured repository metadata term',
    };
  }

  const descriptionCheck = hasSuspiciousDescription(item.description);
  if (descriptionCheck.suspicious) {
    return {
      blocked: true,
      reason: descriptionCheck.reason,
    };
  }

  return { blocked: false, reason: '' };
}

function sanitizeDescription(description = '') {
  const text = String(description || '').replace(/\s+/g, ' ').trim();
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
  return text.slice(0, MAX_DESCRIPTION_LENGTH).trim();
}

export {
  MAX_DESCRIPTION_LENGTH,
  parseGithubUrl,
  parseRepoIdentity,
  sanitizeDescription,
  shouldBlockProject,
};
