"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.serializeConfig = serializeConfig;
var _compilationCache = require("./compilationCache");
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

function serializeConfig(config) {
  const result = {
    configFile: config.configFile,
    configDir: config._internal.configDir,
    configCLIOverrides: config._internal.configCLIOverrides,
    compilationCache: (0, _compilationCache.serializeCompilationCache)()
  };
  return result;
}