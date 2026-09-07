import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 실행 디렉터리가 달라도 같은 로컬 설정을 읽고, 클라이언트가 전달한 값은 보존한다.
const path = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(path)) process.loadEnvFile(path);
