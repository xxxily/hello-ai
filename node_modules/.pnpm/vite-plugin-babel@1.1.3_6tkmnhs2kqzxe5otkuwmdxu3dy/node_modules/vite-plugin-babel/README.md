# Vite Plugin Babel

Run Babel during any Vite command, also during serve.

## Motivations

Most Vite plugins runs Babel only during `build`, not `serve`, and only other possible way to do this is via [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react). ESBuild is awesome tool, but doesn't support some experimental features, like decorators ([issue #2349](https://github.com/vitejs/vite/issues/2349)) or class instance fields, out of box. You can use them in TypeScript, but not pure JS. This plugin was made to enable usage of such features and runs babel during `optimizeDeps`, `dev` and `build` stages, but it can be configured.

## Instalation

```bash
# yarn
yarn add -D vite-plugin-babel

# npm
npm install -D vite-plugin-babel
```

## Usage

Add it to your Vite config

```js
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';

export default defineConfig({
    plugins: [
        // Babel will try to pick up Babel config files (.babelrc or .babelrc.json)
        babel(),
        // ...
    ],

    // ...
})
```

## Config

Babel config can be either passed to `babelConfig` field or via Babel config file. For all babel options see: [Babel Options](https://babeljs.io/docs/en/options).

By default, babel is run for JS/JSX files. You can change that vie `filter` option.

| Name | Type | Default | Description |
|---|---|---|---|
| `apply` | `serve` or `build` | `undefined` | Limits plugin usage to only build or only serve. If not specified, will be run during both cycles. |
| `babelConfig` | `object` | `{}` | [Babel Transform Options](https://babeljs.io/docs/en/options) |
| `filter` | `RegExp` | `/\.jsx?$/` | Which files is babel applied to. By default, it's js/jsx files. |
| `loader` | `Loader` or `(path: string) => Loader` | `undefined` | This tells esbuild how to interpret the contents after babel's transformation. For example, the js loader interprets the contents as JavaScript and the css loader interprets the contents as CSS. The loader defaults to js if it's not specified. See the [Content Types](https://esbuild.github.io/content-types) page for a complete list of all built-in loaders. |

## Tips

Vite team didn't enabled and included Babel by default, because they wanted to keep expirience as fast as possible and esbuild can already do a lot of things, you would probably do with Babel. Because of that, we recommend to only include those Babel plugins you really need. You can use option `babelConfig.plugin` and disable usage of Babel config file, ex.:

```js
babel({
    babelConfig: {
        babelrc: false,
        configFile: false,
        plugins: ['@babel/plugin-proposal-decorators']
    }
})
```

or just use `.babelrc.json`.

__NOTE:__ Any babel plugins and presets need to be installed seperately and are not included with this package.

## Troubleshooting

#### [ERROR] The JSX syntax extension is not currently enabled

This usually happens when you're using this plugin to only transform part of a `.jsx` file (such as decorators), and leaving the JSX syntax untouched. By default, esbuild interprets contents as `.js`, so you'll need to specify the loader esbuild should use.

Example:

```js
import { extname } from 'path';
// ...
babel({
    babelConfig: {
        babelrc: false,
        configFile: false,
        plugins: ['@babel/plugin-proposal-decorators'],
        
        // uses the jsx loader for .jsx files
        loader: path => {
          if (extname(path) === '.jsx') {
            return 'jsx';
          }
        },
    }
})
```

## License

Library is under [MIT License](LICENSE)
