// 외부 공유 실행: Cloudflare 임시 터널(trycloudflare)을 열고, 새로 나온 주소에 맞춰 서버를 켭니다.
//
// 임시 터널은 켤 때마다 주소가 바뀌고, 서버는 시작할 때 지정한 공개 주소(ADSFORM_PUBLIC_ORIGIN)만 받습니다.
// 이 스크립트는 ① 켜져 있던 애즈폼 서버 종료 → ② 터널 열기 → ③ 터널 주소 확인 → ④ 그 주소로 서버 시작을 한 번에 합니다.
// 실행: start-share.cmd 더블클릭 또는 `npm run share`. 끝낼 때는 창에서 Ctrl+C(터널과 서버가 함께 꺼집니다).
//
//  · ADSFORM_DEMO      기본 1(테스트 로그인 버튼 유지). 주소를 아는 사람은 누구나 테스트 계정으로 들어올 수 있으니 0으로 끌 수 있습니다.
//  · ADSFORM_PORT      기본 3063
//  · CLOUDFLARED       cloudflared 실행 파일 경로(기본: PATH의 cloudflared)
import { spawn, spawnSync } from 'node:child_process';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.ADSFORM_PORT || 3063);
const windows = process.platform === 'win32';
const cloudflared = process.env.CLOUDFLARED || 'cloudflared';
const line = '='.repeat(64);
const children = [];
let closing = false;

function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) if (child.exitCode === null) child.kill();
  setTimeout(() => process.exit(code), 300);
}
function fail(message) {
  console.error(`\n[오류] ${message}\n`);
  stop(1);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

const portBusy = () => new Promise(done => {
  const socket = connect({ port, host: '127.0.0.1' });
  socket.once('connect', () => { socket.destroy(); done(true); });
  socket.once('error', () => done(false));
  socket.setTimeout(1500, () => { socket.destroy(); done(false); });
});
const sleep = ms => new Promise(done => setTimeout(done, ms));

// 포트를 잡고 있는 프로세스 목록 [{ pid, name }]
function listeners() {
  if (windows) {
    const out = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8', windowsHide: true }).stdout || '';
    const pids = [...new Set(out.split(/\r?\n/).map(row => row.trim().split(/\s+/)).filter(cols => cols[0] === 'TCP' && cols[1]?.endsWith(`:${port}`) && cols[3] === 'LISTENING').map(cols => Number(cols[4])))];
    return pids.filter(pid => pid > 4).map(pid => {
      const row = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }).stdout || '';
      return { pid, name: (row.match(/^"([^"]+)"/m)?.[1] || '').toLowerCase() };
    });
  }
  const out = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc'], { encoding: 'utf8' }).stdout || '';
  return [...out.matchAll(/p(\d+)\nc(.*)/g)].map(match => ({ pid: Number(match[1]), name: match[2].toLowerCase() }));
}

// 같은 포트에서 돌고 있는 이전 애즈폼 서버(node)를 끕니다. node가 아닌 프로그램이면 건드리지 않고 알려 줍니다.
async function freePort() {
  if (!await portBusy()) return;
  const found = listeners();
  const others = found.filter(item => !/^node(\.exe)?$/.test(item.name));
  if (others.length) throw new Error(`포트 ${port}을 다른 프로그램이 쓰고 있습니다: ${others.map(item => `${item.name || '알 수 없음'}(PID ${item.pid})`).join(', ')}\n해당 프로그램을 끄고 다시 실행해 주세요.`);
  console.log(`포트 ${port}에서 실행 중인 이전 서버를 종료합니다${found.length ? ` (PID ${found.map(item => item.pid).join(', ')})` : ''}...`);
  let denied = '';
  for (const { pid } of found) {
    if (windows) {
      const killed = spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { encoding: 'utf8', windowsHide: true });
      if (killed.status !== 0) denied = (killed.stderr || killed.stdout || '').trim();
    } else {
      try { process.kill(pid, 'SIGKILL'); } catch (error) { denied = error.message; }
    }
  }
  for (let i = 0; i < 24; i++) {
    if (!await portBusy()) return;
    await sleep(250);
  }
  throw new Error(`이전 서버를 끄지 못했습니다${found.length ? ` (PID ${found.map(item => item.pid).join(', ')})` : ''}.${denied ? `\n${denied}` : ''}\n` +
    (windows ? '관리자 권한으로 켜진 서버일 수 있어요. start-share.cmd를 마우스 오른쪽 버튼 → ‘관리자 권한으로 실행’으로 다시 실행하거나, 작업 관리자 › 세부 정보에서 node.exe를 끝내 주세요.' : '해당 프로세스를 직접 종료한 뒤 다시 실행해 주세요.'));
}

