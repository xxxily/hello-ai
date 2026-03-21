import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let count = 0;

/**
 * 运行一次 ai:discover-eval 任务
 */
async function runOnce() {
  count++;
  const startTime = new Date();

  console.log('\n' + '█'.repeat(60));
  console.log(`🚀 第 ${count} 次任务开始于: ${startTime.toLocaleString()}`);
  console.log('█'.repeat(60) + '\n');

  return new Promise((resolve) => {
    // 使用 npm run ai:discover-eval 执行
    const child = spawn('npm', ['run', 'ai:discover-eval'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    });

    child.on('close', (code) => {
      const endTime = new Date();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log('\n' + '─'.repeat(40));
      console.log(`✅ 第 ${count} 次任务已完成 (耗时: ${duration}s)`);
      if (code !== 0) {
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
 * 主循环函数
 */
async function start() {
  process.stdout.write('\x1Bc'); // 清屏
  console.log('┌────────────────────────────────────────────────────────┐');
  console.log('│                                                        │');
  console.log('│   🤖 Hello-AI 持续发现与评估引擎已启动                 │');
  console.log('│   按 Ctrl+C 可停止执行                                 │');
  console.log('│                                                        │');
  console.log('└────────────────────────────────────────────────────────┘');

  const MIN_INTERVAL_MS = 60 * 1000; // 最少间隔 1 分钟 (60,000 毫秒)

  while (true) {
    const cycleStartTime = Date.now();
    await runOnce();

    const cycleEndTime = Date.now();
    const elapsedMs = cycleEndTime - cycleStartTime;
    const remainingMs = Math.max(0, MIN_INTERVAL_MS - elapsedMs);

    if (remainingMs > 0) {
      console.log(`\n⏳ 本轮执行耗时 ${(elapsedMs / 1000).toFixed(1)}s，正在等待 ${(remainingMs / 1000).toFixed(1)}s 以满足 1 分钟间隔标准...`);
      await new Promise(r => setTimeout(r, remainingMs));
    } else {
      console.log(`\n🚀 本轮执行耗时 ${(elapsedMs / 1000).toFixed(1)}s (已超过 1 分钟)，准备进入下一次迭代...`);
      // 即使超过了 1 分钟，也强制停顿 5 秒缓冲，防止无间断高频执行
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
