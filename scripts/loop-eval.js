import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let count = 0;

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
 * TUI 交互模式
 */
async function tuiMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  console.log('\n🛠️  [Hello-AI] 交互式启动配置\n');

  const mode = await question('1. 选择运行模式:\n   [1] 持续发现与评估 (默认)\n   [2] 仅评估已存在的队列数据 (Consume Only)\n   选择 [1]: ') || '1';

  const sort = await question('\n2. 选择话题探索策略:\n   [1] 按时间 (Time)(默认)\n   [2] 按质量 (Quality)\n   选择 [1]: ') || '1';

  let order = '';
  if (sort === '2') {
    order = await question('\n3. 质量排序细化:\n   [1] 精品优先 (高分 -> 低分, 默认)\n   [2] 潜力挖掘 (低分 -> 高分)\n   选择 [1]: ') || '1';
  } else {
    order = await question('\n3. 时间排序细化:\n   [1] 默认模式 (未探索过的优先)\n   [2] 更新模式 (已探索过的优先 - 用于更新项目数据)\n   选择 [1]: ') || '1';
  }

  const extraArgs = [];
  if (mode === '2') extraArgs.push('--consume-only');

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
    extraArgs = await tuiMenu();
  } else {
    // 兼容原有参数传递
    if (process.argv.includes('--consume-only')) extraArgs.push('--consume-only');
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

  while (true) {
    const cycleStartTime = Date.now();
    const childExitCode = await runOnce(extraArgs);

    if (isConsumeOnly && childExitCode === 2) {
      console.log('\n🎉 所有待处理队列的数据已被评估完毕，任务圆满结束（基于 --consume-only 参数自动退出循环）。');
      process.exit(0);
    }

    const cycleEndTime = Date.now();
    const elapsedMs = cycleEndTime - cycleStartTime;
    const remainingMs = Math.max(0, MIN_INTERVAL_MS - elapsedMs);

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
