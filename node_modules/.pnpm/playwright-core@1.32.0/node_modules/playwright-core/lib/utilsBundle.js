"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.minimatch = exports.mime = exports.lockfile = exports.jpegjs = exports.getProxyForUrl = exports.debug = exports.colors = exports.SocksProxyAgent = exports.PNG = exports.HttpsProxyAgent = void 0;
exports.ms = ms;
exports.parseStackTraceLine = parseStackTraceLine;
exports.wsServer = exports.wsSender = exports.wsReceiver = exports.ws = exports.rimraf = exports.progress = exports.program = void 0;
var _url = _interopRequireDefault(require("url"));
var _path = _interopRequireDefault(require("path"));
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

const colors = require('./utilsBundleImpl').colors;
exports.colors = colors;
const debug = require('./utilsBundleImpl').debug;
exports.debug = debug;
const getProxyForUrl = require('./utilsBundleImpl').getProxyForUrl;
exports.getProxyForUrl = getProxyForUrl;
const HttpsProxyAgent = require('./utilsBundleImpl').HttpsProxyAgent;
exports.HttpsProxyAgent = HttpsProxyAgent;
const jpegjs = require('./utilsBundleImpl').jpegjs;
exports.jpegjs = jpegjs;
const lockfile = require('./utilsBundleImpl').lockfile;
exports.lockfile = lockfile;
const mime = require('./utilsBundleImpl').mime;
exports.mime = mime;
const minimatch = require('./utilsBundleImpl').minimatch;
exports.minimatch = minimatch;
const PNG = require('./utilsBundleImpl').PNG;
exports.PNG = PNG;
const program = require('./utilsBundleImpl').program;
exports.program = program;
const progress = require('./utilsBundleImpl').progress;
exports.progress = progress;
const rimraf = require('./utilsBundleImpl').rimraf;
exports.rimraf = rimraf;
const SocksProxyAgent = require('./utilsBundleImpl').SocksProxyAgent;
exports.SocksProxyAgent = SocksProxyAgent;
const ws = require('./utilsBundleImpl').ws;
exports.ws = ws;
const wsServer = require('./utilsBundleImpl').wsServer;
exports.wsServer = wsServer;
const wsReceiver = require('./utilsBundleImpl').wsReceiver;
exports.wsReceiver = wsReceiver;
const wsSender = require('./utilsBundleImpl').wsSender;
exports.wsSender = wsSender;
const StackUtils = require('./utilsBundleImpl').StackUtils;
const stackUtils = new StackUtils({
  internals: StackUtils.nodeInternals()
});
const nodeInternals = StackUtils.nodeInternals();
const nodeMajorVersion = +process.versions.node.split('.')[0];
function parseStackTraceLine(line) {
  var _frame$file, _frame$file2;
  if (!process.env.PWDEBUGIMPL && nodeMajorVersion < 16 && nodeInternals.some(internal => internal.test(line))) return null;
  const frame = stackUtils.parseLine(line);
  if (!frame) return null;
  if (!process.env.PWDEBUGIMPL && ((_frame$file = frame.file) !== null && _frame$file !== void 0 && _frame$file.startsWith('internal') || (_frame$file2 = frame.file) !== null && _frame$file2 !== void 0 && _frame$file2.startsWith('node:'))) return null;
  if (!frame.file) return null;
  // ESM files return file:// URLs, see here: https://github.com/tapjs/stack-utils/issues/60
  const file = frame.file.startsWith('file://') ? _url.default.fileURLToPath(frame.file) : _path.default.resolve(process.cwd(), frame.file);
  return {
    file,
    line: frame.line || 0,
    column: frame.column || 0,
    function: frame.function
  };
}
function ms(ms) {
  if (!isFinite(ms)) return '-';
  if (ms === 0) return '0ms';
  if (ms < 1000) return ms.toFixed(0) + 'ms';
  const seconds = ms / 1000;
  if (seconds < 60) return seconds.toFixed(1) + 's';
  const minutes = seconds / 60;
  if (minutes < 60) return minutes.toFixed(1) + 'm';
  const hours = minutes / 60;
  if (hours < 24) return hours.toFixed(1) + 'h';
  const days = hours / 24;
  return days.toFixed(1) + 'd';
}