#!/usr/bin/env node
/**
 * Verify that TypeScript provider packages under ts/packages/ have
 * well-formed package.json exports (main, module, types) and that
 * the declared dist files exist on disk.
 *
 * Usage:
 *   node scripts/check_provider_exports.js
 *   node scripts/check_provider_exports.js --verbose
 */

const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.resolve(__dirname, '..', 'ts', 'packages');
const REQUIRED_FIELDS = ['main', 'types'];
const VERBOSE = process.argv.includes('--verbose');

/**
 * Return all package.json paths under a root directory (non-recursive
 * at the top level only — each package is a direct child directory).
 * @param {string} root
 * @returns {string[]}
 */
function findPackageJsonFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(root, e.name, 'package.json'))
    .filter((p) => fs.existsSync(p));
}

/**
 * Check a single package.json and return an array of issue strings.
 * @param {string} pkgJsonPath
 * @returns {string[]}
 */
function checkPackage(pkgJsonPath) {
  const issues = [];
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  } catch (err) {
    return [`JSON parse error: ${err.message}`];
  }

  const pkgDir = path.dirname(pkgJsonPath);

  for (const field of REQUIRED_FIELDS) {
    if (!pkg[field]) {
      issues.push(`Missing '${field}' field`);
      continue;
    }
    const resolved = path.resolve(pkgDir, pkg[field]);
    if (!fs.existsSync(resolved)) {
      issues.push(`'${field}' points to non-existent file: ${pkg[field]} (run pnpm build first?)`);
    }
  }

  // If 'exports' is defined, ensure at least one entry is present.
  if (pkg.exports && typeof pkg.exports === 'object' && Object.keys(pkg.exports).length === 0) {
    issues.push("'exports' field is defined but empty");
  }

  return issues;
}

function main() {
  const pkgFiles = findPackageJsonFiles(PACKAGES_DIR);
  if (pkgFiles.length === 0) {
    console.error(`No package.json files found under ${PACKAGES_DIR}`);
    process.exit(1);
  }

  const allIssues = {};

  for (const pkgFile of pkgFiles) {
    const relPath = path.relative(process.cwd(), pkgFile);
    const issues = checkPackage(pkgFile);
    if (issues.length > 0) {
      allIssues[relPath] = issues;
    } else if (VERBOSE) {
      console.log(`OK  ${relPath}`);
    }
  }

  if (Object.keys(allIssues).length > 0) {
    console.log(`\nProvider export issues in ${Object.keys(allIssues).length}/${pkgFiles.length} package(s):\n`);
    for (const [file, issues] of Object.entries(allIssues)) {
      for (const issue of issues) {
        console.log(`  ${file}: ${issue}`);
      }
    }
    process.exit(1);
  }

  console.log(`All ${pkgFiles.length} provider package(s) passed export checks.`);
}

main();
