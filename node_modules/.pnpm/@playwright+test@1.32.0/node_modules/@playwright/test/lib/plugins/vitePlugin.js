"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createPlugin = createPlugin;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _babelBundle = require("../common/babelBundle");
var _utilsBundle = require("../utilsBundle");
var _tsxTransform = require("../common/tsxTransform");
var _utils = require("playwright-core/lib/utils");
var _compilationCache = require("../common/compilationCache");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

let stoppableServer;
const playwrightVersion = (0, _utils.getPlaywrightVersion)();
const importReactRE = /(^|\n)import\s+(\*\s+as\s+)?React(,|\s+)/;
const compiledReactRE = /(const|var)\s+React\s*=/;
function createPlugin(registerSourceFile, frameworkPluginFactory) {
  let configDir;
  let config;
  return {
    name: 'playwright-vite-plugin',
    setup: async (configObject, configDirectory) => {
      config = configObject;
      configDir = configDirectory;
    },
    begin: async suite => {
      var _viteConfig$build;
      const use = config.projects[0].use;
      const port = use.ctPort || 3100;
      const viteConfig = typeof use.ctViteConfig === 'function' ? await use.ctViteConfig() : use.ctViteConfig || {};
      const relativeTemplateDir = use.ctTemplateDir || 'playwright';
      const rootDir = viteConfig.root || configDir;
      const templateDir = _path.default.join(rootDir, relativeTemplateDir);
      const outDir = (viteConfig === null || viteConfig === void 0 ? void 0 : (_viteConfig$build = viteConfig.build) === null || _viteConfig$build === void 0 ? void 0 : _viteConfig$build.outDir) || (use.ctCacheDir ? _path.default.resolve(rootDir, use.ctCacheDir) : _path.default.resolve(templateDir, '.cache'));
      const buildInfoFile = _path.default.join(outDir, 'metainfo.json');
      let buildExists = false;
      let buildInfo;
      const registerSource = await _fs.default.promises.readFile(registerSourceFile, 'utf-8');
      const registerSourceHash = (0, _utils.calculateSha1)(registerSource);
      const {
        version: viteVersion
      } = require('vite/package.json');
      try {
        buildInfo = JSON.parse(await _fs.default.promises.readFile(buildInfoFile, 'utf-8'));
        (0, _utils.assert)(buildInfo.version === playwrightVersion);
        (0, _utils.assert)(buildInfo.viteVersion === viteVersion);
        (0, _utils.assert)(buildInfo.registerSourceHash === registerSourceHash);
        buildExists = true;
      } catch (e) {
        buildInfo = {
          version: playwrightVersion,
          viteVersion,
          registerSourceHash,
          components: [],
          tests: {},
          sources: {}
        };
      }
      const componentRegistry = new Map();
      // 1. Re-parse changed tests and collect required components.
      const hasNewTests = await checkNewTests(suite, buildInfo, componentRegistry);
      // 2. Check if the set of required components has changed.
      const hasNewComponents = await checkNewComponents(buildInfo, componentRegistry);
      // 3. Check component sources.
      const sourcesDirty = !buildExists || hasNewComponents || (await checkSources(buildInfo));
      // 4. Update component info.
      buildInfo.components = [...componentRegistry.values()];
      viteConfig.root = rootDir;
      viteConfig.preview = {
        port,
        ...viteConfig.preview
      };
      viteConfig.build = {
        outDir
      };

      // React heuristic. If we see a component in a file with .js extension,
      // consider it a potential JSX-in-JS scenario and enable JSX loader for all
      // .js files.
      if (hasJSComponents(buildInfo.components)) {
        viteConfig.esbuild = {
          loader: 'jsx',
          include: /.*\.jsx?$/,
          exclude: []
        };
        viteConfig.optimizeDeps = {
          esbuildOptions: {
            loader: {
              '.js': 'jsx'
            }
          }
        };
      }
      const {
        build,
        preview
      } = require('vite');
      // Build config unconditionally, either build or build & preview will use it.
      viteConfig.plugins = viteConfig.plugins || [await frameworkPluginFactory()];
      // But only add out own plugin when we actually build / transform.
      if (sourcesDirty) viteConfig.plugins.push(vitePlugin(registerSource, relativeTemplateDir, buildInfo, componentRegistry));
      viteConfig.configFile = viteConfig.configFile || false;
      viteConfig.define = viteConfig.define || {};
      viteConfig.define.__VUE_PROD_DEVTOOLS__ = true;
      viteConfig.css = viteConfig.css || {};
      viteConfig.css.devSourcemap = true;
      viteConfig.build = {
        ...viteConfig.build,
        target: 'esnext',
        minify: false,
        rollupOptions: {
          treeshake: false,
          input: {
            index: _path.default.join(templateDir, 'index.html')
          }
        },
        sourcemap: true
      };
      if (sourcesDirty) {
        await build(viteConfig);
        await _fs.default.promises.rename(`${outDir}/${relativeTemplateDir}/index.html`, `${outDir}/index.html`);
      }
      if (hasNewTests || hasNewComponents || sourcesDirty) await _fs.default.promises.writeFile(buildInfoFile, JSON.stringify(buildInfo, undefined, 2));
      for (const [filename, testInfo] of Object.entries(buildInfo.tests)) (0, _compilationCache.setExternalDependencies)(filename, testInfo.deps);
      const previewServer = await preview(viteConfig);
      stoppableServer = (0, _utilsBundle.stoppable)(previewServer.httpServer, 0);
      const isAddressInfo = x => x === null || x === void 0 ? void 0 : x.address;
      const address = previewServer.httpServer.address();
      if (isAddressInfo(address)) {
        const protocol = viteConfig.preview.https ? 'https:' : 'http:';
        process.env.PLAYWRIGHT_TEST_BASE_URL = `${protocol}//localhost:${address.port}`;
      }
    },
    end: async () => {
      await new Promise(f => stoppableServer.stop(f));
    }
  };
}
async function checkSources(buildInfo) {
  for (const [source, sourceInfo] of Object.entries(buildInfo.sources)) {
    try {
      const timestamp = (await _fs.default.promises.stat(source)).mtimeMs;
      if (sourceInfo.timestamp !== timestamp) return true;
    } catch (e) {
      return true;
    }
  }
  return false;
}
async function checkNewTests(suite, buildInfo, componentRegistry) {
  const testFiles = new Set();
  for (const project of suite.suites) {
    for (const file of project.suites) testFiles.add(file.location.file);
  }
  let hasNewTests = false;
  for (const testFile of testFiles) {
    var _buildInfo$tests$test;
    const timestamp = (await _fs.default.promises.stat(testFile)).mtimeMs;
    if (((_buildInfo$tests$test = buildInfo.tests[testFile]) === null || _buildInfo$tests$test === void 0 ? void 0 : _buildInfo$tests$test.timestamp) !== timestamp) {
      const components = await parseTestFile(testFile);
      for (const component of components) componentRegistry.set(component.fullName, component);
      buildInfo.tests[testFile] = {
        timestamp,
        components: components.map(c => c.fullName),
        deps: []
      };
      hasNewTests = true;
    }
  }
  return hasNewTests;
}
async function checkNewComponents(buildInfo, componentRegistry) {
  const newComponents = [...componentRegistry.keys()];
  const oldComponents = new Map(buildInfo.components.map(c => [c.fullName, c]));
  let hasNewComponents = false;
  for (const c of newComponents) {
    if (!oldComponents.has(c)) {
      hasNewComponents = true;
      break;
    }
  }
  for (const c of oldComponents.values()) componentRegistry.set(c.fullName, c);
  return hasNewComponents;
}
async function parseTestFile(testFile) {
  const text = await _fs.default.promises.readFile(testFile, 'utf-8');
  const ast = (0, _babelBundle.parse)(text, {
    errorRecovery: true,
    plugins: ['typescript', 'jsx'],
    sourceType: 'module'
  });
  const componentUsages = (0, _tsxTransform.collectComponentUsages)(ast);
  const result = [];
  (0, _babelBundle.traverse)(ast, {
    enter: p => {
      if (_babelBundle.types.isImportDeclaration(p.node)) {
        const importNode = p.node;
        if (!_babelBundle.types.isStringLiteral(importNode.source)) return;
        for (const specifier of importNode.specifiers) {
          if (!componentUsages.names.has(specifier.local.name)) continue;
          if (_babelBundle.types.isImportNamespaceSpecifier(specifier)) continue;
          result.push((0, _tsxTransform.componentInfo)(specifier, importNode.source.value, testFile));
        }
      }
    }
  });
  return result;
}
function vitePlugin(registerSource, relativeTemplateDir, buildInfo, componentRegistry) {
  buildInfo.sources = {};
  let moduleResolver;
  return {
    name: 'playwright:component-index',
    configResolved(config) {
      moduleResolver = config.createResolver();
    },
    async transform(content, id) {
      const queryIndex = id.indexOf('?');
      const file = queryIndex !== -1 ? id.substring(0, queryIndex) : id;
      if (!buildInfo.sources[file]) {
        try {
          const timestamp = (await _fs.default.promises.stat(file)).mtimeMs;
          buildInfo.sources[file] = {
            timestamp
          };
        } catch {
          // Silent if can't read the file.
        }
      }

      // Vite React plugin will do this for .jsx files, but not .js files.
      if (id.endsWith('.js') && content.includes('React.createElement') && !content.match(importReactRE) && !content.match(compiledReactRE)) {
        const code = `import React from 'react';\n${content}`;
        return {
          code,
          map: {
            mappings: ''
          }
        };
      }
      const indexTs = _path.default.join(relativeTemplateDir, 'index.ts');
      const indexTsx = _path.default.join(relativeTemplateDir, 'index.tsx');
      const indexJs = _path.default.join(relativeTemplateDir, 'index.js');
      const indexJsx = _path.default.join(relativeTemplateDir, 'index.jsx');
      const idResolved = _path.default.resolve(id);
      if (!idResolved.endsWith(indexTs) && !idResolved.endsWith(indexTsx) && !idResolved.endsWith(indexJs) && !idResolved.endsWith(indexJsx)) return;
      const folder = _path.default.dirname(id);
      const lines = [content, ''];
      lines.push(registerSource);
      for (const [alias, value] of componentRegistry) {
        const importPath = value.isModuleOrAlias ? value.importPath : './' + _path.default.relative(folder, value.importPath).replace(/\\/g, '/');
        if (value.importedName) lines.push(`import { ${value.importedName} as ${alias} } from '${importPath}';`);else lines.push(`import ${alias} from '${importPath}';`);
      }
      lines.push(`pwRegister({ ${[...componentRegistry.keys()].join(',\n  ')} });`);
      return {
        code: lines.join('\n'),
        map: {
          mappings: ''
        }
      };
    },
    async writeBundle() {
      const componentDeps = new Map();
      for (const component of componentRegistry.values()) {
        const id = await moduleResolver(component.importPath);
        if (!id) continue;
        const deps = new Set();
        collectViteModuleDependencies(this, id, deps);
        componentDeps.set(component.fullName, deps);
      }
      for (const testInfo of Object.values(buildInfo.tests)) {
        const deps = new Set();
        for (const fullName of testInfo.components) {
          for (const dep of componentDeps.get(fullName) || []) deps.add(dep);
        }
        testInfo.deps = [...deps];
      }
    }
  };
}
function collectViteModuleDependencies(context, id, deps) {
  if (!_path.default.isAbsolute(id)) return;
  const normalizedId = _path.default.normalize(id);
  if (deps.has(normalizedId)) return;
  deps.add(normalizedId);
  const module = context.getModuleInfo(id);
  for (const importedId of (module === null || module === void 0 ? void 0 : module.importedIds) || []) collectViteModuleDependencies(context, importedId, deps);
  for (const importedId of (module === null || module === void 0 ? void 0 : module.dynamicallyImportedIds) || []) collectViteModuleDependencies(context, importedId, deps);
}
function hasJSComponents(components) {
  for (const component of components) {
    const extname = _path.default.extname(component.importPath);
    if (extname === '.js' || !extname && _fs.default.existsSync(component.importPath + '.js')) return true;
  }
  return false;
}