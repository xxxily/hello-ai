#!/usr/bin/env node
/**
 * Meilisearch API Keys 管理脚本
 * 使用 Master Key 创建专用的 Admin Key 和 Search Key
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Meilisearch 配置 - Master Key 仅用于此脚本创建 API Keys
const MEILISEARCH_HOST = process.env.MEILISEARCH_HOST
const MEILISEARCH_MASTER_KEY = process.env.MEILISEARCH_MASTER_KEY

if (!MEILISEARCH_MASTER_KEY) {
  console.error('❌ 请设置环境变量 MEILISEARCH_MASTER_KEY')
  console.error('   使用方式: MEILISEARCH_MASTER_KEY=xxx node scripts/meilisearch-setup-keys.js')
  process.exit(1)
}

const INDEX_NAME = 'ai_projects'
const CONFIG_FILE = path.join(__dirname, '../.meilisearch-keys.json')

/**
 * 获取现有 API Keys
 */
async function getExistingKeys() {
  const response = await fetch(`${MEILISEARCH_HOST}/keys`, {
    headers: {
      'Authorization': `Bearer ${MEILISEARCH_MASTER_KEY}`
    }
  })

  if (response.ok) {
    return await response.json()
  }
  return { results: [] }
}

/**
 * 创建 Admin Key (用于索引操作)
 */
async function createAdminKey() {
  const response = await fetch(`${MEILISEARCH_HOST}/keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEILISEARCH_MASTER_KEY}`
    },
    body: JSON.stringify({
      description: 'Admin key for ai_projects index - indexing and settings',
      actions: [
        'indexes.create',
        'indexes.update',
        'indexes.delete',
        'documents.add',
        'documents.get',
        'documents.delete',
        'settings.update',
        'settings.get',
        'stats.get',
        'tasks.get'
      ],
      indexes: [INDEX_NAME],
      expiresAt: null  // 永不过期
    })
  })

  if (response.ok) {
    return await response.json()
  } else {
    const error = await response.text()
    console.error('创建 Admin Key 失败:', error)
    return null
  }
}

/**
 * 创建 Search Key (用于搜索操作)
 */
async function createSearchKey() {
  const response = await fetch(`${MEILISEARCH_HOST}/keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEILISEARCH_MASTER_KEY}`
    },
    body: JSON.stringify({
      description: 'Search key for ai_projects index - public search access',
      actions: ['search'],
      indexes: [INDEX_NAME],
      expiresAt: null  // 永不过期
    })
  })

  if (response.ok) {
    return await response.json()
  } else {
    const error = await response.text()
    console.error('创建 Search Key 失败:', error)
    return null
  }
}

/**
 * 删除旧 Key
 */
async function deleteKey(keyUid) {
  const response = await fetch(`${MEILISEARCH_HOST}/keys/${keyUid}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${MEILISEARCH_MASTER_KEY}`
    }
  })
  return response.ok || response.status === 404
}

/**
 * 主函数
 */
async function main() {
  console.log('🔑 Meilisearch API Keys 配置工具')
  console.log('==================================\n')

  // 检查连接
  try {
    const healthResponse = await fetch(`${MEILISEARCH_HOST}/health`, {
      headers: { 'Authorization': `Bearer ${MEILISEARCH_MASTER_KEY}` }
    })
    if (!healthResponse.ok) {
      console.error('❌ 无法连接到 Meilisearch')
      process.exit(1)
    }
    console.log(`✅ Meilisearch 连接成功: ${MEILISEARCH_HOST}\n`)
  } catch (err) {
    console.error('❌ 连接失败:', err.message)
    process.exit(1)
  }

  // 获取现有 Keys
  console.log('📋 检查现有 API Keys...\n')
  const existingKeys = await getExistingKeys()

  // 查找并删除旧的 ai_projects 相关 Keys
  const oldKeys = existingKeys.results.filter(k =>
    k.description?.includes(INDEX_NAME) || k.indexes?.includes(INDEX_NAME)
  )

  if (oldKeys.length > 0) {
    console.log(`发现 ${oldKeys.length} 个旧 Key，正在删除...`)
    for (const key of oldKeys) {
      await deleteKey(key.uid)
      console.log(`  🗑️  已删除: ${key.description || key.uid}`)
    }
    console.log()
  }

  // 创建新的 Keys
  console.log('🔐 创建新的 API Keys...\n')

  const adminKey = await createAdminKey()
  if (adminKey) {
    console.log(`✅ Admin Key 创建成功`)
    console.log(`   Key: ${adminKey.key}`)
    console.log(`   UID: ${adminKey.uid}`)
    console.log(`   权限: 索引管理、文档操作、设置配置`)
  }

  const searchKey = await createSearchKey()
  if (searchKey) {
    console.log(`✅ Search Key 创建成功`)
    console.log(`   Key: ${searchKey.key}`)
    console.log(`   UID: ${searchKey.uid}`)
    console.log(`   权限: 仅搜索`)
  }

  if (!adminKey || !searchKey) {
    console.error('\n❌ API Keys 创建失败')
    process.exit(1)
  }

  // 保存配置文件
  const config = {
    host: MEILISEARCH_HOST,
    indexName: INDEX_NAME,
    adminKey: adminKey.key,
    adminKeyUid: adminKey.uid,
    searchKey: searchKey.key,
    searchKeyUid: searchKey.uid,
    createdAt: new Date().toISOString()
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  console.log(`\n📝 配置已保存到: ${CONFIG_FILE}`)

  // 显示使用说明
  console.log('\n📌 使用说明:')
  console.log('   - Admin Key 用于索引脚本 (meilisearch-index.js)')
  console.log('   - Search Key 用于搜索 TUI 和前端应用')
  console.log('   - Master Key 仅用于管理操作，请妥善保管')
  console.log('\n⚠️  安全提示:')
  console.log('   - 不要将 Master Key 硬编码在代码中')
  console.log('   - Search Key 可以公开给前端使用')
  console.log('   - Admin Key 仅用于服务端索引操作')
}

main().catch(console.error)