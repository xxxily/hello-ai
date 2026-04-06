#!/usr/bin/env node
/**
 * Meilisearch 索引脚本
 * 将 projects.json 中的数据索引到 Meilisearch
 * 使用 Admin Key 进行索引操作（不使用 Master Key）
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 配置文件路径
const CONFIG_FILE = path.join(__dirname, '../.meilisearch-keys.json')
const DATA_FILE = path.join(__dirname, '../data/projects.json')
const INDEX_NAME = 'ai_projects'

/**
 * 加载配置
 */
function loadConfig() {
  // 优先使用环境变量，其次读取配置文件
  const host = process.env.MEILISEARCH_HOST
  const adminKey = process.env.MEILISEARCH_ADMIN_KEY

  if (host && adminKey) {
    return { host, apiKey: adminKey, indexName: INDEX_NAME }
  }

  if (fs.existsSync(CONFIG_FILE)) {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
    return {
      host: config.host,
      apiKey: config.adminKey,
      indexName: config.indexName
    }
  }

  console.error('❌ 未找到 Meilisearch 配置')
  console.error('   请先运行: MEILISEARCH_MASTER_KEY=xxx node scripts/meilisearch-setup-keys.js')
  console.error('   或设置环境变量: MEILISEARCH_HOST 和 MEILISEARCH_ADMIN_KEY')
  process.exit(1)
}

// 加载配置
const config = loadConfig()
const MEILISEARCH_HOST = config.host
const MEILISEARCH_API_KEY = config.apiKey

/**
 * 创建 Meilisearch 索引
 */
async function createIndex() {
  const response = await fetch(`${MEILISEARCH_HOST}/indexes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
    },
    body: JSON.stringify({
      uid: INDEX_NAME,
      primaryKey: 'id'
    })
  })

  if (response.ok) {
    console.log(`✅ 索引 ${INDEX_NAME} 创建成功`)
    return true
  } else if (response.status === 409) {
    console.log(`ℹ️  索引 ${INDEX_NAME} 已存在`)
    return true
  } else {
    const error = await response.text()
    console.error(`❌ 创建索引失败:`, error)
    return false
  }
}

/**
 * 配置搜索属性
 */
async function configureSearchableAttributes() {
  const response = await fetch(`${MEILISEARCH_HOST}/indexes/${INDEX_NAME}/settings/searchable-attributes`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
    },
    body: JSON.stringify([
      'name',
      'description',
      'tags',
      'topics',
      'subcategory',
      'owner'
    ])
  })

  if (response.ok) {
    console.log('✅ 搜索属性配置成功')
    return true
  } else {
    const error = await response.text()
    console.error('❌ 配置搜索属性失败:', error)
    return false
  }
}

/**
 * 配置过滤属性
 */
async function configureFilterableAttributes() {
  const response = await fetch(`${MEILISEARCH_HOST}/indexes/${INDEX_NAME}/settings/filterable-attributes`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
    },
    body: JSON.stringify([
      'categoryId',
      'health',
      'stars',
      'owner',
      'subcategory'
    ])
  })

  if (response.ok) {
    console.log('✅ 过滤属性配置成功')
    return true
  } else {
    const error = await response.text()
    console.error('❌ 配置过滤属性失败:', error)
    return false
  }
}

/**
 * 配置排序属性
 */
async function configureSortableAttributes() {
  const response = await fetch(`${MEILISEARCH_HOST}/indexes/${INDEX_NAME}/settings/sortable-attributes`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
    },
    body: JSON.stringify([
      'stars',
      'lastUpdated',
      'name'
    ])
  })

  if (response.ok) {
    console.log('✅ 排序属性配置成功')
    return true
  } else {
    const error = await response.text()
    console.error('❌ 配置排序属性失败:', error)
    return false
  }
}

/**
 * 配置排名规则
 */
async function configureRankingRules() {
  const response = await fetch(`${MEILISEARCH_HOST}/indexes/${INDEX_NAME}/settings/ranking-rules`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
    },
    body: JSON.stringify([
      'words',
      'typo',
      'proximity',
      'attribute',
      'sort',
      'exactness',
      'stars:desc'
    ])
  })

  if (response.ok) {
    console.log('✅ 排名规则配置成功')
    return true
  } else {
    const error = await response.text()
    console.error('❌ 配置排名规则失败:', error)
    return false
  }
}

/**
 * 配置显示属性
 */
async function configureDisplayedAttributes() {
  const response = await fetch(`${MEILISEARCH_HOST}/indexes/${INDEX_NAME}/settings/displayed-attributes`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
    },
    body: JSON.stringify([
      'id',
      'name',
      'description',
      'tags',
      'health',
      'url',
      'stars',
      'lastUpdated',
      'categoryId',
      'subcategory',
      'topics',
      'owner'
    ])
  })

  if (response.ok) {
    console.log('✅ 显示属性配置成功')
    return true
  } else {
    const error = await response.text()
    console.error('❌ 配置显示属性失败:', error)
    return false
  }
}

/**
 * 准备文档数据
 */
function prepareDocuments() {
  console.log('📖 读取数据文件...')
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))

  const documents = []

  for (const category of data.categories) {
    const categoryId = category.id
    const projects = category.projects || []

    for (const project of projects) {
      // 创建唯一 ID - 使用 owner/name 格式，并替换非法字符
      const owner = project._owner || project.url?.split('/')[3] || 'unknown'
      const name = project.name || 'unknown'
      // Meilisearch ID 只允许 a-z A-Z 0-9 - _，替换其他字符
      const safeId = `${owner}_${name}`.replace(/[^a-zA-Z0-9_-]/g, '_')

      documents.push({
        id: safeId,
        name: project.name,
        description: project.description || '',
        tags: project.tags || [],
        health: project.health || 'Unknown',
        url: project.url,
        stars: project.stars || 0,
        lastUpdated: project.lastUpdated,
        categoryId: categoryId,
        subcategory: project.subcategory || '',
        topics: project.topics || [],
        owner: owner
      })
    }
  }

  console.log(`📊 准备了 ${documents.length} 个文档`)
  return documents
}

/**
 * 批量添加文档
 */
async function addDocuments(documents) {
  const BATCH_SIZE = 1000
  let totalAdded = 0

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(documents.length / BATCH_SIZE)

    console.log(`📦 发送批次 ${batchNum}/${totalBatches} (${batch.length} 个文档)...`)

    const response = await fetch(`${MEILISEARCH_HOST}/indexes/${INDEX_NAME}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
      },
      body: JSON.stringify(batch)
    })

    if (response.ok) {
      const result = await response.json()
      console.log(`  ✅ 批次 ${batchNum} 已接受，任务UID: ${result.taskUid}`)
      totalAdded += batch.length
    } else {
      const error = await response.text()
      console.error(`  ❌ 批次 ${batchNum} 失败:`, error)
    }
  }

  return totalAdded
}

