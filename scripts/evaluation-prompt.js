import { parseGithubUrl } from './project-filters.js';

const EVALUATION_SYSTEM_PROMPT = 'You are a strict curator for "Hello-AI", a directory that ONLY lists open-source projects whose CORE purpose is artificial intelligence (machine learning, deep learning, LLMs, generative AI, AI agents, computer vision, speech, etc.). Judge ONLY from the given metadata, never assume or invent AI features. When in doubt, reject. Respond ONLY with valid JSON.';

// Inclusion / exclusion boundaries per category. Categories without an entry fall back to their name only.
const CATEGORY_GUIDELINES = {
  llms: 'Foundation / large language model weights, model families, model architecture implementations. NOT apps or tools that merely call LLM APIs.',
  agents: 'AI agent frameworks, autonomous agents, multi-agent orchestration, browser/computer-use agents. NOT general workflow/automation tools without an LLM at the core.',
  rag_data: 'RAG frameworks, vector databases, embeddings, document parsing/chunking for LLM ingestion. NOT general-purpose databases, search engines or ETL tools.',
  infrastructure: 'Model inference engines, model serving, LLM gateways/proxies, GPU/accelerator tooling for AI workloads, MLOps. NOT general cloud, DevOps, Kubernetes, API gateways or monitoring tools.',
  finetuning: 'Model training, fine-tuning, RLHF, training datasets, model evaluation/benchmarks.',
  multimodal: 'AI computer vision, image/video/audio generation or recognition, TTS/STT, OCR models. NOT general image/video/audio editors, players or converters.',
  devtools: 'Tools, SDKs and libraries specifically for BUILDING AI software or USING AI in development: LLM SDKs, prompt engineering, AI coding assistants, skills/plugins/MCP servers for AI coding agents. NOT general programming libraries, language bindings, build tools, frameworks, linters, or editors/IDEs where AI is only an optional feature.',
  applications: 'End-user applications whose MAIN feature is powered by AI models (AI chat UIs, AI writing/translation/productivity apps). NOT general apps with a minor AI add-on.',
  learning: 'Tutorials, courses, books, papers, roadmaps and awesome lists whose SUBJECT is AI/ML/DL/LLM/agents. NOT general programming tutorials, algorithms/LeetCode, interview prep, system design, generic statistics/math books, or awesome lists for non-AI languages/frameworks (e.g. awesome-java, awesome-swiftui).',
  desktop_tools: 'Desktop, terminal or OS-level apps whose CORE function is AI (local LLM GUI clients, AI assistants integrated into the OS, AI terminal tools, managers/monitors built specifically for AI tools). NOT general desktop utilities, terminal tools, launchers, window managers, dotfiles or system tools.',
  robotics_iot: 'Robots, embodied AI and edge devices where ML/AI is core (AI perception, planning, learned control, on-device model inference). NOT general robot middleware/firmware, drivers, IoT platforms, home automation, drones or 3D printers without AI at the core.',
  finance_business: 'AI/ML applied to quantitative trading, financial analysis or enterprise. NOT general trading bots, accounting, ERP or CRM software without AI at the core.',
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildValidCategoriesString(categories) {
  return asArray(categories)
    .filter(c => c.id !== 'trending')
    .map(c => {
      const guideline = CATEGORY_GUIDELINES[c.id] ? `\n    Scope: ${CATEGORY_GUIDELINES[c.id]}` : '';
      return `- ${c.id} (${c.name}) - Subcategories: [${asArray(c.subcategories).join(', ')}]${guideline}`;
    })
    .join('\n');
}

function buildEvaluationBatchData(batch) {
  return asArray(batch).map((item, index) => {
    const { owner, repo } = parseGithubUrl(item.html_url || item.url || '');
    return {
      id: index,
      name: item.name,
      repo: owner ? `${owner}/${repo}` : item.name,
      description: item.description || 'No description',
      topics: Array.isArray(item.topics) && item.topics.length > 0 ? item.topics.join(', ') : 'None',
    };
  });
}

function buildEvaluationPrompt(batchData, validCategoriesStr) {
  return `
Evaluate these GitHub projects for the "Hello-AI" directory, which ONLY accepts projects whose core purpose is AI.

Projects to evaluate:
${JSON.stringify(batchData, null, 2)}

Valid Categories (with scope):
${validCategoriesStr}

Follow these steps for EACH project:

STEP 1 - AI relevance (decisive). Set "ai_relevance" to exactly one of:
- "core": AI is the main purpose. Any of:
  * builds, trains, serves, evaluates or applies AI models, or is an agent framework;
  * its main feature IS an AI capability: speech recognition/dictation, TTS, OCR, image/video generation, model-based translation, LLM chat;
  * exists only to serve an AI product or AI models: clients, managers, extensions, nodes, plugins, skills, MCP servers or API proxies for ComfyUI, Stable Diffusion, Claude, ChatGPT, Codex, Ollama, etc. (AI desktop/terminal tools of this kind are "core" too);
  * a learning resource whose subject is AI/ML/LLM.
- "weak": general-purpose software that only mentions AI as an optional feature, integration, buzzword or SEO topic.
- "none": no meaningful AI connection.
Rules:
- AI-related topics (e.g. "ai", "llm", "claude-code", "mcp") alone are NOT enough. The description or name must show AI is central.
- Key test: if the AI part were removed, would the project still be essentially the same useful thing? If yes, it is "weak" (e.g. an icon pack that also ships an MCP server, a code editor with an AI plugin, a language binding "useful for AI apps"). If removing AI leaves nothing, it is "core".
- Always "weak" or "none": general programming tutorials, algorithms/LeetCode/interview prep, non-AI awesome lists, general libraries/frameworks/bindings/build tools, general editors/IDEs, general desktop or terminal utilities, general robotics/IoT/embedded/home-automation projects, general trading bots, icon packs, themes.
- Set "ai_evidence" to a short quote from the metadata proving AI is central (empty string if none).

STEP 2 - Value. If "ai_relevance" is not "core", set "is_valuable": false. Also set it to false for low-quality, forked/mirror, spam or too localized projects. Always give a short "reason" when rejecting.

STEP 3 - Classification (only when "is_valuable" is true). Pick the "category_id" whose Scope fits best, and a "subcategory" from that category's list (or "" if none fits). Use "learning", "devtools", "desktop_tools" and "robotics_iot" ONLY when the project matches their Scope; never use them as a fallback.

STEP 4 - Details (only when "is_valuable" is true). Fill "project": "description" is a concise, faithful Chinese summary (max 2 sentences) that must NOT claim AI features absent from the metadata; "tags" are English tags suitable for GitHub topic search.

Required Output Format (JSON):
{
  "evaluations": [
    {
      "id": 0,
      "ai_relevance": "core",
      "ai_evidence": "<short quote from metadata>",
      "is_valuable": true,
      "category_id": "<one of the valid category ids>",
      "subcategory": "<subcategory from that category, or empty>",
      "project": {
        "name": "project_name",
        "description": "<Chinese summary, max 2 sentences>",
        "tags": ["EnglishTag1", "EnglishTag2"],
        "health": "Active"
      }
    },
    {
      "id": 1,
      "ai_relevance": "none",
      "ai_evidence": "",
      "is_valuable": false,
      "reason": "General-purpose Rust/JS binding library, not AI-focused."
    }
  ]
}

Return ONLY standard JSON with one evaluation per project, keeping the same "id". Keep JSON minimal. Important: "tags" MUST be in English only, while "description" MUST be in Chinese.`;
}

function buildEvaluationMessages(prompt) {
  return [
    { role: 'system', content: EVALUATION_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];
}

function extractEvaluations(responseData) {
  if (Array.isArray(responseData)) return responseData;
  return asArray(responseData?.evaluations);
}

function findEvaluation(evaluations, index, name) {
  return asArray(evaluations).find(e => Number(e?.id) === index)
    || asArray(evaluations).find(e => e?.project?.name === name);
}

/**
 * Turn a raw LLM evaluation into a deterministic verdict, so that lenient models
 * cannot approve a project without explicitly marking AI as its core purpose.
 * status: 'accepted' | 'rejected' | 'invalid_category' | 'missing'
 */
function judgeEvaluation(evalData, categories) {
  if (!evalData || typeof evalData !== 'object') {
    return { status: 'missing', reason: 'No evaluation result returned' };
  }

  const relevance = String(evalData.ai_relevance || '').trim().toLowerCase();
  const modelReason = evalData.reason ? `: ${evalData.reason}` : '';
  if (relevance !== 'core') {
    return { status: 'rejected', reason: `Not AI-focused (ai_relevance=${relevance || 'missing'})${modelReason}` };
  }

  const isValuable = evalData.is_valuable === true || String(evalData.is_valuable).toLowerCase() === 'true';
  if (!isValuable) {
    return { status: 'rejected', reason: evalData.reason || 'Not valuable enough' };
  }

  const categoryId = String(evalData.category_id || '').trim();
  const category = asArray(categories).find(c => c.id === categoryId && c.id !== 'trending');
  if (!category) {
    return { status: 'invalid_category', reason: `Invalid category: ${categoryId || 'missing'}` };
  }

  const rawSub = String(evalData.subcategory || '').trim().toLowerCase();
  const subcategory = asArray(category.subcategories).find(s => s.toLowerCase() === rawSub) || '';

  return { status: 'accepted', category, subcategory };
}

export {
  CATEGORY_GUIDELINES,
  EVALUATION_SYSTEM_PROMPT,
  buildEvaluationBatchData,
  buildEvaluationMessages,
  buildEvaluationPrompt,
  buildValidCategoriesString,
  extractEvaluations,
  findEvaluation,
  judgeEvaluation,
};
