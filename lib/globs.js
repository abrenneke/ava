'use strict';
const path = require('path');
const globby = require('globby');
const ignoreByDefault = require('ignore-by-default');
const micromatch = require('micromatch');
const slash = require('slash');

const defaultIgnorePatterns = [...ignoreByDefault.directories(), '**/node_modules'];
const defaultMicromatchIgnorePatterns = [
	...defaultIgnorePatterns,
	// Unlike globby(), micromatch needs a complete pattern when ignoring directories.
	...defaultIgnorePatterns.map(pattern => `${pattern}/**/*`)
];

const defaultIgnoredByWatcherPatterns = [
	'**/*.snap.md', // No need to rerun tests when the Markdown files change.
	'ava.config.js' // Config is not reloaded so avoid rerunning tests when it changes.
];

const buildExtensionPattern = extensions => extensions.length === 1 ? extensions[0] : `{${extensions.join(',')}}`;

function normalizePatterns(patterns) {
	// Always use `/` in patterns, harmonizing matching across platforms
	if (process.platform === 'win32') {
		patterns = patterns.map(pattern => slash(pattern));
	}

	return patterns.map(pattern => {
		if (pattern.startsWith('./')) {
			return pattern.slice(2);
		}

		if (pattern.startsWith('!./')) {
			return `!${pattern.slice(3)}`;
		}

		return pattern;
	});
}

exports.normalizePatterns = normalizePatterns;

function normalizeGlobs({extensions, files: filePatterns, ignoredByWatcher: ignoredByWatcherPatterns}) {
	if (filePatterns !== undefined && (!Array.isArray(filePatterns) || filePatterns.length === 0)) {
		throw new Error('The \'files\' configuration must be an array containing glob patterns.');
	}

	if (ignoredByWatcherPatterns !== undefined && (!Array.isArray(ignoredByWatcherPatterns) || ignoredByWatcherPatterns.length === 0)) {
		throw new Error('The \'ignoredByWatcher\' configuration must be an array containing glob patterns.');
	}

	const extensionPattern = buildExtensionPattern(extensions);
	const defaultTestPatterns = [
		`**/__tests__/**/*.${extensionPattern}`,
		`**/*.spec.${extensionPattern}`,
		`**/*.test.${extensionPattern}`,
		`**/test-*.${extensionPattern}`,
		`**/test.${extensionPattern}`,
		`**/test/**/*.${extensionPattern}`,
		`**/tests/**/*.${extensionPattern}`
	];

	if (filePatterns) {
		filePatterns = normalizePatterns(filePatterns);

		if (filePatterns.every(pattern => pattern.startsWith('!'))) {
			// Use defaults if patterns only contains exclusions.
			filePatterns = [...defaultTestPatterns, ...filePatterns];
		}
	} else {
		filePatterns = defaultTestPatterns;
	}

	if (ignoredByWatcherPatterns) {
		ignoredByWatcherPatterns = [...defaultIgnoredByWatcherPatterns, ...normalizePatterns(ignoredByWatcherPatterns)];
	} else {
		ignoredByWatcherPatterns = [...defaultIgnoredByWatcherPatterns];
	}

	return {extensions, filePatterns, ignoredByWatcherPatterns};
}

exports.normalizeGlobs = normalizeGlobs;

const hasExtension = (extensions, file) => extensions.includes(path.extname(file).slice(1));

exports.hasExtension = hasExtension;

const globFiles = async (cwd, patterns) => {
	const files = await globby(patterns, {
		absolute: true,
		braceExpansion: true,
		caseSensitiveMatch: false,
		cwd,
		dot: false,
		expandDirectories: false,
		extglob: true,
		followSymbolicLinks: true,
		gitignore: false,
		globstar: true,
		ignore: defaultIgnorePatterns,
		baseNameMatch: false,
		onlyFiles: true,
		stats: false,
		unique: true
	});

	// `globby` returns slashes even on Windows. Normalize here so the file
	// paths are consistently platform-accurate as tests are run.
	if (process.platform === 'win32') {
		return files.map(file => path.normalize(file));
	}

	return files;
};

async function findFiles({cwd, extensions, filePatterns}) {
	return (await globFiles(cwd, filePatterns)).filter(file => hasExtension(extensions, file));
}

exports.findFiles = findFiles;

async function findTests({cwd, extensions, filePatterns}) {
	return (await findFiles({cwd, extensions, filePatterns})).filter(file => !path.basename(file).startsWith('_'));
}

exports.findTests = findTests;

function getChokidarIgnorePatterns({ignoredByWatcherPatterns}) {
	return [
		...defaultIgnorePatterns.map(pattern => `${pattern}/**/*`),
		...ignoredByWatcherPatterns.filter(pattern => !pattern.startsWith('!'))
	];
}

exports.getChokidarIgnorePatterns = getChokidarIgnorePatterns;

const matchingCache = new WeakMap();
const processMatchingPatterns = input => {
	let result = matchingCache.get(input);
	if (!result) {
		const ignore = [...defaultMicromatchIgnorePatterns];
		const patterns = input.filter(pattern => {
			if (pattern.startsWith('!')) {
				// Unlike globby(), micromatch needs a complete pattern when ignoring directories.
				ignore.push(pattern.slice(1), `${pattern.slice(1)}/**/*`);
				return false;
			}

			return true;
		});

		result = {patterns, ignore};
		matchingCache.set(input, result);
	}

	return result;
};

function matches(file, patterns) {
	let ignore;
	({patterns, ignore} = processMatchingPatterns(patterns));
	return micromatch.some(file, patterns, {ignore});
}

exports.matches = matches;

const matchesIgnorePatterns = (file, patterns) => {
	({patterns} = processMatchingPatterns(patterns));
	return micromatch.some(file, [...patterns, ...defaultMicromatchIgnorePatterns]);
};

function normalizeFileForMatching(cwd, file) {
	if (process.platform === 'win32') {
		cwd = slash(cwd);
		file = slash(file);
	}

	if (!cwd) { // TODO: Ensure tests provide an actual value.
		return file;
	}

	// TODO: If `file` is outside `cwd` we can't normalize it. Need to figure
	// out if that's a real-world scenario, but we may have to ensure the file
	// isn't even selected.
	if (!file.startsWith(cwd)) {
		return file;
	}

	// Assume `cwd` does *not* end in a slash.
	return file.slice(cwd.length + 1);
}

exports.normalizeFileForMatching = normalizeFileForMatching;

function classify(file, {cwd, extensions, filePatterns, ignoredByWatcherPatterns}) {
	file = normalizeFileForMatching(cwd, file);
	return {
		isIgnoredByWatcher: matchesIgnorePatterns(file, ignoredByWatcherPatterns),
		isTest: hasExtension(extensions, file) && !path.basename(file).startsWith('_') && filePatterns.length > 0 && matches(file, filePatterns)
	};
}

exports.classify = classify;
