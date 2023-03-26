"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.create = exports.WorkerMain = void 0;
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _util = _interopRequireDefault(require("util"));
var _util2 = require("../util");
var _globals = require("../common/globals");
var _configLoader = require("../common/configLoader");
var _fixtureRunner = require("./fixtureRunner");
var _utils = require("playwright-core/lib/utils");
var _testInfo = require("./testInfo");
var _timeoutManager = require("./timeoutManager");
var _process = require("../common/process");
var _testLoader = require("../common/testLoader");
var _suiteUtils = require("../common/suiteUtils");
var _poolBuilder = require("../common/poolBuilder");
var _compilationCache = require("../common/compilationCache");
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

const removeFolderAsync = _util.default.promisify(_utilsBundle.rimraf);
class WorkerMain extends _process.ProcessRunner {
  // Accumulated fatal errors that cannot be attributed to a test.

  // Whether we should skip running remaining tests in this suite because
  // of a setup error, usually beforeAll hook.

  // The stage of the full cleanup. Once "finished", we can safely stop running anything.

  // Whether the worker was requested to stop.

  // This promise resolves once the single "run test group" call finishes.

  // Dynamic annotations originated by modifiers with a callback, e.g. `test.skip(() => true)`.

  // Suites that had their beforeAll hooks, but not afterAll hooks executed.
  // These suites still need afterAll hooks to be executed for the proper cleanup.

