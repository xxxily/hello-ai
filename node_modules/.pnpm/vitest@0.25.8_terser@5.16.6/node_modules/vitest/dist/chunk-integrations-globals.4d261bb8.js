import { m as globalApis } from './chunk-utils-env.03f840f2.js';
import { i as index } from './chunk-runtime-test-state.3f86f48f.js';
import 'tty';
import 'url';
import 'path';
import './chunk-runtime-chain.f86e5250.js';
import 'util';
import 'chai';
import './chunk-typecheck-constants.ed987901.js';
import 'local-pkg';
import './vendor-_commonjsHelpers.addc3445.js';
import './chunk-runtime-rpc.42aebbb9.js';
import './chunk-utils-timers.793fd179.js';
import 'fs';
import './chunk-utils-source-map.29ff1088.js';
import './spy.js';
import 'tinyspy';

function registerApiGlobally() {
  globalApis.forEach((api) => {
    globalThis[api] = index[api];
  });
}

export { registerApiGlobally };
