import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Windows 셸의 와일드카드 확장 여부에 의존하지 않는다.
const tests = readdirSync(new URL('./test/', import.meta.url)).filter(name => name.endsWith('.test.mjs')).sort().map(name => fileURLToPath(new URL(`./test/${name}`, import.meta.url)));
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...tests], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