  constructor(params) {
    super();
    this._params = void 0;
    this._config = void 0;
    this._project = void 0;
    this._poolBuilder = void 0;
    this._fixtureRunner = void 0;
    this._fatalErrors = [];
    this._skipRemainingTestsInSuite = void 0;
    this._didRunFullCleanup = false;
    this._isStopped = false;
    this._runFinished = new _utils.ManualPromise();
    this._currentTest = null;
    this._lastRunningTests = [];
    this._totalRunningTests = 0;
    this._extraSuiteAnnotations = new Map();
    this._activeSuites = new Set();
    process.env.TEST_WORKER_INDEX = String(params.workerIndex);
    process.env.TEST_PARALLEL_INDEX = String(params.parallelIndex);
    (0, _globals.setIsWorkerProcess)();
    (0, _compilationCache.addToCompilationCache)(params.config.compilationCache);
    this._params = params;
    this._fixtureRunner = new _fixtureRunner.FixtureRunner();

    // Resolve this promise, so worker does not stall waiting for the non-existent run to finish,
    // when it was sopped before running any test group.
    this._runFinished.resolve();
    process.on('unhandledRejection', reason => this.unhandledError(reason));
    process.on('uncaughtException', error => this.unhandledError(error));
    process.stdout.write = chunk => {
      const outPayload = {
        ...chunkToParams(chunk)
      };
      this.dispatchEvent('stdOut', outPayload);
      return true;
    };
    if (!process.env.PW_RUNNER_DEBUG) {
      process.stderr.write = chunk => {
        const outPayload = {
          ...chunkToParams(chunk)
        };
        this.dispatchEvent('stdErr', outPayload);
        return true;
      };
    }
  }
  _stop() {
    if (!this._isStopped) {
      var _this$_currentTest;
      this._isStopped = true;

      // Interrupt current action.
      (_this$_currentTest = this._currentTest) === null || _this$_currentTest === void 0 ? void 0 : _this$_currentTest._timeoutManager.interrupt();
      if (this._currentTest && this._currentTest.status === 'passed') this._currentTest.status = 'interrupted';
    }
    return this._runFinished;
  }
  async gracefullyClose() {
    try {
      await this._stop();
      // We have to load the project to get the right deadline below.
      await this._loadIfNeeded();
      await this._teardownScopes();
    } catch (e) {
      this._fatalErrors.push((0, _util2.serializeError)(e));
    }
    if (this._fatalErrors.length) {
      this._appendProcessTeardownDiagnostics(this._fatalErrors[this._fatalErrors.length - 1]);
      const payload = {
        fatalErrors: this._fatalErrors
      };
      this.dispatchEvent('teardownErrors', payload);
    }
  }
  _appendProcessTeardownDiagnostics(error) {
    if (!this._lastRunningTests.length) return;
    const count = this._totalRunningTests === 1 ? '1 test' : `${this._totalRunningTests} tests`;
    let lastMessage = '';
    if (this._lastRunningTests.length < this._totalRunningTests) lastMessage = `, last ${this._lastRunningTests.length} tests were`;
    const message = ['', '', _utilsBundle.colors.red(`Failed worker ran ${count}${lastMessage}:`), ...this._lastRunningTests.map(testInfo => formatTestTitle(testInfo._test, testInfo.project.name))].join('\n');
    if (error.message) {
      if (error.stack) {
        let index = error.stack.indexOf(error.message);
        if (index !== -1) {
          index += error.message.length;
          error.stack = error.stack.substring(0, index) + message + error.stack.substring(index);
        }
      }
      error.message += message;
    } else if (error.value) {
      error.value += message;
    }
  }
  async _teardownScopes() {
    // TODO: separate timeout for teardown?
    const timeoutManager = new _timeoutManager.TimeoutManager(this._project.timeout);
    timeoutManager.setCurrentRunnable({
      type: 'teardown'
    });
    const timeoutError = await timeoutManager.runWithTimeout(async () => {
      await this._fixtureRunner.teardownScope('test', timeoutManager);
      await this._fixtureRunner.teardownScope('worker', timeoutManager);
    });
    if (timeoutError) this._fatalErrors.push(timeoutError);
  }
  unhandledError(error) {
    var _this$_currentTest2;
    // Usually, we do not differentiate between errors in the control flow
    // and unhandled errors - both lead to the test failing. This is good for regular tests,
    // so that you can, e.g. expect() from inside an event handler. The test fails,
    // and we restart the worker.
    //
    // However, for tests marked with test.fail(), this is a problem. Unhandled error
    // could come either from the user test code (legit failure), or from a fixture or
    // a test runner. In the latter case, the worker state could be messed up,
    // and continuing to run tests in the same worker is problematic. Therefore,
    // we turn this into a fatal error and restart the worker anyway.
    // The only exception is the expect() error that we still consider ok.
    const isExpectError = error instanceof Error && !!error.matcherResult;
    const isCurrentTestExpectedToFail = ((_this$_currentTest2 = this._currentTest) === null || _this$_currentTest2 === void 0 ? void 0 : _this$_currentTest2.expectedStatus) === 'failed';
    const shouldConsiderAsTestError = isExpectError || !isCurrentTestExpectedToFail;
    if (this._currentTest && shouldConsiderAsTestError) {
      this._currentTest._failWithError((0, _util2.serializeError)(error), true /* isHardError */);
    } else {
      // No current test - fatal error.
      if (!this._fatalErrors.length) this._fatalErrors.push((0, _util2.serializeError)(error));
    }
    this._stop();
  }
  async _loadIfNeeded() {
    if (this._config) return;
    const configLoader = await _configLoader.ConfigLoader.deserialize(this._params.config);
    this._config = configLoader.fullConfig();
    this._project = this._config.projects.find(p => p._internal.id === this._params.projectId);
    this._poolBuilder = _poolBuilder.PoolBuilder.createForWorker(this._project);
  }
  async runTestGroup(runPayload) {
    this._runFinished = new _utils.ManualPromise();
    const entries = new Map(runPayload.entries.map(e => [e.testId, e]));
    let fatalUnknownTestIds;
    try {
      await this._loadIfNeeded();
      const fileSuite = await (0, _testLoader.loadTestFile)(runPayload.file, this._config.rootDir);
      const suite = (0, _suiteUtils.buildFileSuiteForProject)(this._project, fileSuite, this._params.repeatEachIndex);
      const hasEntries = (0, _suiteUtils.filterTestsRemoveEmptySuites)(suite, test => entries.has(test.id));
      if (hasEntries) {
        this._poolBuilder.buildPools(suite);
        this._extraSuiteAnnotations = new Map();
        this._activeSuites = new Set();
        this._didRunFullCleanup = false;
        const tests = suite.allTests();
        for (let i = 0; i < tests.length; i++) {
          // Do not run tests after full cleanup, because we are entirely done.
          if (this._isStopped && this._didRunFullCleanup) break;
          const entry = entries.get(tests[i].id);
          entries.delete(tests[i].id);
          (0, _util2.debugTest)(`test started "${tests[i].title}"`);
          await this._runTest(tests[i], entry.retry, tests[i + 1]);
          (0, _util2.debugTest)(`test finished "${tests[i].title}"`);
        }
      } else {
        fatalUnknownTestIds = runPayload.entries.map(e => e.testId);
        this._stop();
      }
    } catch (e) {
      // In theory, we should run above code without any errors.
      // However, in the case we screwed up, or loadTestFile failed in the worker
      // but not in the runner, let's do a fatal error.
      this._fatalErrors.push((0, _util2.serializeError)(e));
      this._stop();
    } finally {
      const donePayload = {
        fatalErrors: this._fatalErrors,
        skipTestsDueToSetupFailure: [],
        fatalUnknownTestIds
      };
      for (const test of ((_this$_skipRemainingT = this._skipRemainingTestsInSuite) === null || _this$_skipRemainingT === void 0 ? void 0 : _this$_skipRemainingT.allTests()) || []) {
        var _this$_skipRemainingT;
        if (entries.has(test.id)) donePayload.skipTestsDueToSetupFailure.push(test.id);
      }
      this.dispatchEvent('done', donePayload);
      this._fatalErrors = [];
      this._skipRemainingTestsInSuite = undefined;
      this._runFinished.resolve();
    }
  }
  async _runTest(test, retry, nextTest) {
    const testInfo = new _testInfo.TestInfoImpl(this._config, this._project, this._params, test, retry, stepBeginPayload => this.dispatchEvent('stepBegin', stepBeginPayload), stepEndPayload => this.dispatchEvent('stepEnd', stepEndPayload));
    const processAnnotation = annotation => {
      testInfo.annotations.push(annotation);
      switch (annotation.type) {
        case 'fixme':
        case 'skip':
          testInfo.expectedStatus = 'skipped';
          break;
        case 'fail':
          if (testInfo.expectedStatus !== 'skipped') testInfo.expectedStatus = 'failed';
          break;
        case 'slow':
          testInfo.slow();
          break;
      }
    };
    if (!this._isStopped) this._fixtureRunner.setPool(test._pool);
    const suites = getSuites(test);
    const reversedSuites = suites.slice().reverse();
    const nextSuites = new Set(getSuites(nextTest));
    testInfo._timeoutManager.setTimeout(test.timeout);
    for (const annotation of test._staticAnnotations) processAnnotation(annotation);

    // Process existing annotations dynamically set for parent suites.
    for (const suite of suites) {
      const extraAnnotations = this._extraSuiteAnnotations.get(suite) || [];
      for (const annotation of extraAnnotations) processAnnotation(annotation);
    }
    this._currentTest = testInfo;
    (0, _globals.setCurrentTestInfo)(testInfo);
    this.dispatchEvent('testBegin', buildTestBeginPayload(testInfo));
    const isSkipped = testInfo.expectedStatus === 'skipped';
    const hasAfterAllToRunBeforeNextTest = reversedSuites.some(suite => {
      return this._activeSuites.has(suite) && !nextSuites.has(suite) && suite._hooks.some(hook => hook.type === 'afterAll');
    });
    if (isSkipped && nextTest && !hasAfterAllToRunBeforeNextTest) {
      // Fast path - this test is skipped, and there are more tests that will handle cleanup.
      testInfo.status = 'skipped';
      this.dispatchEvent('testEnd', buildTestEndPayload(testInfo));
      return;
    }
    this._totalRunningTests++;
    this._lastRunningTests.push(testInfo);
    if (this._lastRunningTests.length > 10) this._lastRunningTests.shift();
    let didFailBeforeAllForSuite;
    let shouldRunAfterEachHooks = false;
    await testInfo._runWithTimeout(async () => {
      if (this._isStopped || isSkipped) {
        // Two reasons to get here:
        // - Last test is skipped, so we should not run the test, but run the cleanup.
        // - Worker is requested to stop, but was not able to run full cleanup yet.
        //   We should skip the test, but run the cleanup.
        testInfo.status = 'skipped';
        didFailBeforeAllForSuite = undefined;
        return;
      }
      const beforeHooksStep = testInfo._addStep({
        category: 'hook',
        title: 'Before Hooks',
        canHaveChildren: true,
        forceNoParent: true,
        wallTime: Date.now()
      });

      // Note: wrap all preparation steps together, because failure/skip in any of them
      // prevents further setup and/or test from running.
      const maybeError = await testInfo._runFn(async () => {
        // Run "beforeAll" modifiers on parent suites, unless already run during previous tests.
        for (const suite of suites) {
          if (this._extraSuiteAnnotations.has(suite)) continue;
          const extraAnnotations = [];
          this._extraSuiteAnnotations.set(suite, extraAnnotations);
          didFailBeforeAllForSuite = suite; // Assume failure, unless reset below.
          // Separate timeout for each "beforeAll" modifier.
          const timeSlot = {
            timeout: this._project.timeout,
            elapsed: 0
          };
          await this._runModifiersForSuite(suite, testInfo, 'worker', timeSlot, extraAnnotations);
        }

        // Run "beforeAll" hooks, unless already run during previous tests.
        for (const suite of suites) {
          didFailBeforeAllForSuite = suite; // Assume failure, unless reset below.
          await this._runBeforeAllHooksForSuite(suite, testInfo);
        }

        // Running "beforeAll" succeeded for all suites!
        didFailBeforeAllForSuite = undefined;

        // Run "beforeEach" modifiers.
        for (const suite of suites) await this._runModifiersForSuite(suite, testInfo, 'test', undefined);

        // Run "beforeEach" hooks. Once started with "beforeEach", we must run all "afterEach" hooks as well.
        shouldRunAfterEachHooks = true;
        await this._runEachHooksForSuites(suites, 'beforeEach', testInfo, undefined);

        // Setup fixtures required by the test.
        testInfo._timeoutManager.setCurrentRunnable({
          type: 'test'
        });
        const params = await this._fixtureRunner.resolveParametersForFunction(test.fn, testInfo, 'test');
        beforeHooksStep.complete({}); // Report fixture hooks step as completed.
        if (params === null) {
          // Fixture setup failed, we should not run the test now.
          return;
        }

        // Now run the test itself.
        (0, _util2.debugTest)(`test function started`);
        const fn = test.fn; // Extract a variable to get a better stack trace ("myTest" vs "TestCase.myTest [as fn]").
        await fn(params, testInfo);
        (0, _util2.debugTest)(`test function finished`);
      }, 'allowSkips');
      beforeHooksStep.complete({
        error: maybeError
      }); // Second complete is a no-op.
    });

    if (didFailBeforeAllForSuite) {
      // This will inform dispatcher that we should not run more tests from this group
      // because we had a beforeAll error.
      // This behavior avoids getting the same common error for each test.
      this._skipRemainingTestsInSuite = didFailBeforeAllForSuite;
    }
    const afterHooksStep = testInfo._addStep({
      category: 'hook',
      title: 'After Hooks',
      canHaveChildren: true,
      forceNoParent: true,
      wallTime: Date.now()
    });
    let firstAfterHooksError;
    let afterHooksSlot;
    if (testInfo._didTimeout) {
      // A timed-out test gets a full additional timeout to run after hooks.
      afterHooksSlot = {
        timeout: this._project.timeout,
        elapsed: 0
      };
      testInfo._timeoutManager.setCurrentRunnable({
        type: 'afterEach',
        slot: afterHooksSlot
      });
    }
    await testInfo._runWithTimeout(async () => {
      // Note: do not wrap all teardown steps together, because failure in any of them
      // does not prevent further teardown steps from running.

      // Run "immediately upon test failure" callbacks.
      if (testInfo._isFailure()) {
        const onFailureError = await testInfo._runFn(async () => {
          testInfo._timeoutManager.setCurrentRunnable({
            type: 'test',
            slot: afterHooksSlot
          });
          for (const [fn, title] of testInfo._onTestFailureImmediateCallbacks) {
            (0, _util2.debugTest)(`on-failure callback started`);
            await testInfo._runAsStep(fn, {
              category: 'hook',
              title,
              canHaveChildren: true,
              forceNoParent: false
            });
            (0, _util2.debugTest)(`on-failure callback finished`);
          }
        });
        firstAfterHooksError = firstAfterHooksError || onFailureError;
      }

      // Run "afterEach" hooks, unless we failed at beforeAll stage.
      if (shouldRunAfterEachHooks) {
        const afterEachError = await testInfo._runFn(() => this._runEachHooksForSuites(reversedSuites, 'afterEach', testInfo, afterHooksSlot));
        firstAfterHooksError = firstAfterHooksError || afterEachError;
      }

      // Run "afterAll" hooks for suites that are not shared with the next test.
      // In case of failure the worker will be stopped and we have to make sure that afterAll
      // hooks run before test fixtures teardown.
      for (const suite of reversedSuites) {
        if (!nextSuites.has(suite) || testInfo._isFailure()) {
          const afterAllError = await this._runAfterAllHooksForSuite(suite, testInfo);
          firstAfterHooksError = firstAfterHooksError || afterAllError;
        }
      }

      // Teardown test-scoped fixtures. Attribute to 'test' so that users understand
      // they should probably increate the test timeout to fix this issue.
      testInfo._timeoutManager.setCurrentRunnable({
        type: 'test',
        slot: afterHooksSlot
      });
      (0, _util2.debugTest)(`tearing down test scope started`);
      const testScopeError = await testInfo._runFn(() => this._fixtureRunner.teardownScope('test', testInfo._timeoutManager));
      (0, _util2.debugTest)(`tearing down test scope finished`);
      firstAfterHooksError = firstAfterHooksError || testScopeError;
    });
    if (testInfo._isFailure()) this._isStopped = true;
    if (this._isStopped) {
      // Run all remaining "afterAll" hooks and teardown all fixtures when worker is shutting down.
      // Mark as "cleaned up" early to avoid running cleanup twice.
      this._didRunFullCleanup = true;

      // Give it more time for the full cleanup.
      await testInfo._runWithTimeout(async () => {
        (0, _util2.debugTest)(`running full cleanup after the failure`);
        for (const suite of reversedSuites) {
          const afterAllError = await this._runAfterAllHooksForSuite(suite, testInfo);
          firstAfterHooksError = firstAfterHooksError || afterAllError;
        }
        const teardownSlot = {
          timeout: this._project.timeout,
          elapsed: 0
        };
        // Attribute to 'test' so that users understand they should probably increate the test timeout to fix this issue.
        testInfo._timeoutManager.setCurrentRunnable({
          type: 'test',
          slot: teardownSlot
        });
        (0, _util2.debugTest)(`tearing down test scope started`);
        const testScopeError = await testInfo._runFn(() => this._fixtureRunner.teardownScope('test', testInfo._timeoutManager));
        (0, _util2.debugTest)(`tearing down test scope finished`);
        firstAfterHooksError = firstAfterHooksError || testScopeError;
        // Attribute to 'teardown' because worker fixtures are not perceived as a part of a test.
        testInfo._timeoutManager.setCurrentRunnable({
          type: 'teardown',
          slot: teardownSlot
        });
        (0, _util2.debugTest)(`tearing down worker scope started`);
        const workerScopeError = await testInfo._runFn(() => this._fixtureRunner.teardownScope('worker', testInfo._timeoutManager));
        (0, _util2.debugTest)(`tearing down worker scope finished`);
        firstAfterHooksError = firstAfterHooksError || workerScopeError;
      });
    }
    afterHooksStep.complete({
      error: firstAfterHooksError
    });
    this._currentTest = null;
    (0, _globals.setCurrentTestInfo)(null);
    this.dispatchEvent('testEnd', buildTestEndPayload(testInfo));
    const preserveOutput = this._config.preserveOutput === 'always' || this._config.preserveOutput === 'failures-only' && testInfo._isFailure();
    if (!preserveOutput) await removeFolderAsync(testInfo.outputDir).catch(e => {});
  }
  async _runModifiersForSuite(suite, testInfo, scope, timeSlot, extraAnnotations) {
    for (const modifier of suite._modifiers) {
      const actualScope = this._fixtureRunner.dependsOnWorkerFixturesOnly(modifier.fn, modifier.location) ? 'worker' : 'test';
      if (actualScope !== scope) continue;
      (0, _util2.debugTest)(`modifier at "${(0, _util2.formatLocation)(modifier.location)}" started`);
      testInfo._timeoutManager.setCurrentRunnable({
        type: modifier.type,
        location: modifier.location,
        slot: timeSlot
      });
      const result = await testInfo._runAsStep(() => this._fixtureRunner.resolveParametersAndRunFunction(modifier.fn, testInfo, scope), {
        category: 'hook',
        title: `${modifier.type} modifier`,
        canHaveChildren: true,
        forceNoParent: false,
        location: modifier.location
      });
      (0, _util2.debugTest)(`modifier at "${(0, _util2.formatLocation)(modifier.location)}" finished`);
      if (result && extraAnnotations) extraAnnotations.push({
        type: modifier.type,
        description: modifier.description
      });
      testInfo[modifier.type](!!result, modifier.description);
    }
  }
  async _runBeforeAllHooksForSuite(suite, testInfo) {
    if (this._activeSuites.has(suite)) return;
    this._activeSuites.add(suite);
    let beforeAllError;
    for (const hook of suite._hooks) {
      if (hook.type !== 'beforeAll') continue;
      (0, _util2.debugTest)(`${hook.type} hook at "${(0, _util2.formatLocation)(hook.location)}" started`);
      try {
        // Separate time slot for each "beforeAll" hook.
        const timeSlot = {
          timeout: this._project.timeout,
          elapsed: 0
        };
        testInfo._timeoutManager.setCurrentRunnable({
          type: 'beforeAll',
          location: hook.location,
          slot: timeSlot
        });
        await testInfo._runAsStep(() => this._fixtureRunner.resolveParametersAndRunFunction(hook.fn, testInfo, 'all-hooks-only'), {
          category: 'hook',
          title: `${hook.type} hook`,
          canHaveChildren: true,
          forceNoParent: false,
          location: hook.location
        });
      } catch (e) {
        // Always run all the hooks, and capture the first error.
        beforeAllError = beforeAllError || e;
      }
      (0, _util2.debugTest)(`${hook.type} hook at "${(0, _util2.formatLocation)(hook.location)}" finished`);
    }
    if (beforeAllError) throw beforeAllError;
  }
  async _runAfterAllHooksForSuite(suite, testInfo) {
    if (!this._activeSuites.has(suite)) return;
    this._activeSuites.delete(suite);
    let firstError;
    for (const hook of suite._hooks) {
      if (hook.type !== 'afterAll') continue;
      (0, _util2.debugTest)(`${hook.type} hook at "${(0, _util2.formatLocation)(hook.location)}" started`);
      const afterAllError = await testInfo._runFn(async () => {
        // Separate time slot for each "afterAll" hook.
        const timeSlot = {
          timeout: this._project.timeout,
          elapsed: 0
        };
        testInfo._timeoutManager.setCurrentRunnable({
          type: 'afterAll',
          location: hook.location,
          slot: timeSlot
        });
        await testInfo._runAsStep(() => this._fixtureRunner.resolveParametersAndRunFunction(hook.fn, testInfo, 'all-hooks-only'), {
          category: 'hook',
          title: `${hook.type} hook`,
          canHaveChildren: true,
          forceNoParent: false,
          location: hook.location
        });
      });
      firstError = firstError || afterAllError;
      (0, _util2.debugTest)(`${hook.type} hook at "${(0, _util2.formatLocation)(hook.location)}" finished`);
    }
    return firstError;
  }
  async _runEachHooksForSuites(suites, type, testInfo, timeSlot) {
    const hooks = suites.map(suite => suite._hooks.filter(hook => hook.type === type)).flat();
    let error;
    for (const hook of hooks) {
      try {
        testInfo._timeoutManager.setCurrentRunnable({
          type,
          location: hook.location,
          slot: timeSlot
        });
        await testInfo._runAsStep(() => this._fixtureRunner.resolveParametersAndRunFunction(hook.fn, testInfo, 'test'), {
          category: 'hook',
          title: `${hook.type} hook`,
          canHaveChildren: true,
          forceNoParent: false,
          location: hook.location
        });
      } catch (e) {
        // Always run all the hooks, and capture the first error.
        error = error || e;
      }
    }
    if (error) throw error;
  }
}
exports.WorkerMain = WorkerMain;
function buildTestBeginPayload(testInfo) {
  return {
    testId: testInfo._test.id,
    startWallTime: testInfo._startWallTime
  };
}
function buildTestEndPayload(testInfo) {
  return {
    testId: testInfo._test.id,
    duration: testInfo.duration,
    status: testInfo.status,
    errors: testInfo.errors,
    expectedStatus: testInfo.expectedStatus,
    annotations: testInfo.annotations,
    timeout: testInfo.timeout,
    attachments: testInfo.attachments.map(a => {
      var _a$body;
      return {
        name: a.name,
        contentType: a.contentType,
        path: a.path,
        body: (_a$body = a.body) === null || _a$body === void 0 ? void 0 : _a$body.toString('base64')
      };
    })
  };
}
function getSuites(test) {
  const suites = [];
  for (let suite = test === null || test === void 0 ? void 0 : test.parent; suite; suite = suite.parent) suites.push(suite);
  suites.reverse(); // Put root suite first.
  return suites;
}
function formatTestTitle(test, projectName) {
  // file, ...describes, test
  const [, ...titles] = test.titlePath();
  const location = `${(0, _util2.relativeFilePath)(test.location.file)}:${test.location.line}:${test.location.column}`;
  const projectTitle = projectName ? `[${projectName}] › ` : '';
  return `${projectTitle}${location} › ${titles.join(' › ')}`;
}
function chunkToParams(chunk) {
  if (chunk instanceof Buffer) return {
    buffer: chunk.toString('base64')
  };
  if (typeof chunk !== 'string') return {
    text: _util.default.inspect(chunk)
  };
  return {
    text: chunk
  };
}
const create = params => new WorkerMain(params);
exports.create = create;