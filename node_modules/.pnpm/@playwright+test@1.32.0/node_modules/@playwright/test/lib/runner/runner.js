"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Runner = void 0;
var _utils = require("playwright-core/lib/utils");
var _webServerPlugin = require("../plugins/webServerPlugin");
var _projectUtils = require("./projectUtils");
var _reporters = require("./reporters");
var _tasks = require("./tasks");
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _watchMode = require("./watchMode");
var _uiMode = require("./uiMode");
/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class Runner {
  constructor(config) {
    this._config = void 0;
    this._config = config;
  }
  async listTestFiles(projectNames) {
    const projects = (0, _projectUtils.filterProjects)(this._config.projects, projectNames);
    const report = {
      projects: []
    };
    for (const project of projects) {
      report.projects.push({
        ...sanitizeConfigForJSON(project, new Set()),
        files: await (0, _projectUtils.collectFilesForProject)(project)
      });
    }
    return report;
  }
  async runAllTests() {
    var _context$rootSuite;
    const config = this._config;
    const listOnly = config._internal.listOnly;
    const deadline = config.globalTimeout ? (0, _utils.monotonicTime)() + config.globalTimeout : 0;

    // Legacy webServer support.
    (0, _webServerPlugin.webServerPluginsForConfig)(config).forEach(p => config._internal.plugins.push({
      factory: p
    }));
    const reporter = await (0, _reporters.createReporter)(config, listOnly ? 'list' : 'run');
    const taskRunner = listOnly ? (0, _tasks.createTaskRunnerForList)(config, reporter, 'in-process') : (0, _tasks.createTaskRunner)(config, reporter);
    const context = {
      config,
      reporter,
      phases: []
    };
    reporter.onConfigure(config);
    if (!listOnly && config._internal.ignoreSnapshots) {
      reporter.onStdOut(_utilsBundle.colors.dim(['NOTE: running with "ignoreSnapshots" option. All of the following asserts are silently ignored:', '- expect().toMatchSnapshot()', '- expect().toHaveScreenshot()', ''].join('\n')));
    }
    const taskStatus = await taskRunner.run(context, deadline);
    let status = 'passed';
    if (context.phases.find(p => p.dispatcher.hasWorkerErrors()) || (_context$rootSuite = context.rootSuite) !== null && _context$rootSuite !== void 0 && _context$rootSuite.allTests().some(test => !test.ok())) status = 'failed';
    if (status === 'passed' && taskStatus !== 'passed') status = taskStatus;
    await reporter.onExit({
      status
    });

    // Calling process.exit() might truncate large stdout/stderr output.
    // See https://github.com/nodejs/node/issues/6456.
    // See https://github.com/nodejs/node/issues/12921
    await new Promise(resolve => process.stdout.write('', () => resolve()));
    await new Promise(resolve => process.stderr.write('', () => resolve()));
    return status;
  }
  async watchAllTests() {
    const config = this._config;
    (0, _webServerPlugin.webServerPluginsForConfig)(config).forEach(p => config._internal.plugins.push({
      factory: p
    }));
    return await (0, _watchMode.runWatchModeLoop)(config);
  }
  async uiAllTests() {
    const config = this._config;
    (0, _webServerPlugin.webServerPluginsForConfig)(config).forEach(p => config._internal.plugins.push({
      factory: p
    }));
    return await (0, _uiMode.runUIMode)(config);
  }
}
exports.Runner = Runner;
function sanitizeConfigForJSON(object, visited) {
  const type = typeof object;
  if (type === 'function' || type === 'symbol') return undefined;
  if (!object || type !== 'object') return object;
  if (object instanceof RegExp) return String(object);
  if (object instanceof Date) return object.toISOString();
  if (visited.has(object)) return undefined;
  visited.add(object);
  if (Array.isArray(object)) return object.map(a => sanitizeConfigForJSON(a, visited));
  const result = {};
  const keys = Object.keys(object).slice(0, 100);
  for (const key of keys) {
    if (key.startsWith('_')) continue;
    result[key] = sanitizeConfigForJSON(object[key], visited);
  }
  return result;
}