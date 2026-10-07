// Собирает приложение и выкладывает dist/ в ветку gh-pages (GitHub Pages).
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd });

run('npm test');
run('npm run build');

const remote = execSync('git remote get-url origin').toString().trim();
const sha = execSync('git rev-parse --short HEAD').toString().trim();
const dir = mkdtempSync(join(tmpdir(), 'gh-pages-'));
try {
  run('git init -q -b gh-pages', dir);
  for (const f of readdirSync('dist')) cpSync(join('dist', f), join(dir, f), { recursive: true });
  writeFileSync(join(dir, '.nojekyll'), '');
  run('git add -A', dir);
  run(`git commit -q -m "Deploy ${sha}"`, dir);
  run(`git push -f ${remote} gh-pages`, dir);
  console.log('\nГотово: https://arturfeoktystov.github.io/goaltracker/ (обновится через ~1 минуту)');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
