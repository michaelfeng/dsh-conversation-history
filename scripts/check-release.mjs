import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
if (!files.length) throw new Error('No tracked files to check. Stage the intended release files first.');
const forbiddenPath=/(^|\/)(?:node_modules|sessions|cache|\.dsh)(\/|$)|(?:\.env(?:\.|$)|\.(?:db|sqlite|jsonl|pem|key|log)(?:[.-]|$))/i;
const rules=[
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['credential-shaped token', /\b(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16})\b/],
  ['machine-specific home path', /(?:\/Users\/|\/home\/)[A-Za-z0-9_.-]+\//],
  ['credential in URL', /https?:\/\/[^\s/@:]+:[^\s/@]+@/],
];
const failures=[];
for(const path of files){
  if(forbiddenPath.test(path)) failures.push(`${path}: runtime/private file`);
  if(/\.(jpg|png)$/i.test(path))continue; // Images require a separate visual review.
  const text=await readFile(new URL('../'+path,import.meta.url),'utf8');
  for(const [label,pattern] of rules)if(pattern.test(text)) failures.push(`${path}: ${label}`);
}
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
if(pkg.scripts?.postinstall||pkg.scripts?.preinstall)failures.push('Unexpected installation hook');
const patch=await readFile(new URL('../cordis.patch.yml',import.meta.url),'utf8');
if(patch.includes('session-query-sqlite'))failures.push('Bundle changes host global search configuration');
if(failures.length)throw new Error(failures.join('\n'));
console.log(`Release check passed: ${files.length} tracked files; no disallowed runtime files or credential patterns. Review images and Git metadata separately.`);
