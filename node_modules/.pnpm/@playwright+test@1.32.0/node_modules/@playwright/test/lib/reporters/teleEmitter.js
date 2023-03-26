"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TeleReporterEmitter = void 0;
var _utils = require("playwright-core/lib/utils");
var _teleReceiver = require("../isomorphic/teleReceiver");
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

class TeleReporterEmitter {
  constructor(messageSink) {
    this._messageSink = void 0;
    this._messageSink = messageSink;
  }
  onBegin(config, suite) {
    const projects = [];
    for (const projectSuite of suite.suites) {
      const report = this._serializeProject(projectSuite);
      projects.push(report);
    }
    this._messageSink({
      method: 'onBegin',
      params: {
        config: this._serializeConfig(config),
        projects
      }
    });
  }
  onTestBegin(test, result) {
    result[idSymbol] = (0, _utils.createGuid)();
    this._messageSink({
      method: 'onTestBegin',
      params: {
        testId: test.id,
        result: this._serializeResultStart(result)
      }
    });
  }
  onTestEnd(test, result) {
    this._messageSink({
      method: 'onTestEnd',
      params: {
        testId: test.id,
        result: this._serializeResultEnd(result)
      }
    });
  }
  onStepBegin(test, result, step) {
    step[idSymbol] = (0, _utils.createGuid)();
    this._messageSink({
      method: 'onStepBegin',
      params: {
        testId: test.id,
        resultId: result[idSymbol],
        step: this._serializeStepStart(step)
      }
    });
  }
  onStepEnd(test, result, step) {
    this._messageSink({
      method: 'onStepEnd',
      params: {
        testId: test.id,
        resultId: result[idSymbol],
        step: this._serializeStepEnd(step)
      }
    });
  }
  onError(error) {
    this._messageSink({
      method: 'onError',
      params: {
        error
      }
    });
  }
  onStdOut(chunk, test, result) {
    this._onStdIO('stdio', chunk, test, result);
  }
  onStdErr(chunk, test, result) {
    this._onStdIO('stderr', chunk, test, result);
  }
  _onStdIO(type, chunk, test, result) {
    const isBase64 = typeof chunk !== 'string';
    const data = isBase64 ? chunk.toString('base64') : chunk;
    this._messageSink({
      method: 'onStdIO',
      params: {
        testId: test === null || test === void 0 ? void 0 : test.id,
        resultId: result ? result[idSymbol] : undefined,
        type,
        data,
        isBase64
      }
    });
  }
  async onEnd(result) {
    this._messageSink({
      method: 'onEnd',
      params: {
        result
      }
    });
  }
  _serializeConfig(config) {
    return {
      rootDir: config.rootDir,
      configFile: config.configFile,
      listOnly: config._internal.listOnly
    };
  }
  _serializeProject(suite) {
    const project = suite.project();
    const report = {
      id: project._internal.id,
      metadata: project.metadata,
      name: project.name,
      outputDir: project.outputDir,
      repeatEach: project.repeatEach,
      retries: project.retries,
      testDir: project.testDir,
      testIgnore: (0, _teleReceiver.serializeRegexPatterns)(project.testIgnore),
      testMatch: (0, _teleReceiver.serializeRegexPatterns)(project.testMatch),
      timeout: project.timeout,
      suites: suite.suites.map(fileSuite => {
        return this._serializeSuite(fileSuite);
      }),
      grep: (0, _teleReceiver.serializeRegexPatterns)(project.grep),
      grepInvert: (0, _teleReceiver.serializeRegexPatterns)(project.grepInvert || []),
      dependencies: project.dependencies,
      snapshotDir: project.snapshotDir
    };
    return report;
  }
  _serializeSuite(suite) {
    const result = {
      type: suite._type,
      title: suite.title,
      fileId: suite._fileId,
      parallelMode: suite._parallelMode,
      location: suite.location,
      suites: suite.suites.map(s => this._serializeSuite(s)),
      tests: suite.tests.map(t => this._serializeTest(t))
    };
    return result;
  }
  _serializeTest(test) {
    return {
      testId: test.id,
      title: test.title,
      location: test.location,
      expectedStatus: test.expectedStatus,
      timeout: test.timeout,
      annotations: test.annotations,
      retries: test.retries
    };
  }
  _serializeResultStart(result) {
    return {
      id: result[idSymbol],
      retry: result.retry,
      workerIndex: result.workerIndex,
      parallelIndex: result.parallelIndex,
      startTime: result.startTime.toISOString()
    };
  }
  _serializeResultEnd(result) {
    return {
      id: result[idSymbol],
      duration: result.duration,
      status: result.status,
      errors: result.errors,
      attachments: result.attachments
    };
  }
  _serializeStepStart(step) {
    return {
      id: step[idSymbol],
      title: step.title,
      category: step.category,
      startTime: step.startTime.toISOString(),
      location: step.location
    };
  }
  _serializeStepEnd(step) {
    return {
      id: step[idSymbol],
      duration: step.duration,
      error: step.error
    };
  }
}
exports.TeleReporterEmitter = TeleReporterEmitter;
const idSymbol = Symbol('id');