function openTunnel() {
  return new Promise((done, reject) => {
    const tunnel = spawn(cloudflared, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    children.push(tunnel);
    let log = '';
    let found = false;
    const timer = setTimeout(() => { if (!found) reject(new Error(`터널 주소를 60초 안에 받지 못했습니다. 인터넷 연결을 확인해 주세요.\n${log.slice(-600)}`)); }, 60_000);
    const read = chunk => {
      if (found) return;
      log += chunk;
      const match = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (!match) return;
      found = true;
      clearTimeout(timer);
      done(match[0]);
    };
    tunnel.stdout.on('data', read);
    tunnel.stderr.on('data', read);
    tunnel.once('error', error => {
      clearTimeout(timer);
      reject(new Error(error.code === 'ENOENT'
        ? 'cloudflared를 찾을 수 없습니다. 설치 후 창을 새로 열어 다시 실행해 주세요.\n  설치: winget install --id Cloudflare.cloudflared'
        : `cloudflared 실행 실패: ${error.message}`));
    });
    tunnel.once('exit', code => {
      clearTimeout(timer);
      if (!found) reject(new Error(`cloudflared가 종료됐습니다(코드 ${code}).\n${log.slice(-600)}`));
      else if (!closing) fail('터널이 끊어졌습니다. 다시 실행하면 새 주소가 나옵니다.');
    });
  });
}

try {
  await freePort();
  console.log('Cloudflare 터널을 여는 중입니다...');
  const origin = await openTunnel();
  const demo = process.env.ADSFORM_DEMO ?? '1';
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', join(root, 'server.mjs')], {
    cwd: root, stdio: 'inherit', windowsHide: true,
    // 터널(프록시) 뒤이므로 접속 IP는 X-Forwarded-For에서 읽습니다.
    env: { ...process.env, ADSFORM_PORT: String(port), ADSFORM_PUBLIC_ORIGIN: origin, ADSFORM_DEMO: demo, ADSFORM_TRUST_PROXY: process.env.ADSFORM_TRUST_PROXY ?? '1' }
  });
  children.push(server);
  server.once('exit', code => { if (!closing) fail(`서버가 종료됐습니다(코드 ${code}). 위 오류 내용을 확인해 주세요.`); });
  let copied = false;
  if (windows) copied = spawnSync('clip', { input: origin, windowsHide: true }).status === 0;
  for (let i = 0; i < 40 && !await portBusy(); i++) await sleep(250);
  if (closing) process.exit(1);
  console.log(`\n${line}\n  외부 접속 주소${copied ? ' (클립보드에 복사됨)' : ''}\n\n    ${origin}\n\n  PC에서 볼 때   http://127.0.0.1:${port}\n${line}`);
  console.log(`  · 이 창을 닫거나 Ctrl+C를 누르면 터널과 서버가 함께 꺼집니다.\n  · 다시 실행하면 주소가 새로 바뀝니다. 주소가 준비되기까지 10~20초 걸릴 수 있어요.\n  · 로그인은 주소마다 따로입니다. 새 주소에서는 다시 로그인해 주세요.${demo !== '0' ? '\n  · 테스트 로그인이 켜져 있어 이 주소를 아는 사람은 누구나 테스트 계정으로 들어올 수 있습니다. 주소 공유에 주의하세요.' : ''}\n`);
} catch (error) {
  fail(error.message);
}