/**
 * 等待索引完成
 */
async function waitForIndexing() {
  console.log('⏳ 等待索引完成...')

  let isProcessing = true
  while (isProcessing) {
    const response = await fetch(`${MEILISEARCH_HOST}/indexes/${INDEX_NAME}/stats`, {
      headers: {
        'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
      }
    })

    if (response.ok) {
      const stats = await response.json()
      const { isIndexing, numberOfDocuments } = stats

      if (!isIndexing) {
        console.log(`✅ 索引完成，共 ${numberOfDocuments} 个文档`)
        isProcessing = false
      } else {
        process.stdout.write('.')
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } else {
      console.error('获取状态失败')
      break
    }
  }
}

/**
 * 检查 Meilisearch 连接
 */
async function checkConnection() {
  try {
    const response = await fetch(`${MEILISEARCH_HOST}/health`, {
      headers: {
        'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
      }
    })

    if (response.ok) {
      console.log(`✅ Meilisearch 连接成功: ${MEILISEARCH_HOST}`)
      return true
    } else {
      console.error('❌ Meilisearch 连接失败')
      return false
    }
  } catch (error) {
    console.error('❌ Meilisearch 连接失败:', error.message)
    return false
  }
}

/**
 * 删除现有索引
 */
async function deleteIndex() {
  const response = await fetch(`${MEILISEARCH_HOST}/indexes/${INDEX_NAME}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
    }
  })

  if (response.ok || response.status === 404) {
    console.log(`🗑️  已删除旧索引 ${INDEX_NAME}`)
    return true
  } else {
    const error = await response.text()
    console.error('删除索引失败:', error)
    return false
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 Meilisearch 索引工具')
  console.log('========================\n')

  // 检查连接
  const connected = await checkConnection()
  if (!connected) {
    process.exit(1)
  }

  // 解析命令行参数
  const args = process.argv.slice(2)
  const shouldReindex = args.includes('--reindex') || args.includes('-r')

  if (shouldReindex) {
    console.log('\n📋 重新索引模式: 将删除现有索引并重新创建\n')
    await deleteIndex()
  }

  // 创建索引
  const indexCreated = await createIndex()
  if (!indexCreated) {
    process.exit(1)
  }

  // 配置索引设置
  console.log('\n⚙️  配置索引设置...\n')
  await configureSearchableAttributes()
  await configureFilterableAttributes()
  await configureSortableAttributes()
  await configureRankingRules()
  await configureDisplayedAttributes()

  // 准备数据
  console.log('\n📝 准备文档数据...\n')
  const documents = prepareDocuments()

  // 添加文档
  console.log('\n📤 上传文档到 Meilisearch...\n')
  const added = await addDocuments(documents)
  console.log(`\n📊 共上传 ${added} 个文档`)

  // 等待索引完成
  await waitForIndexing()

  console.log('\n✅ 索引完成！')
  console.log('\n使用以下命令测试搜索:')
  console.log('  node scripts/meilisearch-tui.js')
}

main().catch(console.error)