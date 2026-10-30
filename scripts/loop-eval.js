import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let count = 0;
const DEFAULT_UPDATED_WITHIN_DAYS = 180;

function parseUpdatedWithinDays(args, defaultValue = null) {
  const flag = '--updated-within-days';
  let rawValue = null;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === flag) {
      rawValue = args[index + 1];
      break;
    }
    if (arg.startsWith(`${flag}=`)) {
      rawValue = arg.slice(flag.length + 1);
      break;
    }
  }

  if (rawValue === null) return defaultValue;

  const days = Number(rawValue);
  if (typeof rawValue !== 'string' || rawValue.trim() === '' || !Number.isInteger(days) || days < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return days;
}

/**
 * 运行一次 ai:discover-eval 任务
 */
async function runOnce(extraArgs = []) {
  count++;
  const startTime = new Date();

  console.log('\n' + '█'.repeat(60));
  console.log(`🚀 第 ${count} 次任务开始于: ${startTime.toLocaleString()}`);
  console.log('█'.repeat(60) + '\n');

  return new Promise((resolve) => {
    // 检查是否有 --consume-only 参数
    const isConsumeOnly = process.argv.includes('--consume-only') || extraArgs.includes('--consume-only');
    const args = ['run', 'ai:discover-eval'];

    // 合并现有参数和额外参数
    const finalArgs = [];
    if (isConsumeOnly) finalArgs.push('--consume-only');

    extraArgs.forEach(arg => {
      if (!finalArgs.includes(arg)) finalArgs.push(arg);
    });

    if (finalArgs.length > 0) {
      args.push('--', ...finalArgs);
    }

    const child = spawn('npm', args, {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    });

    child.on('close', (code) => {
      const endTime = new Date();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log('\n' + '─'.repeat(40));
      console.log(`✅ 第 ${count} 次任务已完成 (耗时: ${duration}s)`);
      if (code !== 0 && code !== 2) {
        console.log(`⚠️ 进程退出码: ${code}`);
      }
      console.log(`📊 累计执行次数: ${count}`);
      console.log('─'.repeat(40));
      resolve(code);
    });

    child.on('error', (err) => {
      console.error(`❌ 第 ${count} 次任务发生错误:`, err);
      resolve(1);
    });
  });
}

/**
 * 重新评估模式的 TUI 子菜单
 */
async function reEvaluateMenu(question) {
  let categoryIds = [];
  try {
    const categoriesFile = path.join(__dirname, '../data/categories.json');
    categoryIds = JSON.parse(fs.readFileSync(categoriesFile, 'utf-8'))
      .map(c => c.id)
      .filter(id => id !== 'trending');
  } catch (e) { }

  const scope = await question(`\n2. 选择要重新评估的分类 (逗号分隔，留空 = 全部):\n   可选: ${categoryIds.join(', ') || '(未读取到 categories.json)'}\n   建议优先: learning,desktop_tools,robotics_iot,devtools\n   分类: `);
  const progress = await question('\n3. 重新评估进度:\n   [1] 继续上一轮进度 (默认)\n   [2] 开始新一轮 (所有项目都会被重新评估)\n   选择 [1]: ') || '1';

  const categories = scope.split(',').map(v => v.trim()).filter(Boolean);
  const unknownIds = categoryIds.length > 0 ? categories.filter(id => !categoryIds.includes(id)) : [];
  if (unknownIds.length > 0) {
    throw new Error(`未知分类: ${unknownIds.join(', ')}`);
  }

  const extraArgs = ['--re-evaluate'];
  // 留空时也显式传空值，避免沿用上一轮保存的分类范围
  extraArgs.push(`--re-evaluate-categories=${categories.join(',')}`);
  if (progress === '2') extraArgs.push('--re-evaluate-restart');
  return extraArgs;
}

/**
 * TUI 交互模式
 */
async function tuiMenu(defaultUpdatedWithinDays = DEFAULT_UPDATED_WITHIN_DAYS) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  console.log('\n🛠️  [Hello-AI] 交互式启动配置\n');

  const mode = await question('1. 选择运行模式:\n   [1] 持续发现与评估 (默认)\n   [2] 仅评估已存在的队列数据 (Consume Only)\n   [3] 大批量更新现有项目模式 (Mass Update - 不进行LLM评估)\n   [4] 重新评估已收录项目 (Re-evaluate - 剔除非AI项目/修正分类)\n   选择 [1]: ') || '1';

  if (mode === '4') {
    const extraArgs = await reEvaluateMenu(question);
    console.log(`\n🚀 配置完成！即将以参数执行: ${extraArgs.join(' ')}\n`);
    rl.close();
    return extraArgs;
  }

  const resume = await question('\n2. 是否恢复上次探索进度?\n   [1] 否 (默认)\n   [2] 是 (--resume)\n   选择 [1]: ') || '1';

  const sort = await question('\n3. 选择话题探索策略:\n   [1] 按时间 (Time)(默认)\n   [2] 按质量 (Quality)\n   选择 [1]: ') || '1';

  let order = '';
  if (sort === '2') {
    order = await question('\n4. 质量排序细化:\n   [1] 精品优先 (高分 -> 低分, 默认)\n   [2] 潜力挖掘 (低分 -> 高分)\n   选择 [1]: ') || '1';
  } else {
    order = await question('\n4. 时间排序细化:\n   [1] 默认模式 (未探索过的优先)\n   [2] 更新模式 (已探索过的优先 - 用于更新项目数据)\n   选择 [1]: ') || '1';
  }

  const updatedWithinDaysInput = await question(`\n5. 项目更新时间过滤:\n   仅将最近 N 天有 GitHub 推送更新的发现项目加入待审队列。\n   输入 0 可关闭过滤。天数 [${defaultUpdatedWithinDays}]: `) || String(defaultUpdatedWithinDays);
  const updatedWithinDays = parseUpdatedWithinDays([
    `--updated-within-days=${updatedWithinDaysInput.trim()}`
  ]);

  const extraArgs = [];
  if (mode === '2') extraArgs.push('--consume-only');
  if (mode === '3') extraArgs.push('--update-only');
  extraArgs.push(`--updated-within-days=${updatedWithinDays}`);

  if (resume === '2') extraArgs.push('--resume');

  if (sort === '2') {
    extraArgs.push('--sort-topic-by=quality');
    if (order === '2') extraArgs.push('--topic-order=asc');
    else extraArgs.push('--topic-order=desc');
  } else {
    extraArgs.push('--sort-topic-by=time');
    if (order === '2') extraArgs.push('--topic-order=desc');
    else extraArgs.push('--topic-order=asc');
  }

  console.log(`\n🚀 配置完成！即将以参数执行: ${extraArgs.join(' ') || '默认'}\n`);
  rl.close();
  return extraArgs;
}

