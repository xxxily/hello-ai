import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONFIG_FILE = path.join(__dirname, '../.meilisearch-keys.json')
const INDEX_NAME = 'ai_projects'

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
  }
  console.error('❌ 未找到 Meilisearch 配置')
  process.exit(1)
}

const config = loadConfig()
const MEILISEARCH_HOST = config.host
const MEILISEARCH_API_KEY = config.searchKey

async function getSimilarProjects(projectName) {
  const baseSearchParams = {
    q: projectName,
    limit: 1,
    attributesToRetrieve: ['name', 'description', 'tags', 'topics', 'subcategory']
  }

  const baseResponse = await fetch(`${MEILISEARCH_HOST}/indexes/${INDEX_NAME}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
    },
    body: JSON.stringify(baseSearchParams)
  })

  const baseData = await baseResponse.json()
  if (!baseData.hits || baseData.hits.length === 0) return null

  const baseProject = baseData.hits[0]
  const tagsPart = (baseProject.tags || []).join(' ')
  const topicsPart = (baseProject.topics || []).join(' ')
  const subPart = baseProject.subcategory || ''
  
  // 当前方案 A 的查询构造逻辑
  const query = `${tagsPart} ${tagsPart} ${topicsPart} ${topicsPart} ${subPart}`.trim()

  const searchParams = {
    q: query,
    limit: 5,
    filter: `name != "${baseProject.name}"`,
    attributesToHighlight: ['name']
  }

  const response = await fetch(`${MEILISEARCH_HOST}/indexes/${INDEX_NAME}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
    },
    body: JSON.stringify(searchParams)
  })

  return {
    base: baseProject.name,
    features: query,
    results: await response.json()
  }
}

async function runTest() {
  const testProjects = ['AutoGPT', 'ollama', 'tensorflow', 'stable-diffusion-webui']
  
  console.log('🚀 开始相关性自动化测试...\n')
  
  for (const name of testProjects) {
    const data = await getSimilarProjects(name)
    if (!data) {
      console.log(`❌ 未找到项目: ${name}\n`)
      continue
    }

    console.log(`📌 基准项目: [${data.base}]`)
    console.log(`🎯 提取特征: ${data.features}`)
    console.log(`✨ 推荐结果:`)
    
    data.results.hits.forEach((hit, i) => {
      console.log(`   ${i+1}. ${hit.name} (Stars: ${hit.stars}) - ${hit.subcategory}`)
    })
    console.log('\n' + '-'.repeat(50) + '\n')
  }
}

runTest()
