import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const BUILD_OK = 36;

function metaFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) metaFiles(full, out);
    else if (name.endsWith('.meta')) out.push(full);
  }
  return out;
}

function snapshot(dir) {
  const files = new Map();
  if (fs.existsSync(dir)) for (const f of metaFiles(dir)) files.set(f, fs.readFileSync(f));
  return files;
}

function restore(files) {
  let fixed = 0;
  for (const [file, data] of files) {
    if (fs.existsSync(file) && fs.readFileSync(file).equals(data)) continue;
    fs.writeFileSync(file, data);
    fixed++;
  }
  return fixed;
}

function copyProject(work) {
  fs.mkdirSync(work, { recursive: true });
  for (const dir of ['assets', 'settings']) {
    execFileSync('rsync', ['-a', '--delete', path.join(PROJECT, dir) + '/', path.join(work, dir) + '/']);
  }
  for (const file of ['package.json', 'tsconfig.json']) fs.copyFileSync(path.join(PROJECT, file), path.join(work, file));
  fs.copyFileSync(path.join(HERE, 'playable/engine-modules.json'), path.join(work, 'settings/v2/packages/engine.json'));
}

function main() {
  const args = process.argv.slice(2);
  const config = JSON.parse(fs.readFileSync(path.join(HERE, 'playable.config.json'), 'utf8'));
  const version = JSON.parse(fs.readFileSync(path.join(PROJECT, 'package.json'), 'utf8')).creator.version;
  const creator = config.creator || `/Applications/Cocos/Creator/${version}/CocosCreator.app/Contents/MacOS/CocosCreator`;
  if (!fs.existsSync(creator)) throw new Error(`Cocos Creator not found at ${creator}. Set "creator" in tools/playable.config.json.`);
  const work = path.resolve(PROJECT, config.workDir || 'build/.playable-project');
  const engineAssets = path.resolve(path.dirname(creator), '../Resources/resources/3d/engine/editor/assets');

  console.log('Copying the project to', path.relative(PROJECT, work));
  copyProject(work);
  fs.rmSync(path.join(work, 'build/web-mobile'), { recursive: true, force: true });

  console.log('Building for Web Mobile (this takes a minute or two)...');
  const engineMetas = snapshot(engineAssets);
  const run = spawnSync(creator, ['--project', work, '--build', 'platform=web-mobile;debug=false'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  fs.writeFileSync(path.join(work, 'build.log'), (run.stdout || '') + (run.stderr || ''));
  const fixed = restore(engineMetas);
  if (fixed) console.warn(`Cocos Creator rewrote ${fixed} of its own built-in asset files while starting; they were put back.`);

  const built = path.join(work, 'build/web-mobile');
  if (run.status !== BUILD_OK || !fs.existsSync(path.join(built, 'index.html'))) {
    fs.rmSync(path.join(work, 'library'), { recursive: true, force: true });
    fs.rmSync(path.join(work, 'temp'), { recursive: true, force: true });
    throw new Error(`The build failed (exit code ${run.status}). Log: ${path.relative(PROJECT, path.join(work, 'build.log'))}. Run the command again.`);
  }

  const target = path.resolve(PROJECT, config.buildDir);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(built, target, { recursive: true });
  console.log('Built', path.relative(PROJECT, target));

  const pack = spawnSync(process.execPath, [path.join(HERE, 'pack-playable.mjs'), ...args], { stdio: 'inherit' });
  process.exitCode = pack.status || 0;
}

main();