/**
 * 主循环函数
 */
async function start() {
  let extraArgs = [];
  const isTui = process.argv.includes('--tui');

  if (isTui) {
    const updatedWithinDays = parseUpdatedWithinDays(process.argv, DEFAULT_UPDATED_WITHIN_DAYS);
    extraArgs = await tuiMenu(updatedWithinDays);
  } else {
    // 兼容原有参数传递
    if (process.argv.includes('--consume-only')) extraArgs.push('--consume-only');
    // 透传重新评估相关参数: --re-evaluate / --re-evaluate-categories=a,b / --re-evaluate-restart
    process.argv.slice(2).filter(arg => arg.startsWith('--re-evaluate')).forEach(arg => extraArgs.push(arg));
    const updatedWithinDays = parseUpdatedWithinDays(process.argv, DEFAULT_UPDATED_WITHIN_DAYS);
    extraArgs.push(`--updated-within-days=${updatedWithinDays}`);
  }

  process.stdout.write('\x1Bc'); // 清屏
  console.log('┌────────────────────────────────────────────────────────┐');
  console.log('│                                                        │');
  console.log('│   🤖 Hello-AI 持续发现与评估引擎已启动                 │');
  console.log('│   按 Ctrl+C 可停止执行                                 │');
  console.log('│                                                        │');
  console.log('└────────────────────────────────────────────────────────┘');

  await import('dotenv/config'); // 确保 .env 被正确加载以读取时间常数
  const envInterval = parseInt(process.env.LOOP_INTERVAL_SECONDS, 10);
  const minIntervalSeconds = isNaN(envInterval) ? 60 : envInterval;
  const MIN_INTERVAL_MS = minIntervalSeconds * 1000;

  const isConsumeOnly = extraArgs.includes('--consume-only');
  const isReEvaluate = extraArgs.includes('--re-evaluate');
  // 重新评估不调用 GitHub 搜索接口，无需等待发现模式的最小间隔
  const minWaitMs = isReEvaluate ? 0 : MIN_INTERVAL_MS;

  while (true) {
    const cycleStartTime = Date.now();
    const childExitCode = await runOnce(extraArgs);

    if (isConsumeOnly && childExitCode === 2) {
      console.log('\n🎉 所有待处理队列的数据已被评估完毕，任务圆满结束（基于 --consume-only 参数自动退出循环）。');
      process.exit(0);
    }

    if (isReEvaluate) {
      if (childExitCode === 2) {
        console.log('\n🎉 本轮重新评估已全部完成，任务结束。');
        process.exit(0);
      }
      if (childExitCode === 1) {
        console.log('\n❌ 重新评估参数有误，已停止循环。');
        process.exit(1);
      }
      // --re-evaluate-restart 只应在第一次执行时生效，否则每轮都会重置进度
      const restartIndex = extraArgs.indexOf('--re-evaluate-restart');
      if (restartIndex !== -1) extraArgs.splice(restartIndex, 1);
    }

    const cycleEndTime = Date.now();
    const elapsedMs = cycleEndTime - cycleStartTime;
    const remainingMs = Math.max(0, minWaitMs - elapsedMs);

    if (remainingMs > 0) {
      console.log(`\n⏳ 本轮执行耗时 ${(elapsedMs / 1000).toFixed(1)}s，正在等待 ${(remainingMs / 1000).toFixed(1)}s 以满足配置 of ${minIntervalSeconds} 秒间隔标准...`);
      await new Promise(r => setTimeout(r, remainingMs));
    } else {
      console.log(`\n🚀 本轮执行耗时 ${(elapsedMs / 1000).toFixed(1)}s (已超过 ${minIntervalSeconds} 秒)，准备进入下一次迭代...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// 捕获退出信号，优雅退出
process.on('SIGINT', () => {
  console.log('\n\n👋 正在停止持续执行任务...');
  console.log(`📈 本次运行总计执行次数: ${count}`);
  process.exit(0);
});

start().catch(err => {
  console.error('💥 引擎发生致命错误:', err);
  process.exit(1);
});
