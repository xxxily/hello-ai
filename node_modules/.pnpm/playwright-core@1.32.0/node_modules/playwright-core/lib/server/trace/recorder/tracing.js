"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Tracing = void 0;
exports.shouldCaptureSnapshot = shouldCaptureSnapshot;
var _fs = _interopRequireDefault(require("fs"));
var _os = _interopRequireDefault(require("os"));
var _path = _interopRequireDefault(require("path"));
var _debug = require("../../../protocol/debug");
var _manualPromise = require("../../../utils/manualPromise");
var _eventsHelper = require("../../../utils/eventsHelper");
var _utils = require("../../../utils");
var _fileUtils = require("../../../utils/fileUtils");
var _artifact = require("../../artifact");
var _browserContext = require("../../browserContext");
var _dom = require("../../dom");
var _instrumentation = require("../../instrumentation");
var _page = require("../../page");
var _harTracer = require("../../har/harTracer");
var _snapshotter = require("./snapshotter");
var _zipBundle = require("../../../zipBundle");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright (c) Microsoft Corporation.
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

const version = 4;
const kScreencastOptions = {
  width: 800,
  height: 600,
  quality: 90
};
class Tracing extends _instrumentation.SdkObject {
  constructor(context, tracesDir) {
    var _browser, _browser$options;
    super(context, 'tracing');
    this._writeChain = Promise.resolve();
    this._snapshotter = void 0;
    this._harTracer = void 0;
    this._screencastListeners = [];
    this._context = void 0;
    this._state = void 0;
    this._isStopping = false;
    this._precreatedTracesDir = void 0;
    this._tracesTmpDir = void 0;
    this._allResources = new Set();
    this._contextCreatedEvent = void 0;
    this._context = context;
    this._precreatedTracesDir = tracesDir;
    this._harTracer = new _harTracer.HarTracer(context, null, this, {
      content: 'attach',
      includeTraceInfo: true,
      recordRequestOverrides: false,
      waitForContentOnStop: false,
      skipScripts: true
    });
    const testIdAttributeName = 'selectors' in context ? context.selectors().testIdAttributeName() : undefined;
    this._contextCreatedEvent = {
      version,
      type: 'context-options',
      browserName: '',
      options: {},
      platform: process.platform,
      wallTime: 0,
      sdkLanguage: context === null || context === void 0 ? void 0 : (_browser = context._browser) === null || _browser === void 0 ? void 0 : (_browser$options = _browser.options) === null || _browser$options === void 0 ? void 0 : _browser$options.sdkLanguage,
      testIdAttributeName
    };
    if (context instanceof _browserContext.BrowserContext) {
      this._snapshotter = new _snapshotter.Snapshotter(context, this);
      (0, _utils.assert)(tracesDir, 'tracesDir must be specified for BrowserContext');
      this._contextCreatedEvent.browserName = context._browser.options.name;
      this._contextCreatedEvent.options = context._options;
    }
  }
  resetForReuse() {
    var _this$_snapshotter;
    (_this$_snapshotter = this._snapshotter) === null || _this$_snapshotter === void 0 ? void 0 : _this$_snapshotter.resetForReuse();
  }
  async start(options) {
    var _this$_context, _this$_context$_brows, _this$_context$_brows2;
    if (this._isStopping) throw new Error('Cannot start tracing while stopping');

    // Re-write for testing.
    this._contextCreatedEvent.sdkLanguage = (_this$_context = this._context) === null || _this$_context === void 0 ? void 0 : (_this$_context$_brows = _this$_context._browser) === null || _this$_context$_brows === void 0 ? void 0 : (_this$_context$_brows2 = _this$_context$_brows.options) === null || _this$_context$_brows2 === void 0 ? void 0 : _this$_context$_brows2.sdkLanguage;
    if (this._state) {
      const o = this._state.options;
      if (!o.screenshots !== !options.screenshots || !o.snapshots !== !options.snapshots) throw new Error('Tracing has been already started with different options');
      if (options.name && options.name !== this._state.traceName) await this._changeTraceName(this._state, options.name);
      return;
    }
    // TODO: passing the same name for two contexts makes them write into a single file
    // and conflict.
    const traceName = options.name || (0, _utils.createGuid)();
    // Init the state synchronously.
    this._state = {
      options,
      traceName,
      traceFile: '',
      networkFile: '',
      tracesDir: '',
      resourcesDir: '',
      chunkOrdinal: 0,
      traceSha1s: new Set(),
      networkSha1s: new Set(),
      recording: false
    };
    const state = this._state;
    state.tracesDir = await this._createTracesDirIfNeeded();
    state.resourcesDir = _path.default.join(state.tracesDir, 'resources');
    state.traceFile = _path.default.join(state.tracesDir, traceName + '.trace');
    state.networkFile = _path.default.join(state.tracesDir, traceName + '.network');
    this._writeChain = _fs.default.promises.mkdir(state.resourcesDir, {
      recursive: true
    }).then(() => _fs.default.promises.writeFile(state.networkFile, ''));
    if (options.snapshots) this._harTracer.start();
  }
  async startChunk(options = {}) {
    var _this$_snapshotter2;
    if (this._state && this._state.recording) await this.stopChunk({
      mode: 'discard'
    });
    if (!this._state) throw new Error('Must start tracing before starting a new chunk');
    if (this._isStopping) throw new Error('Cannot start a trace chunk while stopping');
    const state = this._state;
    const suffix = state.chunkOrdinal ? `-${state.chunkOrdinal}` : ``;
    state.chunkOrdinal++;
    state.traceFile = _path.default.join(state.tracesDir, `${state.traceName}${suffix}.trace`);
    state.recording = true;
    if (options.name && options.name !== this._state.traceName) this._changeTraceName(this._state, options.name);
    this._appendTraceOperation(async () => {
      await (0, _fileUtils.mkdirIfNeeded)(state.traceFile);
      await _fs.default.promises.appendFile(state.traceFile, JSON.stringify({
        ...this._contextCreatedEvent,
        title: options.title,
        wallTime: Date.now()
      }) + '\n');
    });
    this._context.instrumentation.addListener(this, this._context);
    if (state.options.screenshots) this._startScreencast();
    if (state.options.snapshots) await ((_this$_snapshotter2 = this._snapshotter) === null || _this$_snapshotter2 === void 0 ? void 0 : _this$_snapshotter2.start());
    return {
      traceName: state.traceName
    };
  }
  _startScreencast() {
    if (!(this._context instanceof _browserContext.BrowserContext)) return;
    for (const page of this._context.pages()) this._startScreencastInPage(page);
    this._screencastListeners.push(_eventsHelper.eventsHelper.addEventListener(this._context, _browserContext.BrowserContext.Events.Page, this._startScreencastInPage.bind(this)));
  }
  _stopScreencast() {
    _eventsHelper.eventsHelper.removeEventListeners(this._screencastListeners);
    if (!(this._context instanceof _browserContext.BrowserContext)) return;
    for (const page of this._context.pages()) page.setScreencastOptions(null);
  }
  async _changeTraceName(state, name) {
    await this._appendTraceOperation(async () => {
      const oldNetworkFile = state.networkFile;
      state.traceName = name;
      state.traceFile = _path.default.join(state.tracesDir, name + '.trace');
      state.networkFile = _path.default.join(state.tracesDir, name + '.network');
      // Network file survives across chunks, so make a copy with the new name.
      await _fs.default.promises.copyFile(oldNetworkFile, state.networkFile);
    });
  }
  async stop() {
    if (!this._state) return;
    if (this._isStopping) throw new Error(`Tracing is already stopping`);
    if (this._state.recording) throw new Error(`Must stop trace file before stopping tracing`);
    this._harTracer.stop();
    await this._writeChain;
    this._state = undefined;
  }
  async deleteTmpTracesDir() {
    if (this._tracesTmpDir) await (0, _fileUtils.removeFolders)([this._tracesTmpDir]);
  }
  async _createTracesDirIfNeeded() {
    if (this._precreatedTracesDir) return this._precreatedTracesDir;
    this._tracesTmpDir = await _fs.default.promises.mkdtemp(_path.default.join(_os.default.tmpdir(), 'playwright-tracing-'));
    return this._tracesTmpDir;
  }
  async dispose() {
    var _this$_snapshotter3;
    (_this$_snapshotter3 = this._snapshotter) === null || _this$_snapshotter3 === void 0 ? void 0 : _this$_snapshotter3.dispose();
    this._harTracer.stop();
    await this._writeChain;
  }
  async stopChunk(params) {
    var _this$_state, _this$_snapshotter4;
    if (this._isStopping) throw new Error(`Tracing is already stopping`);
    this._isStopping = true;
    if (!this._state || !this._state.recording) {
      this._isStopping = false;
      if (params.mode !== 'discard') throw new Error(`Must start tracing before stopping`);
      return {};
    }
    const state = this._state;
    this._context.instrumentation.removeListener(this);
    if ((_this$_state = this._state) !== null && _this$_state !== void 0 && _this$_state.options.screenshots) this._stopScreencast();
    if (state.options.snapshots) await ((_this$_snapshotter4 = this._snapshotter) === null || _this$_snapshotter4 === void 0 ? void 0 : _this$_snapshotter4.stop());

    // Chain the export operation against write operations,
    // so that neither trace files nor sha1s change during the export.
    return (await this._appendTraceOperation(async () => {
      if (params.mode === 'discard') return {};

      // Network file survives across chunks, make a snapshot before returning the resulting entries.
      const suffix = state.chunkOrdinal ? `-${state.chunkOrdinal}` : ``;
      const networkFile = _path.default.join(state.tracesDir, state.traceName + `${suffix}.network`);
      await _fs.default.promises.copyFile(state.networkFile, networkFile);
      const entries = [];
      entries.push({
        name: 'trace.trace',
        value: state.traceFile
      });
      entries.push({
        name: 'trace.network',
        value: networkFile
      });
      for (const sha1 of new Set([...state.traceSha1s, ...state.networkSha1s])) entries.push({
        name: _path.default.join('resources', sha1),
        value: _path.default.join(state.resourcesDir, sha1)
      });
      if (params.mode === 'entries') return {
        entries
      };
      const artifact = await this._exportZip(entries, state).catch(() => undefined);
      return {
        artifact
      };
    }).finally(() => {
      // Only reset trace sha1s, network resources are preserved between chunks.
      state.traceSha1s = new Set();
      this._isStopping = false;
      state.recording = false;
    })) || {};
  }
  _exportZip(entries, state) {
    const zipFile = new _zipBundle.yazl.ZipFile();
    const result = new _manualPromise.ManualPromise();
    zipFile.on('error', error => result.reject(error));
    for (const entry of entries) zipFile.addFile(entry.value, entry.name);
    zipFile.end();
    const zipFileName = state.traceFile + '.zip';
    zipFile.outputStream.pipe(_fs.default.createWriteStream(zipFileName)).on('close', () => {
      const artifact = new _artifact.Artifact(this._context, zipFileName);
      artifact.reportFinished();
      result.resolve(artifact);
    });
    return result;
  }
  async _captureSnapshot(snapshotName, sdkObject, metadata, element) {
    if (!this._snapshotter) return;
    if (!sdkObject.attribution.page) return;
    if (!this._snapshotter.started()) return;
    if (!shouldCaptureSnapshot(metadata)) return;
    // We have |element| for input actions (page.click and handle.click)
    // and |sdkObject| element for accessors like handle.textContent.
    if (!element && sdkObject instanceof _dom.ElementHandle) element = sdkObject;
    await this._snapshotter.captureSnapshot(sdkObject.attribution.page, metadata.id, snapshotName, element).catch(() => {});
  }
  onBeforeCall(sdkObject, metadata) {
    var _sdkObject$attributio;
    // IMPORTANT: no awaits before this._appendTraceEvent in this method.
    const event = createBeforeActionTraceEvent(metadata);
    if (!event) return Promise.resolve();
    (_sdkObject$attributio = sdkObject.attribution.page) === null || _sdkObject$attributio === void 0 ? void 0 : _sdkObject$attributio.temporarlyDisableTracingScreencastThrottling();
    event.beforeSnapshot = `before@${metadata.id}`;
    this._appendTraceEvent(event);
    return this._captureSnapshot(event.beforeSnapshot, sdkObject, metadata);
  }
  onBeforeInputAction(sdkObject, metadata, element) {
    var _sdkObject$attributio2;
    // IMPORTANT: no awaits before this._appendTraceEvent in this method.
    const event = createInputActionTraceEvent(metadata);
    if (!event) return Promise.resolve();
    (_sdkObject$attributio2 = sdkObject.attribution.page) === null || _sdkObject$attributio2 === void 0 ? void 0 : _sdkObject$attributio2.temporarlyDisableTracingScreencastThrottling();
    event.inputSnapshot = `input@${metadata.id}`;
    this._appendTraceEvent(event);
    return this._captureSnapshot(event.inputSnapshot, sdkObject, metadata, element);
  }
  async onAfterCall(sdkObject, metadata) {
    var _sdkObject$attributio3;
    const event = createAfterActionTraceEvent(metadata);
    if (!event) return Promise.resolve();
    (_sdkObject$attributio3 = sdkObject.attribution.page) === null || _sdkObject$attributio3 === void 0 ? void 0 : _sdkObject$attributio3.temporarlyDisableTracingScreencastThrottling();
    event.afterSnapshot = `after@${metadata.id}`;
    this._appendTraceEvent(event);
    return this._captureSnapshot(event.afterSnapshot, sdkObject, metadata);
  }
  onEvent(sdkObject, event) {
    if (!sdkObject.attribution.context) return;
    if (event.method === '__create__' && event.class === 'ConsoleMessage') {
      const object = {
        type: 'object',
        class: event.class,
        guid: event.params.guid,
        initializer: event.params.initializer
      };
      this._appendTraceEvent(object);
      return;
    }
    this._appendTraceEvent(event);
  }
  onEntryStarted(entry) {}
  onEntryFinished(entry) {
    const event = {
      type: 'resource-snapshot',
      snapshot: entry
    };
    this._appendTraceOperation(async () => {
      const visited = visitTraceEvent(event, this._state.networkSha1s);
      await _fs.default.promises.appendFile(this._state.networkFile, JSON.stringify(visited) + '\n');
    });
  }
  onContentBlob(sha1, buffer) {
    this._appendResource(sha1, buffer);
  }
  onSnapshotterBlob(blob) {
    this._appendResource(blob.sha1, blob.buffer);
  }
  onFrameSnapshot(snapshot) {
    this._appendTraceEvent({
      type: 'frame-snapshot',
      snapshot
    });
  }
  _startScreencastInPage(page) {
    page.setScreencastOptions(kScreencastOptions);
    const prefix = page.guid;
    this._screencastListeners.push(_eventsHelper.eventsHelper.addEventListener(page, _page.Page.Events.ScreencastFrame, params => {
      const suffix = params.timestamp || Date.now();
      const sha1 = `${prefix}-${suffix}.jpeg`;
      const event = {
        type: 'screencast-frame',
        pageId: page.guid,
        sha1,
        width: params.width,
        height: params.height,
        timestamp: (0, _utils.monotonicTime)()
      };
      // Make sure to write the screencast frame before adding a reference to it.
      this._appendResource(sha1, params.buffer);
      this._appendTraceEvent(event);
    }));
  }
  _appendTraceEvent(event) {
    this._appendTraceOperation(async () => {
      const visited = visitTraceEvent(event, this._state.traceSha1s);
      await _fs.default.promises.appendFile(this._state.traceFile, JSON.stringify(visited) + '\n');
    });
  }
  _appendResource(sha1, buffer) {
    if (this._allResources.has(sha1)) return;
    this._allResources.add(sha1);
    const resourcePath = _path.default.join(this._state.resourcesDir, sha1);
    this._appendTraceOperation(async () => {
      try {
        // Perhaps we've already written this resource?
        await _fs.default.promises.access(resourcePath);
      } catch (e) {
        // If not, let's write! Note that async access is safe because we
        // never remove resources until the very end.
        await _fs.default.promises.writeFile(resourcePath, buffer).catch(() => {});
      }
    });
  }
  async _appendTraceOperation(cb) {
    // This method serializes all writes to the trace.
    let error;
    let result;
    this._writeChain = this._writeChain.then(async () => {
      // This check is here because closing the browser removes the tracesDir and tracing
      // dies trying to archive.
      if (this._context instanceof _browserContext.BrowserContext && !this._context._browser.isConnected()) return;
      try {
        result = await cb();
      } catch (e) {
        error = e;
      }
    });
    await this._writeChain;
    if (error) throw error;
    return result;
  }
}
exports.Tracing = Tracing;
function visitTraceEvent(object, sha1s) {
  if (Array.isArray(object)) return object.map(o => visitTraceEvent(o, sha1s));
  if (object instanceof Buffer) return undefined;
  if (typeof object === 'object') {
    const result = {};
    for (const key in object) {
      if (key === 'sha1' || key === '_sha1' || key.endsWith('Sha1')) {
        const sha1 = object[key];
        if (sha1) sha1s.add(sha1);
      }
      result[key] = visitTraceEvent(object[key], sha1s);
    }
    return result;
  }
  return object;
}
function shouldCaptureSnapshot(metadata) {
  return _debug.commandsWithTracingSnapshots.has(metadata.type + '.' + metadata.method);
}
function createBeforeActionTraceEvent(metadata) {
  if (metadata.internal || metadata.method.startsWith('tracing')) return null;
  return {
    type: 'before',
    callId: metadata.id,
    startTime: metadata.startTime,
    apiName: metadata.apiName || metadata.type + '.' + metadata.method,
    class: metadata.type,
    method: metadata.method,
    params: metadata.params,
    wallTime: metadata.wallTime,
    pageId: metadata.pageId
  };
}
function createInputActionTraceEvent(metadata) {
  if (metadata.internal || metadata.method.startsWith('tracing')) return null;
  return {
    type: 'input',
    callId: metadata.id,
    point: metadata.point
  };
}
function createAfterActionTraceEvent(metadata) {
  var _metadata$error;
  if (metadata.internal || metadata.method.startsWith('tracing')) return null;
  return {
    type: 'after',
    callId: metadata.id,
    endTime: metadata.endTime,
    log: metadata.log,
    error: (_metadata$error = metadata.error) === null || _metadata$error === void 0 ? void 0 : _metadata$error.error,
    result: metadata.result
  };
}