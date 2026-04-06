#!/usr/bin/env node
/**
 * Meilisearch 搜索 TUI
 * 交互式搜索测试界面
 * 使用 Search Key 进行搜索操作（不使用 Master Key）
 */

import readline from 'readline'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 配置文件路径
const CONFIG_FILE = path.join(__dirname, '../.meilisearch-keys.json')
const INDEX_NAME = 'ai_projects'

/**
 * 加载配置
 */
function loadConfig() {
  // 优先使用环境变量，其次读取配置文件
  const host = process.env.MEILISEARCH_HOST
  const searchKey = process.env.MEILISEARCH_SEARCH_KEY

  if (host && searchKey) {
    return { host, apiKey: searchKey, indexName: INDEX_NAME }
  }

  if (fs.existsSync(CONFIG_FILE)) {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
    return {
      host: config.host,
      apiKey: config.searchKey,
      indexName: config.indexName
    }
  }

  console.error('❌ 未找到 Meilisearch 配置')
  console.error('   请先运行: MEILISEARCH_MASTER_KEY=xxx node scripts/meilisearch-setup-keys.js')
  console.error('   或设置环境变量: MEILISEARCH_HOST 和 MEILISEARCH_SEARCH_KEY')
  process.exit(1)
}

// 加载配置
const config = loadConfig()
const MEILISEARCH_HOST = config.host
const MEILISEARCH_API_KEY = config.apiKey

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m'
}

/**
 * 清屏
 */
function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H')
}

/**
 * 打印标题
 */
function printHeader() {
  console.log(`${colors.bold}${colors.cyan}╔══════════════════════════════════════════════════════════════╗`)
  console.log(`║          🔍 Meilisearch 搜索测试 TUI                         ║`)
  console.log(`╚══════════════════════════════════════════════════════════════╝${colors.reset}`)
  console.log()
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(`${colors.dim}命令说明:${colors.reset}`)
  console.log(`  ${colors.green}直接输入关键词${colors.reset}  - 搜索项目`)
  console.log(`  ${colors.yellow}:c <分类>${colors.reset}      - 按分类过滤 (如: :c agents)`)
  console.log(`  ${colors.yellow}:s <排序>${colors.reset}      - 排序方式 (如: :s stars:desc)`)
  console.log(`  ${colors.yellow}:h <健康>${colors.reset}      - 按健康状态过滤 (如: :h Active)`)
  console.log(`  ${colors.blue}:stats${colors.reset}         - 显示索引统计`)
  console.log(`  ${colors.blue}:clear${colors.reset}         - 清除过滤条件`)
  console.log(`  ${colors.red}:q${colors.reset}             - 退出`)
  console.log()
}

/**
 * 执行搜索
 */
