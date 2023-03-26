"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Dispatcher = void 0;
var _ipc = require("../common/ipc");
var _utils = require("playwright-core/lib/utils");
var _workerHost = require("./workerHost");
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

class Dispatcher {
  constructor(config, reporter) {
    this._workerSlots = [];
    this._queue = [];
    this._queuedOrRunningHashCount = new Map();
    this._finished = new _utils.ManualPromise();
    this._isStopped = true;
    this._testById = new Map();
    this._config = void 0;
    this._reporter = void 0;
    this._hasWorkerErrors = false;
    this._failureCount = 0;
    this._extraEnvByProjectId = new Map();
    this._producedEnvByProjectId = new Map();
    this._config = config;
    this._reporter = reporter;
  }
  _processFullySkippedJobs() {
    // If all the tests in a group are skipped, we report them immediately
    // without sending anything to a worker. This avoids creating unnecessary worker processes.
    //
    // However, if there is at least one non-skipped test in a group, we'll send
    // the whole group to the worker process and report tests in the natural order,
    // with skipped tests mixed in-between non-skipped. This makes
    // for a better reporter experience.
    while (!this._isStopped && this._queue.length) {
      const group = this._queue[0];
      const allTestsSkipped = group.tests.every(test => test.expectedStatus === 'skipped');
      if (!allTestsSkipped) break;
      for (const test of group.tests) {
        var _this$_reporter$onTes, _this$_reporter;
        const result = test._appendTestResult();
        result.status = 'skipped';
        (_this$_reporter$onTes = (_this$_reporter = this._reporter).onTestBegin) === null || _this$_reporter$onTes === void 0 ? void 0 : _this$_reporter$onTes.call(_this$_reporter, test, result);
        test.annotations = [...test._staticAnnotations];
        this._reportTestEnd(test, result);
      }
      this._queue.shift();
    }

    // If all remaining tests were skipped, resolve finished state.
    this._checkFinished();
  }
  async _scheduleJob() {
    this._processFullySkippedJobs();

    // 1. Find a job to run.
    if (this._isStopped || !this._queue.length) return;
    const job = this._queue[0];

    // 2. Find a worker with the same hash, or just some free worker.
    let index = this._workerSlots.findIndex(w => !w.busy && w.worker && w.worker.hash() === job.workerHash && !w.worker.didSendStop());
    if (index === -1) index = this._workerSlots.findIndex(w => !w.busy);
    // No workers available, bail out.
    if (index === -1) return;

    // 3. Claim both the job and the worker, run the job and release the worker.
    this._queue.shift();
    this._workerSlots[index].busy = true;
    await this._startJobInWorker(index, job);
    this._workerSlots[index].busy = false;

    // 4. Check the "finished" condition.
    this._checkFinished();

    // 5. We got a free worker - perhaps we can immediately start another job?
    this._scheduleJob();
  }
  async _startJobInWorker(index, job) {
    let worker = this._workerSlots[index].worker;

    // 1. Restart the worker if it has the wrong hash or is being stopped already.
    if (worker && (worker.hash() !== job.workerHash || worker.didSendStop())) {
      await worker.stop();
      worker = undefined;
      if (this._isStopped)
        // Check stopped signal after async hop.
        return;
    }

    // 2. Start the worker if it is down.
    if (!worker) {
      worker = this._createWorker(job, index, (0, _ipc.serializeConfig)(this._config));
      this._workerSlots[index].worker = worker;
      worker.on('exit', () => this._workerSlots[index].worker = undefined);
      await worker.start();
      if (this._isStopped)
        // Check stopped signal after async hop.
        return;
    }

    // 3. Run the job.
    await this._runJob(worker, job);
  }
  _checkFinished() {
    if (this._finished.isDone()) return;

    // Check that we have no more work to do.
    if (this._queue.length && !this._isStopped) return;

    // Make sure all workers have finished the current job.
    if (this._workerSlots.some(w => w.busy)) return;
    for (const {
      test
    } of this._testById.values()) {
      // Emulate skipped test run if we have stopped early.
      if (!test.results.length) test._appendTestResult().status = 'skipped';
    }
    this._finished.resolve();
  }
  _isWorkerRedundant(worker) {
    let workersWithSameHash = 0;
    for (const slot of this._workerSlots) {
      if (slot.worker && !slot.worker.didSendStop() && slot.worker.hash() === worker.hash()) workersWithSameHash++;
    }
    return workersWithSameHash > this._queuedOrRunningHashCount.get(worker.hash());
  }
  async run(testGroups, extraEnvByProjectId) {
    this._extraEnvByProjectId = extraEnvByProjectId;
    this._queue = testGroups;
    for (const group of testGroups) {
      this._queuedOrRunningHashCount.set(group.workerHash, 1 + (this._queuedOrRunningHashCount.get(group.workerHash) || 0));
      for (const test of group.tests) this._testById.set(test.id, {
        test,
        resultByWorkerIndex: new Map()
      });
    }
    this._isStopped = false;
    this._workerSlots = [];
    // 1. Allocate workers.
    for (let i = 0; i < this._config.workers; i++) this._workerSlots.push({
      busy: false
    });
    // 2. Schedule enough jobs.
    for (let i = 0; i < this._workerSlots.length; i++) this._scheduleJob();
    this._checkFinished();
    // 3. More jobs are scheduled when the worker becomes free, or a new job is added.
    // 4. Wait for all jobs to finish.
    await this._finished;
  }
  async _runJob(worker, testGroup) {
    const runPayload = {
      file: testGroup.requireFile,
      entries: testGroup.tests.map(test => {
        return {
          testId: test.id,
          retry: test.results.length
        };
      })
    };
    worker.runTestGroup(runPayload);
    let doneCallback = () => {};
    const result = new Promise(f => doneCallback = f);
    const doneWithJob = () => {
      worker.removeListener('testBegin', onTestBegin);
      worker.removeListener('testEnd', onTestEnd);
      worker.removeListener('stepBegin', onStepBegin);
      worker.removeListener('stepEnd', onStepEnd);
      worker.removeListener('done', onDone);
      worker.removeListener('exit', onExit);
      doneCallback();
    };
    const remainingByTestId = new Map(testGroup.tests.map(e => [e.id, e]));
    const failedTestIds = new Set();
    const onTestBegin = params => {
      var _this$_reporter$onTes2, _this$_reporter2;
      const data = this._testById.get(params.testId);
      const result = data.test._appendTestResult();
      data.resultByWorkerIndex.set(worker.workerIndex, {
        result,
        stepStack: new Set(),
        steps: new Map()
      });
      result.parallelIndex = worker.parallelIndex;
      result.workerIndex = worker.workerIndex;
      result.startTime = new Date(params.startWallTime);
      (_this$_reporter$onTes2 = (_this$_reporter2 = this._reporter).onTestBegin) === null || _this$_reporter$onTes2 === void 0 ? void 0 : _this$_reporter$onTes2.call(_this$_reporter2, data.test, result);
      worker.currentTestId = params.testId;
    };
    worker.addListener('testBegin', onTestBegin);
    const onTestEnd = params => {
      remainingByTestId.delete(params.testId);
      if (this._hasReachedMaxFailures()) {
        // Do not show more than one error to avoid confusion, but report
        // as interrupted to indicate that we did actually start the test.
        params.status = 'interrupted';
        params.errors = [];
      }
      const data = this._testById.get(params.testId);
      const test = data.test;
      const {
        result
      } = data.resultByWorkerIndex.get(worker.workerIndex);
      data.resultByWorkerIndex.delete(worker.workerIndex);
      result.duration = params.duration;
      result.errors = params.errors;
      result.error = result.errors[0];
      result.attachments = params.attachments.map(a => ({
        name: a.name,
        path: a.path,
        contentType: a.contentType,
        body: a.body !== undefined ? Buffer.from(a.body, 'base64') : undefined
      }));
      result.status = params.status;
      test.expectedStatus = params.expectedStatus;
      test.annotations = params.annotations;
      test.timeout = params.timeout;
      const isFailure = result.status !== 'skipped' && result.status !== test.expectedStatus;
      if (isFailure) failedTestIds.add(params.testId);
      this._reportTestEnd(test, result);
      worker.currentTestId = null;
    };
    worker.addListener('testEnd', onTestEnd);
    const onStepBegin = params => {
      var _this$_reporter$onSte, _this$_reporter3;
      const data = this._testById.get(params.testId);
      const runData = data.resultByWorkerIndex.get(worker.workerIndex);
      if (!runData) {
        // The test has finished, but steps are still coming. Just ignore them.
        return;
      }
      const {
        result,
        steps,
        stepStack
      } = runData;
      const parentStep = params.forceNoParent ? undefined : [...stepStack].pop();
      const step = {
        title: params.title,
        titlePath: () => {
          const parentPath = (parentStep === null || parentStep === void 0 ? void 0 : parentStep.titlePath()) || [];
          return [...parentPath, params.title];
        },
        parent: parentStep,
        category: params.category,
        startTime: new Date(params.wallTime),
        duration: -1,
        steps: [],
        location: params.location
      };
      steps.set(params.stepId, step);
      (parentStep || result).steps.push(step);
      if (params.canHaveChildren) stepStack.add(step);
      (_this$_reporter$onSte = (_this$_reporter3 = this._reporter).onStepBegin) === null || _this$_reporter$onSte === void 0 ? void 0 : _this$_reporter$onSte.call(_this$_reporter3, data.test, result, step);
    };
    worker.on('stepBegin', onStepBegin);
    const onStepEnd = params => {
      var _this$_reporter$onSte2, _this$_reporter5;
      const data = this._testById.get(params.testId);
      const runData = data.resultByWorkerIndex.get(worker.workerIndex);
      if (!runData) {
        // The test has finished, but steps are still coming. Just ignore them.
        return;
      }
      const {
        result,
        steps,
        stepStack
      } = runData;
      const step = steps.get(params.stepId);
      if (!step) {
        var _this$_reporter$onStd, _this$_reporter4;
        (_this$_reporter$onStd = (_this$_reporter4 = this._reporter).onStdErr) === null || _this$_reporter$onStd === void 0 ? void 0 : _this$_reporter$onStd.call(_this$_reporter4, 'Internal error: step end without step begin: ' + params.stepId, data.test, result);
        return;
      }
      if (params.refinedTitle) step.title = params.refinedTitle;
      step.duration = params.wallTime - step.startTime.getTime();
      if (params.error) step.error = params.error;
      stepStack.delete(step);
      steps.delete(params.stepId);
      (_this$_reporter$onSte2 = (_this$_reporter5 = this._reporter).onStepEnd) === null || _this$_reporter$onSte2 === void 0 ? void 0 : _this$_reporter$onSte2.call(_this$_reporter5, data.test, result, step);
    };
    worker.on('stepEnd', onStepEnd);
    const onDone = params => {
      this._queuedOrRunningHashCount.set(worker.hash(), this._queuedOrRunningHashCount.get(worker.hash()) - 1);
      let remaining = [...remainingByTestId.values()];

      // We won't file remaining if:
      // - there are no remaining
      // - we are here not because something failed
      // - no unrecoverable worker error
      if (!remaining.length && !failedTestIds.size && !params.fatalErrors.length && !params.skipTestsDueToSetupFailure.length && !params.fatalUnknownTestIds && !params.unexpectedExitError) {
        if (this._isWorkerRedundant(worker)) worker.stop();
        doneWithJob();
        return;
      }

      // When worker encounters error, we will stop it and create a new one.
      worker.stop(true /* didFail */);

      const massSkipTestsFromRemaining = (testIds, errors, onlyStartedTests) => {
        remaining = remaining.filter(test => {
          if (!testIds.has(test.id)) return true;
          if (!this._hasReachedMaxFailures()) {
            const data = this._testById.get(test.id);
            const runData = data.resultByWorkerIndex.get(worker.workerIndex);
            // There might be a single test that has started but has not finished yet.
            let result;
            if (runData) {
              result = runData.result;
            } else {
              var _this$_reporter$onTes3, _this$_reporter6;
              if (onlyStartedTests) return true;
              result = data.test._appendTestResult();
              (_this$_reporter$onTes3 = (_this$_reporter6 = this._reporter).onTestBegin) === null || _this$_reporter$onTes3 === void 0 ? void 0 : _this$_reporter$onTes3.call(_this$_reporter6, test, result);
            }
            result.errors = [...errors];
            result.error = result.errors[0];
            result.status = errors.length ? 'failed' : 'skipped';
            this._reportTestEnd(test, result);
            failedTestIds.add(test.id);
            errors = []; // Only report errors for the first test.
          }

          return false;
        });
        if (errors.length) {
          // We had fatal errors after all tests have passed - most likely in some teardown.
          // Let's just fail the test run.
          this._hasWorkerErrors = true;
          for (const error of params.fatalErrors) {
            var _this$_reporter$onErr, _this$_reporter7;
            (_this$_reporter$onErr = (_this$_reporter7 = this._reporter).onError) === null || _this$_reporter$onErr === void 0 ? void 0 : _this$_reporter$onErr.call(_this$_reporter7, error);
          }
        }
      };
      if (params.fatalUnknownTestIds) {
        const titles = params.fatalUnknownTestIds.map(testId => {
          const test = this._testById.get(testId).test;
          return test.titlePath().slice(1).join(' > ');
        });
        massSkipTestsFromRemaining(new Set(params.fatalUnknownTestIds), [{
          message: `Internal error: unknown test(s) in worker:\n${titles.join('\n')}`
        }]);
      }
      if (params.fatalErrors.length) {
        // In case of fatal errors, report first remaining test as failing with these errors,
        // and all others as skipped.
        massSkipTestsFromRemaining(new Set(remaining.map(test => test.id)), params.fatalErrors);
      }
      // Handle tests that should be skipped because of the setup failure.
      massSkipTestsFromRemaining(new Set(params.skipTestsDueToSetupFailure), []);
      // Handle unexpected worker exit.
      if (params.unexpectedExitError) massSkipTestsFromRemaining(new Set(remaining.map(test => test.id)), [params.unexpectedExitError], true /* onlyStartedTests */);

      const retryCandidates = new Set();
      const serialSuitesWithFailures = new Set();
      for (const failedTestId of failedTestIds) {
        retryCandidates.add(failedTestId);
        let outermostSerialSuite;
        for (let parent = this._testById.get(failedTestId).test.parent; parent; parent = parent.parent) {
          if (parent._parallelMode === 'serial') outermostSerialSuite = parent;
        }
        if (outermostSerialSuite) serialSuitesWithFailures.add(outermostSerialSuite);
      }

      // We have failed tests that belong to a serial suite.
      // We should skip all future tests from the same serial suite.
      remaining = remaining.filter(test => {
        var _this$_reporter$onTes4, _this$_reporter8;
        let parent = test.parent;
        while (parent && !serialSuitesWithFailures.has(parent)) parent = parent.parent;

        // Does not belong to the failed serial suite, keep it.
        if (!parent) return true;

        // Emulate a "skipped" run, and drop this test from remaining.
        const result = test._appendTestResult();
        (_this$_reporter$onTes4 = (_this$_reporter8 = this._reporter).onTestBegin) === null || _this$_reporter$onTes4 === void 0 ? void 0 : _this$_reporter$onTes4.call(_this$_reporter8, test, result);
        result.status = 'skipped';
        this._reportTestEnd(test, result);
        return false;
      });
      for (const serialSuite of serialSuitesWithFailures) {
        // Add all tests from faiiled serial suites for possible retry.
        // These will only be retried together, because they have the same
        // "retries" setting and the same number of previous runs.
        serialSuite.allTests().forEach(test => retryCandidates.add(test.id));
      }
      for (const testId of retryCandidates) {
        const pair = this._testById.get(testId);
        if (!this._isStopped && pair.test.results.length < pair.test.retries + 1) remaining.push(pair.test);
      }
      if (remaining.length) {
        this._queue.unshift({
          ...testGroup,
          tests: remaining
        });
        this._queuedOrRunningHashCount.set(testGroup.workerHash, this._queuedOrRunningHashCount.get(testGroup.workerHash) + 1);
        // Perhaps we can immediately start the new job if there is a worker available?
        this._scheduleJob();
      }

      // This job is over, we just scheduled another one.
      doneWithJob();
    };
    worker.on('done', onDone);
    const onExit = data => {
      const unexpectedExitError = data.unexpectedly ? {
        message: `Internal error: worker process exited unexpectedly (code=${data.code}, signal=${data.signal})`
      } : undefined;
      onDone({
        skipTestsDueToSetupFailure: [],
        fatalErrors: [],
        unexpectedExitError
      });
    };
    worker.on('exit', onExit);
    return result;
  }
  _createWorker(testGroup, parallelIndex, loaderData) {
    const worker = new _workerHost.WorkerHost(testGroup, parallelIndex, loaderData, this._extraEnvByProjectId.get(testGroup.projectId) || {});
    const handleOutput = params => {
      var _data$resultByWorkerI;
      const chunk = chunkFromParams(params);
      if (worker.didFail()) {
        // Note: we keep reading stdio from workers that are currently stopping after failure,
        // to debug teardown issues. However, we avoid spoiling the test result from
        // the next retry.
        return {
          chunk
        };
      }
      if (!worker.currentTestId) return {
        chunk
      };
      const data = this._testById.get(worker.currentTestId);
      return {
        chunk,
        test: data.test,
        result: (_data$resultByWorkerI = data.resultByWorkerIndex.get(worker.workerIndex)) === null || _data$resultByWorkerI === void 0 ? void 0 : _data$resultByWorkerI.result
      };
    };
    worker.on('stdOut', params => {
      var _this$_reporter$onStd2, _this$_reporter9;
      const {
        chunk,
        test,
        result
      } = handleOutput(params);
      result === null || result === void 0 ? void 0 : result.stdout.push(chunk);
      (_this$_reporter$onStd2 = (_this$_reporter9 = this._reporter).onStdOut) === null || _this$_reporter$onStd2 === void 0 ? void 0 : _this$_reporter$onStd2.call(_this$_reporter9, chunk, test, result);
    });
    worker.on('stdErr', params => {
      var _this$_reporter$onStd3, _this$_reporter10;
      const {
        chunk,
        test,
        result
      } = handleOutput(params);
      result === null || result === void 0 ? void 0 : result.stderr.push(chunk);
      (_this$_reporter$onStd3 = (_this$_reporter10 = this._reporter).onStdErr) === null || _this$_reporter$onStd3 === void 0 ? void 0 : _this$_reporter$onStd3.call(_this$_reporter10, chunk, test, result);
    });
    worker.on('teardownErrors', params => {
      this._hasWorkerErrors = true;
      for (const error of params.fatalErrors) {
        var _this$_reporter$onErr2, _this$_reporter11;
        (_this$_reporter$onErr2 = (_this$_reporter11 = this._reporter).onError) === null || _this$_reporter$onErr2 === void 0 ? void 0 : _this$_reporter$onErr2.call(_this$_reporter11, error);
      }
    });
    worker.on('exit', () => {
      const producedEnv = this._producedEnvByProjectId.get(testGroup.projectId) || {};
      this._producedEnvByProjectId.set(testGroup.projectId, {
        ...producedEnv,
        ...worker.producedEnv()
      });
    });
    return worker;
  }
  producedEnvByProjectId() {
    return this._producedEnvByProjectId;
  }
  async stop() {
    if (this._isStopped) return;
    this._isStopped = true;
    await Promise.all(this._workerSlots.map(({
      worker
    }) => worker === null || worker === void 0 ? void 0 : worker.stop()));
    this._checkFinished();
  }
  _hasReachedMaxFailures() {
    const maxFailures = this._config.maxFailures;
    return maxFailures > 0 && this._failureCount >= maxFailures;
  }
  _reportTestEnd(test, result) {
    var _this$_reporter$onTes5, _this$_reporter12;
    if (result.status !== 'skipped' && result.status !== test.expectedStatus) ++this._failureCount;
    (_this$_reporter$onTes5 = (_this$_reporter12 = this._reporter).onTestEnd) === null || _this$_reporter$onTes5 === void 0 ? void 0 : _this$_reporter$onTes5.call(_this$_reporter12, test, result);
    const maxFailures = this._config.maxFailures;
    if (maxFailures && this._failureCount === maxFailures) this.stop().catch(e => {});
  }
  hasWorkerErrors() {
    return this._hasWorkerErrors;
  }
}
exports.Dispatcher = Dispatcher;
function chunkFromParams(params) {
  if (typeof params.text === 'string') return params.text;
  return Buffer.from(params.buffer, 'base64');
}