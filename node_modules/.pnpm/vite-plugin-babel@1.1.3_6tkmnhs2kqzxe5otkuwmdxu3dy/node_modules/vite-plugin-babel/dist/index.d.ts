import { TransformOptions } from '@babel/core';
import { Loader, Plugin } from 'esbuild';
import { Plugin as Plugin$1 } from 'vite';

/**
 * Original: https://github.com/nativew/esbuild-plugin-babel
 * Copied, because there was a problem with `type: "module"` in `package.json`
 */
interface ESBuildPluginBabelOptions {
    config?: TransformOptions;
    filter?: RegExp;
    namespace?: string;
    loader?: Loader | ((path: string) => Loader);
}
declare const esbuildPluginBabel: (options?: ESBuildPluginBabelOptions) => Plugin;

interface BabelPluginOptions {
    apply?: 'serve' | 'build';
    babelConfig?: TransformOptions;
    filter?: RegExp;
    loader?: Loader | ((path: string) => Loader);
}
declare const babelPlugin: ({ babelConfig, filter, apply, loader }?: BabelPluginOptions) => Plugin$1;

export { BabelPluginOptions, ESBuildPluginBabelOptions, babelPlugin as default, esbuildPluginBabel };
