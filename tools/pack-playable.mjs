import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NETWORKS, adapterScript } from './playable/networks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const INLINE = ['index.html', 'style.css', 'src/polyfills.bundle.js', 'src/system.bundle.js', 'src/import-map.json'];
const CUBE_FACE = /@[0-9a-f]{5}@[0-9a-f]{5}\.png$/;

function readArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

function walk(dir, base = dir, out = []) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, base, out);
    else if (name !== '.DS_Store') out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

function hasTool(name) {
  try { execFileSync('which', [name], { stdio: 'pipe' }); return true; } catch { return false; }
}

function ffmpeg(input, args, ext) {
  const tmp = path.join(os.tmpdir(), `playable-${process.pid}-${Date.now()}.${ext}`);
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, ...args, tmp], { stdio: 'pipe' });
    return fs.readFileSync(tmp);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function smaller(original, make) {
  try {
    const out = make();
    return out.length < original.length ? out : original;
  } catch (e) {
    console.warn('  could not shrink a file, kept as it is:', String(e.message || e).split('\n')[0]);
    return original;
  }
}

function shrink(file, full, data, config, canShrink) {
  if (!canShrink) return data;
  if (file.endsWith('.mp3')) {
    const kbps = data.length > 500000 ? config.musicKbps : config.soundKbps;
    if (!kbps) return data;
    return smaller(data, () => ffmpeg(full, ['-ac', '1', '-b:a', `${kbps}k`, '-map_metadata', '-1'], 'mp3'));
  }
  if (CUBE_FACE.test(file) && config.cubeMapSize) {
    const s = config.cubeMapSize;
    return smaller(data, () => ffmpeg(full, ['-vf', `scale=${s}:${s}:flags=neighbor`], 'png'));
  }
  return data;
}

function tuneSettings(data, config) {
  const settings = JSON.parse(data.toString('utf8'));
  if (settings.splashScreen && config.splashMs <= 0) settings.splashScreen = { totalTime: 0 };
  else if (settings.splashScreen) settings.splashScreen.totalTime = config.splashMs;
  return Buffer.from(JSON.stringify(settings));
}

function buildPack(buildDir, config) {
  const canShrink = hasTool('ffmpeg');
  if (!canShrink) console.warn('ffmpeg not found: sounds and sky textures are packed at full size');
  const index = {}, parts = [];
  let offset = 0;
  for (const file of walk(buildDir)) {
    if (INLINE.includes(file)) continue;
    const full = path.join(buildDir, file);
    let data = shrink(file, full, fs.readFileSync(full), config, canShrink);
    if (file === 'src/settings.json') data = tuneSettings(data, config);
    index[file] = [offset, data.length];
    offset += data.length;
    parts.push(data);
  }
  const head = Buffer.from(JSON.stringify(index));
  const size = Buffer.alloc(4);
  size.writeUInt32LE(head.length);
  const raw = Buffer.concat([size, head, ...parts]);
  return { raw, packed: zlib.deflateRawSync(raw, { level: 9 }), files: Object.keys(index).length };
}

function safeScript(js) {
  return js.replace(/<\/script/gi, '<\\/script');
}

function page(buildDir, pack, network, config, level) {
  const n = NETWORKS[network];
  const read = f => fs.readFileSync(path.join(buildDir, f), 'utf8');
  const runtime = fs.readFileSync(path.join(HERE, 'playable/runtime.js'), 'utf8');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${config.title}</title>
<meta name="viewport" content="width=device-width,user-scalable=no,initial-scale=1,minimum-scale=1,maximum-scale=1,viewport-fit=cover">
${n.head || ''}
<style>${read('style.css')}
body { background-color: ${config.background || '#333'}; }</style>
<script>${safeScript(adapterScript(network, config, level))}</script>
</head>
<body>
<div id="GameDiv" cc_exact_fit_screen="true"><div id="Cocos3dGameContainer"><canvas id="GameCanvas" oncontextmenu="event.preventDefault()" tabindex="99"></canvas></div></div>
<script>${safeScript(read('src/polyfills.bundle.js'))}</script>
<script>${safeScript(read('src/system.bundle.js'))}</script>
<script>${safeScript(runtime)}</script>
<script type="application/octet-stream" id="playable-pack" data-size="${pack.raw.length}">${pack.packed.toString('base64')}</script>
<script>playablePack.start();</script>
</body>
</html>
`;
}

function mb(bytes) {
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function writeNetwork(network, html, config, outDir, tag) {
  const n = NETWORKS[network];
  const dir = path.join(outDir, network);
  fs.mkdirSync(dir, { recursive: true });
  const base = `${config.name}_${tag}_${network}`;
  let file, bytes;
  if (n.zip) {
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-'));
    fs.writeFileSync(path.join(stage, 'index.html'), html);
    for (const [name, text] of Object.entries(n.extraFiles || {})) fs.writeFileSync(path.join(stage, name), text);
    file = path.join(dir, base + '.zip');
    fs.rmSync(file, { force: true });
    execFileSync('zip', ['-q', '-9', '-r', file, '.'], { cwd: stage });
    fs.rmSync(stage, { recursive: true, force: true });
    bytes = fs.statSync(file).size;
  } else {
    file = path.join(dir, base + '.html');
    fs.writeFileSync(file, html);
    bytes = Buffer.byteLength(html);
  }
  const over = n.limitMb && bytes > n.limitMb * 1048576;
  console.log(`${over ? 'TOO BIG' : 'ok     '} ${network.padEnd(11)} ${mb(bytes).padStart(9)}${n.limitMb ? ` (limit ${n.limitMb} MB)` : ''}  ${path.relative(PROJECT, file)}`);
  return !over;
}

function main() {
  const args = readArgs(process.argv.slice(2));
  const config = JSON.parse(fs.readFileSync(path.resolve(PROJECT, args.config || 'tools/playable.config.json'), 'utf8'));
  const buildDir = path.resolve(PROJECT, args.build || config.buildDir);
  const outDir = path.resolve(PROJECT, args.out || config.outDir);
  const networks = (args.networks ? String(args.networks).split(',') : config.networks).map(s => s.trim()).filter(Boolean);
  const levels = typeof args.level === 'string' ? args.level.split(',').map(s => s.trim()).filter(Boolean) : [''];
  const unknown = networks.filter(n => !NETWORKS[n]);
  if (unknown.length) throw new Error(`Unknown network: ${unknown.join(', ')} (known: ${Object.keys(NETWORKS).join(', ')})`);
  if (!fs.existsSync(path.join(buildDir, 'index.html'))) throw new Error(`No web-mobile build in ${buildDir}. Build the project for Web Mobile first.`);
  for (const level of levels) {
    if (level && !fs.existsSync(path.join(PROJECT, 'assets', level.includes('/') ? level + '.json' : `levels/${level}.json`))) {
      throw new Error(`No such level: ${level}`);
    }
  }

  const pack = buildPack(buildDir, config);
  console.log(`${pack.files} files, ${mb(pack.raw.length)} -> ${mb(pack.packed.length)} compressed`);
  if (!config.iosUrl && !config.androidUrl) console.warn('No store URLs in the config: networks that open the store by URL (applovin, unity, ironsource, preview) have nowhere to go yet.');

  let allFit = true;
  for (const level of levels) {
    const tag = (level || 'scene').replace(/[^A-Za-z0-9]+/g, '-');
    for (const network of networks) {
      allFit = writeNetwork(network, page(buildDir, pack, network, config, level), config, outDir, tag) && allFit;
    }
  }
  if (!allFit) process.exitCode = 1;
}

main();
