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

  while (true) {
    await runOnce();
    
    // 每次执行后停顿 5 秒，防止过快请求导致被封或资源占用过高
    console.log(`\n⏳ 等待 5 秒后进行下一次迭代...`);
    await new Promise(r => setTimeout(r, 5000));
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
