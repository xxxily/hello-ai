const EVALUATION_SYSTEM_PROMPT = 'You are an AI project curator. Your job is to strictly evaluate GitHub repositories and return JSON. Respond ONLY with valid JSON.';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildValidCategoriesString(categories) {
  return asArray(categories)
    .filter(c => c.id !== 'trending')
    .map(c => `- ${c.id} (${c.name}) - Subcategories: [${asArray(c.subcategories).join(', ')}]`)
    .join('\n');
}

function buildEvaluationBatchData(batch) {
  return asArray(batch).map((item, index) => ({
    id: index,
    name: item.name,
    description: item.description || 'No description',
    topics: Array.isArray(item.topics) ? item.topics.join(', ') : 'None',
  }));
}

function buildEvaluationPrompt(batchData, validCategoriesStr) {
  return `
Please evaluate these GitHub projects based on their metadata. Determine if each is a high-quality AI project suitable for the "Hello-AI" directory.

Projects to evaluate:
${JSON.stringify(batchData, null, 2)}

Valid Categories and their Subcategories:
${validCategoriesStr}

For each project, determine if it is valuable. 
If it's NOT valuable or not really AI-focused or too localized/forked, set "is_valuable": false and state a "reason".
If it IS valuable, set "is_valuable": true, pick the best "category_id", pick the most suitable "subcategory" (if applicable, else ""), and fill out the "project" details.

Required Output Format (JSON):
{
  "evaluations": [
    {
      "id": 0,
      "is_valuable": true,
      "category_id": "<one of the valid categories matching it best>",
      "subcategory": "<matching subcategory if applicable, or empty>",
      "project": {
        "name": "project_name",
        "description": "<Provide a concise, engaging summary in Chinese (max 2 sentences)>",
        "tags": ["EnglishTag1", "EnglishTag2"],
        "health": "Active"
      }
    },
    {
      "id": 1,
      "is_valuable": false,
      "reason": "Not related to AI or low quality."
    }
  ]
}

Return ONLY standard JSON. Keep JSON minimal. Important: "tags" MUST be in English only (suitable for GitHub topic search), while "description" MUST be in Chinese.`;
}

function buildEvaluationMessages(prompt) {
  return [
    { role: 'system', content: EVALUATION_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];
}

export {
  EVALUATION_SYSTEM_PROMPT,
  buildEvaluationBatchData,
  buildEvaluationMessages,
  buildEvaluationPrompt,
  buildValidCategoriesString,
};
