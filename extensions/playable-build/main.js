'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const NAME = 'playable-build';
const LOG_LIMIT = 400;
const NODE_PLACES = ['/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node'];
const EXTRA_PATH = ['/opt/homebrew/bin', '/usr/local/bin'];

let child = null;
let log = [];
let status = 'idle';
let nodePath = '';

function projectPath() {
  return Editor.Project.path;
}

function configPath() {
  return path.join(projectPath(), 'tools', 'playable.config.json');
}

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
}

function levelsIn(folder, prefix) {
  const dir = path.join(projectPath(), 'assets', 'resources', folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => prefix + f.slice(0, -5));
}

function networkNames() {
  const file = path.join(projectPath(), 'tools', 'playable', 'networks.mjs');
  const text = fs.readFileSync(file, 'utf8');
  const body = text.slice(text.indexOf('export const NETWORKS'), text.indexOf('export function'));
  const names = [];
  const pattern = /^ {2}([A-Za-z0-9_]+): \{/gm;
  for (let m = pattern.exec(body); m; m = pattern.exec(body)) names.push(m[1]);
  return names;
}

function findNode() {
  if (nodePath) return nodePath;
  try {
    const found = execFileSync('/bin/zsh', ['-lc', 'command -v node'], { encoding: 'utf8', timeout: 8000 }).trim().split('\n').pop();
    if (found && fs.existsSync(found)) return (nodePath = found);
  } catch (e) {
    nodePath = '';
  }
  return (nodePath = NODE_PLACES.find(p => fs.existsSync(p)) || '');
}

function addLog(text) {
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    log.push(line);
    console.log(`[Playable] ${line}`);
  }
  if (log.length > LOG_LIMIT) log = log.slice(-LOG_LIMIT);
}

function command(options) {
  const script = options.mode === 'pack' ? 'pack-playable.mjs' : 'build-playable.mjs';
  const args = [path.join(projectPath(), 'tools', script)];
  if (options.levels && options.levels.length) args.push('--level', options.levels.join(','));
  if (options.networks && options.networks.length) args.push('--networks', options.networks.join(','));
  return args;
}

exports.methods = {
  openPanel() {
    Editor.Panel.open(NAME);
  },

  getState() {
    let config = null, error = '';
    try {
      config = readConfig();
    } catch (e) {
      error = `Could not read tools/playable.config.json: ${e.message}`;
    }
    return {
      status,
      running: !!child,
      log: log.slice(),
      error,
      config,
      levels: levelsIn('FinalLevels', 'FinalLevels/').concat(levelsIn('levels', '')),
      networks: error ? [] : networkNames(),
      outDir: config ? path.resolve(projectPath(), config.outDir) : '',
    };
  },

  saveSettings(settings) {
    const config = readConfig();
    for (const key of ['iosUrl', 'androidUrl']) if (typeof settings[key] === 'string') config[key] = settings[key].trim();
    if (Array.isArray(settings.networks)) config.networks = settings.networks;
    fs.writeFileSync(configPath(), JSON.stringify(config, null, 2) + '\n');
    return true;
  },

  run(options) {
    if (child) return false;
    const node = findNode();
    if (!node) {
      log = [];
      addLog('Node.js was not found on this computer. Install it from nodejs.org, then try again.');
      status = 'failed';
      return false;
    }
    log = [];
    status = 'running';
    addLog(options.mode === 'pack' ? 'Packing the last build...' : 'Building and packing...');
    const env = Object.assign({}, process.env, { PATH: [path.dirname(node)].concat(EXTRA_PATH, process.env.PATH || '').join(':') });
    child = spawn(node, command(options), { cwd: projectPath(), env });
    child.stdout.on('data', d => addLog(d));
    child.stderr.on('data', d => addLog(d));
    child.on('error', e => {
      addLog(`Could not start: ${e.message}`);
      status = 'failed';
      child = null;
    });
    child.on('close', code => {
      if (!child) return;
      child = null;
      status = code === 0 ? 'done' : 'failed';
      addLog(code === 0 ? 'Finished.' : `Stopped with an error (code ${code}).`);
    });
    return true;
  },

  stop() {
    if (!child) return false;
    const running = child;
    child = null;
    running.kill();
    status = 'failed';
    addLog('Stopped.');
    return true;
  },

  openOutput() {
    const dir = path.resolve(projectPath(), readConfig().outDir);
    fs.mkdirSync(dir, { recursive: true });
    require('electron').shell.openPath(dir);
    return dir;
  },
};

exports.load = function () {};

exports.unload = function () {
  if (child) child.kill();
  child = null;
};
