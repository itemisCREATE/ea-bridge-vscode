// Collects the real EA Bridge artefacts the video shows into ./assets/:
//   - logo + UML type icons from the extension resources
//   - the sample model's ClassDiagram, rendered to SVG by the extension's own
//     headless renderer (driven through the bundled MCP server over stdio)
//   - the real CLI answer used in the AI scene (data.json)
// The results are committed, so this is only needed to refresh them (`npm run build -- --assets`).
//
// Needs the EA Bridge development repo with a built extension (extension/dist/assets/).
// Location: EA_BRIDGE_REPO env var, else two levels up (ea-vsc-bmad/ea-bridge-vscode/video-sources).

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(process.env.EA_BRIDGE_REPO ?? path.join(here, '..', '..'));
const assets = path.join(here, 'assets');
const model = path.join(repo, 'fixtures', 'SampleEAModel.qea');
const pluginRoot = path.join(repo, 'extension', 'dist', 'assets');
const cli = path.join(pluginRoot, 'bin', process.platform === 'win32' ? 'ea-bridge.exe' : 'ea-bridge');

for (const [what, p] of [['sample model', model], ['built extension assets', pluginRoot], ['bundled CLI', cli]]) {
    if (!fs.existsSync(p)) {
        console.error(`prepare-assets: ${what} not found at ${p}\n`
            + 'Point EA_BRIDGE_REPO at the EA Bridge dev repo and build the extension (npm run compile in extension/).');
        process.exit(1);
    }
}

fs.mkdirSync(path.join(assets, 'icons'), { recursive: true });

// --- 1. Logo + icons ---------------------------------------------------------
fs.copyFileSync(path.join(repo, 'extension', 'resources', 'ea-bridge-256.svg'), path.join(assets, 'logo.svg'));
for (const icon of ['Package', 'Class', 'Interface', 'DataType', 'Enumeration', 'Diagram', 'Note', 'Property', 'Operation']) {
    const src = path.join(repo, 'extension', 'resources', 'icons', `${icon}.gif`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(assets, 'icons', `${icon}.gif`));
    else console.warn(`icon missing: ${icon}`);
}
console.log('copied logo + icons');

// --- 2. Real query answer for the AI scene ------------------------------------
// Same jq the assistant would construct for "Which classes inherit from NamedElement?"
const jq = '.elements as $e | [.connectors[] | select(.connectorType=="Generalization" and $e[.targetElementGuid].name=="NamedElement") | $e[.sourceElementGuid].name] | sort';
const answer = JSON.parse(execFileSync(cli, ['query', model, jq], { encoding: 'utf8' }));
fs.writeFileSync(path.join(assets, 'data.json'), JSON.stringify({ jq, answer }, null, 2));
console.log('query answer:', answer);

// --- 3. ClassDiagram → SVG via the bundled MCP server -------------------------
function mcpSession() {
    const proc = spawn(process.execPath, [path.join(pluginRoot, 'mcp', 'ea-bridge-mcp.js')], {
        env: { ...process.env, EA_BRIDGE_PLUGIN_ROOT: pluginRoot, EA_BRIDGE_PROJECT_DIR: here },
        stdio: ['pipe', 'pipe', 'inherit'],
    });
    let buf = '';
    let nextId = 1;
    const pending = new Map();
    proc.stdout.on('data', (chunk) => {
        buf += chunk;
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const msg = JSON.parse(line);
            if (msg.id !== undefined && pending.has(msg.id)) {
                pending.get(msg.id)(msg);
                pending.delete(msg.id);
            }
        }
    });
    const send = (obj) => proc.stdin.write(JSON.stringify(obj) + '\n');
    return {
        request(method, params) {
            const id = nextId++;
            return new Promise((resolve, reject) => {
                pending.set(id, (msg) => (msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)));
                send({ jsonrpc: '2.0', id, method, params });
            });
        },
        notify(method, params) { send({ jsonrpc: '2.0', method, params }); },
        close() { proc.stdin.end(); proc.kill(); },
    };
}

const mcp = mcpSession();
try {
    await mcp.request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'feature-video', version: '1.0.0' },
    });
    mcp.notify('notifications/initialized', {});

    const listed = await mcp.request('tools/call', { name: 'list_diagrams', arguments: { model } });
    const listText = listed.content.map((c) => c.text).join('\n');
    const guid = (listText.match(/\{[0-9A-Fa-f-]{36}\}/) ?? [])[0];
    if (!guid) throw new Error(`no diagram GUID in list_diagrams output:\n${listText}`);

    const exported = await mcp.request('tools/call', {
        name: 'export_diagram_svg',
        arguments: { model, diagramGuids: [guid], outputPath: 'assets/ClassDiagram.svg' },
    });
    if (exported.isError) throw new Error(exported.content.map((c) => c.text).join('\n'));
    console.log('exported ClassDiagram.svg', fs.statSync(path.join(assets, 'ClassDiagram.svg')).size, 'bytes');
} finally {
    mcp.close();
}
