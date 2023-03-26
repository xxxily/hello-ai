"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ListModeReporter = void 0;
exports.createReporter = createReporter;
var _path = _interopRequireDefault(require("path"));
var _base = require("../reporters/base");
var _dot = _interopRequireDefault(require("../reporters/dot"));
var _empty = _interopRequireDefault(require("../reporters/empty"));
var _github = _interopRequireDefault(require("../reporters/github"));
var _html = _interopRequireDefault(require("../reporters/html"));
var _json = _interopRequireDefault(require("../reporters/json"));
var _junit = _interopRequireDefault(require("../reporters/junit"));
var _line = _interopRequireDefault(require("../reporters/line"));
var _list = _interopRequireDefault(require("../reporters/list"));
var _multiplexer = require("../reporters/multiplexer");
var _loadUtils = require("./loadUtils");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright Microsoft Corporation. All rights reserved.
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

async function createReporter(config, mode, additionalReporters = []) {
  const defaultReporters = {
    dot: mode === 'list' ? ListModeReporter : _dot.default,
    line: mode === 'list' ? ListModeReporter : _line.default,
    list: mode === 'list' ? ListModeReporter : _list.default,
    github: _github.default,
    json: _json.default,
    junit: _junit.default,
    null: _empty.default,
    html: mode === 'ui' ? _line.default : _html.default
  };
  const reporters = [];
  if (mode === 'watch') {
    reporters.push(new _list.default());
  } else {
    for (const r of config.reporter) {
      const [name, arg] = r;
      if (name in defaultReporters) {
        reporters.push(new defaultReporters[name](arg));
      } else {
        const reporterConstructor = await (0, _loadUtils.loadReporter)(config, name);
        reporters.push(new reporterConstructor(arg));
      }
    }
    reporters.push(...additionalReporters);
    if (process.env.PW_TEST_REPORTER) {
      const reporterConstructor = await (0, _loadUtils.loadReporter)(config, process.env.PW_TEST_REPORTER);
      reporters.push(new reporterConstructor());
    }
  }
  const someReporterPrintsToStdio = reporters.some(r => {
    const prints = r.printsToStdio ? r.printsToStdio() : true;
    return prints;
  });
  if (reporters.length && !someReporterPrintsToStdio) {
    // Add a line/dot/list-mode reporter for convenience.
    // Important to put it first, jsut in case some other reporter stalls onEnd.
    if (mode === 'list') reporters.unshift(new ListModeReporter());else reporters.unshift(!process.env.CI ? new _line.default({
      omitFailures: true
    }) : new _dot.default());
  }
  return new _multiplexer.Multiplexer(reporters);
}
class ListModeReporter {
  constructor() {
    this.config = void 0;
  }
  onBegin(config, suite) {
    this.config = config;
    // eslint-disable-next-line no-console
    console.log(`Listing tests:`);
    const tests = suite.allTests();
    const files = new Set();
    for (const test of tests) {
      // root, project, file, ...describes, test
      const [, projectName,, ...titles] = test.titlePath();
      const location = `${_path.default.relative(config.rootDir, test.location.file)}:${test.location.line}:${test.location.column}`;
      const projectTitle = projectName ? `[${projectName}] › ` : '';
      // eslint-disable-next-line no-console
      console.log(`  ${projectTitle}${location} › ${titles.join(' ')}`);
      files.add(test.location.file);
    }
    // eslint-disable-next-line no-console
    console.log(`Total: ${tests.length} ${tests.length === 1 ? 'test' : 'tests'} in ${files.size} ${files.size === 1 ? 'file' : 'files'}`);
  }
  onError(error) {
    // eslint-disable-next-line no-console
    console.error('\n' + (0, _base.formatError)(this.config, error, false).message);
  }
}
exports.ListModeReporter = ListModeReporter;