async function search(query, filters = {}, sort = []) {
  const searchParams = {
    q: query,
    limit: 20,
    offset: 0,
    attributesToHighlight: ['name', 'description'],
    highlightPreTag: '**',
    highlightPostTag: '**'
  }

  // 添加过滤条件
  if (filters.categoryId) {
    searchParams.filter = [`categoryId = "${filters.categoryId}"`]
  }
  if (filters.health) {
    searchParams.filter = searchParams.filter || []
    searchParams.filter.push(`health = "${filters.health}"`)
  }

  // 添加排序
  if (sort.length > 0) {
    searchParams.sort = sort
  }

  try {
    const response = await fetch(`${MEILISEARCH_HOST}/indexes/${INDEX_NAME}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
      },
      body: JSON.stringify(searchParams)
    })

    if (!response.ok) {
      const error = await response.text()
      return { error: `搜索失败: ${error}` }
    }

    return await response.json()
  } catch (err) {
    return { error: `请求失败: ${err.message}` }
  }
}

/**
 * 获取索引统计 (Search Key 可能没有权限，需要处理)
 */
async function getStats() {
  try {
    const response = await fetch(`${MEILISEARCH_HOST}/indexes/${INDEX_NAME}/stats`, {
      headers: {
        'Authorization': `Bearer ${MEILISEARCH_API_KEY}`
      }
    })

    if (!response.ok) {
      return { error: 'Search Key 无权限获取统计信息，请使用 Admin Key' }
    }

    return await response.json()
  } catch (err) {
    return { error: `请求失败: ${err.message}` }
  }
}

/**
 * 格式化星数
 */
function formatStars(stars) {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1)}k`
  }
  return stars.toString()
}

/**
 * 显示搜索结果
 */
function displayResults(results) {
  if (results.error) {
    console.log(`${colors.red}❌ ${results.error}${colors.reset}`)
    return
  }

  const { hits, query, processingTimeMs, estimatedTotalHits } = results

  console.log()
  console.log(`${colors.dim}搜索: "${query}" | 找到 ${estimatedTotalHits} 个结果 | 耗时 ${processingTimeMs}ms${colors.reset}`)
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`)

  if (hits.length === 0) {
    console.log(`${colors.yellow}没有找到匹配的项目${colors.reset}`)
    return
  }

  hits.forEach((hit, index) => {
    const num = `${colors.dim}${(index + 1).toString().padStart(2)}.${colors.reset}`
    const name = hit._formatted?.name || hit.name
    const stars = `${colors.green}⭐ ${formatStars(hit.stars)}${colors.reset}`
    const health = hit.health === 'Active' ? `${colors.green}●${colors.reset}` : `${colors.yellow}●${colors.reset}`
    const category = `${colors.cyan}[${hit.categoryId}]${colors.reset}`

    console.log(`${num} ${colors.bold}${name}${colors.reset} ${stars} ${health} ${category}`)

    // 显示描述（截断）
    let desc = hit._formatted?.description || hit.description || ''
    if (desc.length > 80) {
      desc = desc.substring(0, 80) + '...'
    }
    console.log(`    ${colors.dim}${desc}${colors.reset}`)

    // 显示标签
    if (hit.tags && hit.tags.length > 0) {
      const tags = hit.tags.slice(0, 3).map(t => `${colors.blue}[${t}]${colors.reset}`).join(' ')
      console.log(`    ${colors.dim}标签: ${tags}${colors.reset}`)
    }

    // 显示链接
    console.log(`    ${colors.dim}链接: ${hit.url}${colors.reset}`)
    console.log()
  })
}

/**
 * 显示统计信息
 */
async function displayStats() {
  const stats = await getStats()

  if (stats.error) {
    console.log(`${colors.yellow}⚠️  ${stats.error}${colors.reset}`)
    return
  }

  console.log()
  console.log(`${colors.bold}📊 索引统计信息${colors.reset}`)
  console.log(`${colors.dim}${'─'.repeat(40)}${colors.reset}`)
  console.log(`  文档数量: ${colors.green}${stats.numberOfDocuments}${colors.reset}`)
  console.log(`  是否正在索引: ${stats.isIndexing ? colors.yellow + '是' : colors.green + '否'}`)
  console.log(`  字段分布:`)

  if (stats.fieldDistribution) {
    for (const [field, count] of Object.entries(stats.fieldDistribution)) {
      console.log(`    ${colors.cyan}${field}${colors.reset}: ${count}`)
    }
  }
  console.log()
}

/**
 * 主循环
 */
async function main() {
  // 检查连接
  try {
    const healthResponse = await fetch(`${MEILISEARCH_HOST}/health`, {
      headers: { 'Authorization': `Bearer ${MEILISEARCH_API_KEY}` }
    })

    if (!healthResponse.ok) {
      console.log(`${colors.red}❌ 无法连接到 Meilisearch: ${MEILISEARCH_HOST}${colors.reset}`)
      process.exit(1)
    }
  } catch (err) {
    console.log(`${colors.red}❌ 连接失败: ${err.message}${colors.reset}`)
    process.exit(1)
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  // 当前过滤和排序状态
  let filters = {}
  let sort = []

  // 初始显示
  clearScreen()
  printHeader()
  printHelp()
  console.log(`${colors.dim}当前过滤: 无 | 排序: 默认${colors.reset}`)
  console.log()

  // 输入提示
  const prompt = () => {
    rl.question(`${colors.bold}${colors.green}🔍 搜索>${colors.reset} `, async (input) => {
      const trimmed = input.trim()

      if (!trimmed) {
        prompt()
        return
      }

      // 处理命令
      if (trimmed.startsWith(':')) {
        const [cmd, arg] = trimmed.split(' ')
        const command = cmd.toLowerCase()

        switch (command) {
          case ':q':
            console.log(`${colors.dim}再见! 👋${colors.reset}`)
            rl.close()
            process.exit(0)
            break

          case ':stats':
            await displayStats()
            break

          case ':clear':
            filters = {}
            sort = []
            console.log(`${colors.green}✅ 已清除所有过滤条件${colors.reset}`)
            break

          case ':c':
            if (arg) {
              filters.categoryId = arg
              console.log(`${colors.green}✅ 已设置分类过滤: ${arg}${colors.reset}`)
            } else {
              console.log(`${colors.yellow}用法: :c <分类ID>${colors.reset}`)
            }
            break

          case ':s':
            if (arg) {
              sort = [arg]
              console.log(`${colors.green}✅ 已设置排序: ${arg}${colors.reset}`)
            } else {
              console.log(`${colors.yellow}用法: :s <排序方式> (如: stars:desc)${colors.reset}`)
            }
            break

          case ':h':
            if (arg) {
              filters.health = arg
              console.log(`${colors.green}✅ 已设置健康状态过滤: ${arg}${colors.reset}`)
            } else {
              console.log(`${colors.yellow}用法: :h <健康状态> (如: Active)${colors.reset}`)
            }
            break

          default:
            console.log(`${colors.yellow}未知命令: ${cmd}${colors.reset}`)
            printHelp()
        }

        // 显示当前状态
        const filterStr = Object.keys(filters).length > 0
          ? Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(', ')
          : '无'
        const sortStr = sort.length > 0 ? sort.join(', ') : '默认'
        console.log(`${colors.dim}当前过滤: ${filterStr} | 排序: ${sortStr}${colors.reset}`)
        console.log()

        prompt()
        return
      }

      // 执行搜索
      clearScreen()
      printHeader()
      printHelp()

      // 显示当前状态
      const filterStr = Object.keys(filters).length > 0
        ? Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(', ')
        : '无'
      const sortStr = sort.length > 0 ? sort.join(', ') : '默认'
      console.log(`${colors.dim}当前过滤: ${filterStr} | 排序: ${sortStr}${colors.reset}`)

      const results = await search(trimmed, filters, sort)
      displayResults(results)

      prompt()
    })
  }

  prompt()
}

// 处理 Ctrl+C
process.on('SIGINT', () => {
  console.log(`\n${colors.dim}再见! 👋${colors.reset}`)
  process.exit(0)
})

main()