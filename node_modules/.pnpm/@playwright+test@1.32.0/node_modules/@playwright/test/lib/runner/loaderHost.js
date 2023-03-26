"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.OutOfProcessLoaderHost = exports.InProcessLoaderHost = void 0;
var _ipc = require("../common/ipc");
var _processHost = require("./processHost");
var _test = require("../common/test");
var _testLoader = require("../common/testLoader");
var _poolBuilder = require("../common/poolBuilder");
var _compilationCache = require("../common/compilationCache");
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

class InProcessLoaderHost {
  constructor(config) {
    this._config = void 0;
    this._poolBuilder = void 0;
    this._config = config;
    this._poolBuilder = _poolBuilder.PoolBuilder.createForLoader();
  }
  async loadTestFile(file, testErrors) {
    const result = await (0, _testLoader.loadTestFile)(file, this._config.rootDir, testErrors);
    this._poolBuilder.buildPools(result, testErrors);
    return result;
  }
  async stop() {}
}
exports.InProcessLoaderHost = InProcessLoaderHost;
class OutOfProcessLoaderHost {
  constructor(config) {
    this._startPromise = void 0;
    this._processHost = void 0;
    this._processHost = new _processHost.ProcessHost(require.resolve('../loader/loaderMain.js'), 'loader', {});
    this._startPromise = this._processHost.startRunner((0, _ipc.serializeConfig)(config), true);
  }
  async loadTestFile(file, testErrors) {
    await this._startPromise;
    const result = await this._processHost.sendMessage({
      method: 'loadTestFile',
      params: {
        file
      }
    });
    testErrors.push(...result.testErrors);
    return _test.Suite._deepParse(result.fileSuite);
  }
  async stop() {
    await this._startPromise;
    const result = await this._processHost.sendMessage({
      method: 'serializeCompilationCache'
    });
    (0, _compilationCache.addToCompilationCache)(result);
    await this._processHost.stop();
  }
}
exports.OutOfProcessLoaderHost = OutOfProcessLoaderHost;