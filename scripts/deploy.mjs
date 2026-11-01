// Собирает приложение и выкладывает папку dist в ветку gh-pages (GitHub Pages).
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const run = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd });
const out = (cmd) => execSync(cmd).toString().trim();

const remote = out('git remote get-url origin');
run('npx vite build');
writeFileSync('dist/.nojekyll', '');

run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run(`git -c user.name="${out('git config user.name')}" -c user.email="${out('git config user.email')}" commit -q -m "deploy ${new Date().toISOString()}"`, 'dist');
run(`git push -f -q ${remote} gh-pages`, 'dist');
console.log('\n✓ Выложено. Через минуту обновится на GitHub Pages.');
