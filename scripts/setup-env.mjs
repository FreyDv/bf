#!/usr/bin/env node
// Copies every `.env.example` in apps/, packages/ and infra/ to `.env` when the latter is missing.
import { readdirSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['apps', 'packages', 'infra'];
let copied = 0;

function walk(dir, depth = 0) {
  if (depth > 3) return;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.git')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, depth + 1);
    } else if (entry === '.env.example') {
      const target = join(dir, '.env');
      if (!existsSync(target)) {
        copyFileSync(full, target);
        copied += 1;
        console.log(`created ${target}`);
      }
    }
  }
}

for (const root of ROOTS) if (existsSync(root)) walk(root);
console.log(`setup:env done, ${copied} file(s) created`);
