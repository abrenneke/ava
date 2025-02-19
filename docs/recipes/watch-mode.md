# Watch mode

Translations: [Français](https://github.com/avajs/ava-docs/blob/master/fr_FR/docs/recipes/watch-mode.md), [Italiano](https://github.com/avajs/ava-docs/blob/master/it_IT/docs/recipes/watch-mode.md), [Русский](https://github.com/avajs/ava-docs/blob/master/ru_RU/docs/recipes/watch-mode.md), [简体中文](https://github.com/avajs/ava-docs/blob/master/zh_CN/docs/recipes/watch-mode.md)

**This documents the upcoming AVA 3 release. See the [AVA 2](https://github.com/avajs/ava/blob/v2.4.0/docs/recipes/watch-mode.md) documentation instead.**

AVA comes with an intelligent watch mode. It watches for files to change and runs just those tests that are affected.

## Running tests with watch mode enabled

You can enable watch mode using the `--watch` or `-w` flags. If you have installed AVA globally:

```console
$ ava --watch
```

If you've configured it in your `package.json` like this:

```json
{
	"scripts": {
		"test": "ava"
	}
}
```

You can run:

```console
$ npm test -- --watch
```

You could also set up a special script:

```json
{
	"scripts": {
		"test": "ava",
		"watch:test": "ava --watch"
	}
}
```

And then use:

```console
$ npm run watch:test
```

Finally you could configure AVA to *always* run in watch mode by setting the `watch` key in the [`ava` section of your `package.json`, or `ava.config.js` file][config].

**`package.json`:**

```json
{
	"ava": {
		"watch": true
	}
}
```

Please note that the TAP reporter is unavailable when using watch mode.

## Requirements

AVA uses [`chokidar`] as the file watcher. Note that even if you see warnings about optional dependencies failing during install, it will still work fine. Please refer to the *[Install Troubleshooting]* section of `chokidar` documentation for how to resolve the installation problems with chokidar.

## Ignoring changes

By default AVA watches for changes to all files, except for those with a `.snap.md` extension, `ava.config.js` and files in [certain directories](https://github.com/novemberborn/ignore-by-default/blob/master/index.js) as provided by the [`ignore-by-default`] package.

You can configure additional patterns for files to ignore in the [`ava` section of your `package.json`, or `ava.config.js` file][config], using the `ignoredByWatcher` key.

If your tests write to disk they may trigger the watcher to rerun your tests. Configuring additional ignore patterns helps avoid this.

## Dependency tracking

AVA tracks which source files your test files depend on. If you change such a dependency only the test file that depends on it will be rerun. AVA will rerun all tests if it cannot determine which test file depends on the changed source file.

Dependency tracking works for required modules. Custom extensions and transpilers are supported, provided you [added them in your `package.json` or `ava.config.js` file][config], and not from inside your test file. Files accessed using the `fs` module are not tracked.

## Watch mode and the `.only` modifier

The [`.only` modifier] disables watch mode's dependency tracking algorithm. When a change is made, all `.only` tests will be rerun, regardless of whether the test depends on the changed file.

## Watch mode and CI

If you run AVA in your CI with watch mode, the execution will exit with an error (`Error : Watch mode is not available in CI, as it prevents AVA from terminating.`). AVA will not run with the `--watch` (`-w`) option in CI, because CI processes should terminate, and with the `--watch` option, AVA will never terminate.

## Manually rerunning all tests

You can quickly rerun all tests by typing <kbd>r</kbd> on the console, followed by <kbd>Enter</kbd>.

## Updating snapshots

You can update failing snapshots by typing <kbd>u</kbd> on the console, followed by <kbd>Enter</kbd>.

## Debugging

Sometimes watch mode does something surprising like rerunning all tests when you thought only a single test would be run. To see its reasoning you can enable a debug mode. This will work best with the verbose reporter:

```console
$ DEBUG=ava:watcher npm test -- --watch --verbose
```

On Windows use:

```console
$ set DEBUG=ava:watcher
$ npm test -- --watch --verbose
```

## Help us make watch mode better

Watch mode is relatively new and there might be some rough edges. Please [report](https://github.com/avajs/ava/issues) any issues you encounter. Thanks!

[`chokidar`]: https://github.com/paulmillr/chokidar
[Install Troubleshooting]: https://github.com/paulmillr/chokidar#install-troubleshooting
[`ignore-by-default`]: https://github.com/novemberborn/ignore-by-default
[`.only` modifier]: ../01-writing-tests.md#running-specific-tests
[config]: ../06-configuration.md
