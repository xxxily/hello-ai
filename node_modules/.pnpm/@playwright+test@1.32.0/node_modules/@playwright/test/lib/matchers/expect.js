"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.printReceivedStringContainExpectedSubstring = exports.printReceivedStringContainExpectedResult = exports.expect = void 0;
var _utils = require("playwright-core/lib/utils");
var _matchers = require("./matchers");
var _toMatchSnapshot = require("./toMatchSnapshot");
var _globals = require("../common/globals");
var _util = require("../util");
var _expectBundle = require("../common/expectBundle");
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

// #region
// Mirrored from https://github.com/facebook/jest/blob/f13abff8df9a0e1148baf3584bcde6d1b479edc7/packages/expect/src/print.ts
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found here
 * https://github.com/facebook/jest/blob/1547740bbc26400d69f4576bf35645163e942829/LICENSE
 */

// Format substring but do not enclose in double quote marks.
// The replacement is compatible with pretty-format package.
const printSubstring = val => val.replace(/"|\\/g, '\\$&');
let lastCallId = 0;
const printReceivedStringContainExpectedSubstring = (received, start, length // not end
) => (0, _expectBundle.RECEIVED_COLOR)('"' + printSubstring(received.slice(0, start)) + (0, _expectBundle.INVERTED_COLOR)(printSubstring(received.slice(start, start + length))) + printSubstring(received.slice(start + length)) + '"');
exports.printReceivedStringContainExpectedSubstring = printReceivedStringContainExpectedSubstring;
const printReceivedStringContainExpectedResult = (received, result) => result === null ? (0, _expectBundle.printReceived)(received) : printReceivedStringContainExpectedSubstring(received, result.index, result[0].length);

// #endregion
exports.printReceivedStringContainExpectedResult = printReceivedStringContainExpectedResult;
function createExpect(actual, messageOrOptions, isSoft, isPoll, generator) {
  return new Proxy((0, _expectBundle.expect)(actual), new ExpectMetaInfoProxyHandler(messageOrOptions, isSoft, isPoll, generator));
}
const expect = new Proxy(_expectBundle.expect, {
  apply: function (target, thisArg, argumentsList) {
    const [actual, messageOrOptions] = argumentsList;
    return createExpect(actual, messageOrOptions, false /* isSoft */, false /* isPoll */);
  }
});
exports.expect = expect;
expect.soft = (actual, messageOrOptions) => {
  return createExpect(actual, messageOrOptions, true /* isSoft */, false /* isPoll */);
};

expect.poll = (actual, messageOrOptions) => {
  if (typeof actual !== 'function') throw new Error('`expect.poll()` accepts only function as a first argument');
  return createExpect(actual, messageOrOptions, false /* isSoft */, true /* isPoll */, actual);
};
_expectBundle.expect.setState({
  expand: false
});
const customMatchers = {
  toBeChecked: _matchers.toBeChecked,
  toBeDisabled: _matchers.toBeDisabled,
  toBeEditable: _matchers.toBeEditable,
  toBeEmpty: _matchers.toBeEmpty,
  toBeEnabled: _matchers.toBeEnabled,
  toBeFocused: _matchers.toBeFocused,
  toBeHidden: _matchers.toBeHidden,
  toBeInViewport: _matchers.toBeInViewport,
  toBeOK: _matchers.toBeOK,
  toBeVisible: _matchers.toBeVisible,
  toContainText: _matchers.toContainText,
  toHaveAttribute: _matchers.toHaveAttribute,
  toHaveClass: _matchers.toHaveClass,
  toHaveCount: _matchers.toHaveCount,
  toHaveCSS: _matchers.toHaveCSS,
  toHaveId: _matchers.toHaveId,
  toHaveJSProperty: _matchers.toHaveJSProperty,
  toHaveText: _matchers.toHaveText,
  toHaveTitle: _matchers.toHaveTitle,
  toHaveURL: _matchers.toHaveURL,
  toHaveValue: _matchers.toHaveValue,
  toHaveValues: _matchers.toHaveValues,
  toMatchSnapshot: _toMatchSnapshot.toMatchSnapshot,
  toHaveScreenshot: _toMatchSnapshot.toHaveScreenshot,
  toPass: _matchers.toPass
};
class ExpectMetaInfoProxyHandler {
  constructor(messageOrOptions, isSoft, isPoll, generator) {
    this._info = void 0;
    this._info = {
      isSoft,
      isPoll,
      generator,
      isNot: false,
      nameTokens: []
    };
    if (typeof messageOrOptions === 'string') {
      this._info.message = messageOrOptions;
    } else {
      this._info.message = messageOrOptions === null || messageOrOptions === void 0 ? void 0 : messageOrOptions.message;
      this._info.pollTimeout = messageOrOptions === null || messageOrOptions === void 0 ? void 0 : messageOrOptions.timeout;
      this._info.pollIntervals = messageOrOptions === null || messageOrOptions === void 0 ? void 0 : messageOrOptions.intervals;
    }
  }
  get(target, matcherName, receiver) {
    let matcher = Reflect.get(target, matcherName, receiver);
    if (typeof matcherName !== 'string') return matcher;
    if (matcher === undefined) throw new Error(`expect: Property '${matcherName}' not found.`);
    if (typeof matcher !== 'function') {
      if (matcherName === 'not') this._info.isNot = !this._info.isNot;
      return new Proxy(matcher, this);
    }
    if (this._info.isPoll) {
      if (customMatchers[matcherName] || matcherName === 'resolves' || matcherName === 'rejects') throw new Error(`\`expect.poll()\` does not support "${matcherName}" matcher.`);
      matcher = (...args) => pollMatcher(matcherName, this._info.isNot, this._info.pollIntervals, (0, _globals.currentExpectTimeout)({
        timeout: this._info.pollTimeout
      }), this._info.generator, ...args);
    }
    return (...args) => {
      const testInfo = (0, _globals.currentTestInfo)();
      if (!testInfo) return matcher.call(target, ...args);
      const rawStack = (0, _utils.captureRawStack)();
      const stackFrames = (0, _util.filteredStackTrace)(rawStack);
      const customMessage = this._info.message || '';
      const defaultTitle = `expect${this._info.isPoll ? '.poll' : ''}${this._info.isSoft ? '.soft' : ''}${this._info.isNot ? '.not' : ''}.${matcherName}`;
      const wallTime = Date.now();
      const step = testInfo._addStep({
        location: stackFrames[0],
        category: 'expect',
        title: (0, _util.trimLongString)(customMessage || defaultTitle, 1024),
        canHaveChildren: true,
        forceNoParent: false,
        wallTime
      });
      testInfo.currentStep = step;
      const generateTraceEvent = matcherName !== 'poll' && matcherName !== 'toPass';
      const callId = ++lastCallId;
      if (generateTraceEvent) testInfo._traceEvents.push((0, _utils.createBeforeActionTraceEventForExpect)(`expect@${callId}`, defaultTitle, args[0], stackFrames));
      const reportStepError = jestError => {
        const message = jestError.message;
        if (customMessage) {
          const messageLines = message.split('\n');
          // Jest adds something like the following error to all errors:
          //    expect(received).toBe(expected); // Object.is equality
          const uselessMatcherLineIndex = messageLines.findIndex(line => /expect.*\(.*received.*\)/.test(line));
          if (uselessMatcherLineIndex !== -1) {
            // if there's a newline after the matcher text, then remove it as well.
            if (uselessMatcherLineIndex + 1 < messageLines.length && messageLines[uselessMatcherLineIndex + 1].trim() === '') messageLines.splice(uselessMatcherLineIndex, 2);else messageLines.splice(uselessMatcherLineIndex, 1);
          }
          const newMessage = [customMessage, '', ...messageLines].join('\n');
          jestError.message = newMessage;
          jestError.stack = jestError.name + ': ' + newMessage + '\n' + (0, _util.stringifyStackFrames)(stackFrames).join('\n');
        }
        const serializerError = (0, _util.serializeError)(jestError);
        if (generateTraceEvent) {
          const error = {
            name: jestError.name,
            message: jestError.message,
            stack: jestError.stack
          };
          testInfo._traceEvents.push((0, _utils.createAfterActionTraceEventForExpect)(`expect@${callId}`, error));
        }
        step.complete({
          error: serializerError
        });
        if (this._info.isSoft) testInfo._failWithError(serializerError, false /* isHardError */);else throw jestError;
      };
      const finalizer = () => {
        if (generateTraceEvent) testInfo._traceEvents.push((0, _utils.createAfterActionTraceEventForExpect)(`expect@${callId}`));
        step.complete({});
      };
      try {
        const expectZone = {
          title: defaultTitle,
          wallTime
        };
        const result = _utils.zones.run('expectZone', expectZone, () => {
          return matcher.call(target, ...args);
        });
        if (result instanceof Promise) return result.then(() => finalizer()).catch(reportStepError);else finalizer();
      } catch (e) {
        reportStepError(e);
      }
    };
  }
}
async function pollMatcher(matcherName, isNot, pollIntervals, timeout, generator, ...args) {
  const result = await (0, _utils.pollAgainstTimeout)(async () => {
    const value = await generator();
    let expectInstance = (0, _expectBundle.expect)(value);
    if (isNot) expectInstance = expectInstance.not;
    try {
      expectInstance[matcherName].call(expectInstance, ...args);
      return {
        continuePolling: false,
        result: undefined
      };
    } catch (error) {
      return {
        continuePolling: true,
        result: error
      };
    }
  }, timeout, pollIntervals !== null && pollIntervals !== void 0 ? pollIntervals : [100, 250, 500, 1000]);
  if (result.timedOut) {
    const timeoutMessage = `Timeout ${timeout}ms exceeded while waiting on the predicate`;
    const message = result.result ? [result.result.message, '', `Call Log:`, `- ${timeoutMessage}`].join('\n') : timeoutMessage;
    throw new Error(message);
  }
}
_expectBundle.expect.extend(customMatchers);