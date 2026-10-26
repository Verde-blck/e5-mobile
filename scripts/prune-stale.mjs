#!/usr/bin/env node
// Lists the files a new zip didn't replace because they no longer belong to the project, and deletes
// them only with --apply (npm run prune -- --apply). Only src, tests and docs are ever looked at.
import { existsSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCANNED = ['src', 'tests', 'docs']
const MANIFEST = 'zip-manifest.txt'
// A manifest shorter than this is assumed to be damaged, because acting on it would delete real files.
const MIN_ENTRIES = 10

function walk(dir, found = []) {
  if (!existsSync(dir)) return found
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, found)
    else found.push(path)
  }
  return found
}

function removeEmptyDirs(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return
  for (const name of readdirSync(dir)) removeEmptyDirs(join(dir, name))
  if (readdirSync(dir).length === 0) rmdirSync(dir)
}

export function findStale(root, manifestText) {
  const wanted = new Set(manifestText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))
  if (wanted.size < MIN_ENTRIES) throw new Error(`The manifest lists only ${wanted.size} files, which looks damaged. Nothing was touched.`)
  return SCANNED.flatMap((dir) => walk(join(root, dir)))
    .map((path) => relative(root, path).split(sep).join('/'))
    .filter((file) => !wanted.has(file))
    .sort()
}

function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const rootArg = args.indexOf('--root')
  const root = rootArg >= 0 ? resolve(args[rootArg + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const manifestPath = join(root, MANIFEST)
  if (!existsSync(manifestPath)) {
    console.error(`No ${MANIFEST} here, so there is nothing to compare against. Nothing was touched.`)
    process.exit(1)
  }
  let stale
  try {
    stale = findStale(root, readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
  if (stale.length === 0) {
    console.log('No leftover files. The folder matches the zip.')
    return
  }
  console.log(`${stale.length} file${stale.length === 1 ? '' : 's'} no longer belong to the project:`)
  for (const file of stale) console.log(`  ${file}`)
  if (!apply) {
    console.log('\nNothing was deleted. Run again with --apply to delete them:  npm run prune -- --apply')
    return
  }
  for (const file of stale) rmSync(join(root, file))
  for (const dir of SCANNED) removeEmptyDirs(join(root, dir))
  console.log(`\nDeleted ${stale.length}.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
