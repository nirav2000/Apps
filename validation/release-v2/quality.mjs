#!/usr/bin/env node
// Shared opt-in static guard. ESLint is installed in the shared validation runner.
import fs from 'node:fs';
import path from 'node:path';
import {Linter} from 'eslint';

const reserved = new Set(['history','location','performance','navigator','document','window','localStorage','sessionStorage','fetch']);
const browserBindingRule = {
 meta:{type:'problem',schema:[],messages:{collision:'Binding "{{name}}" shadows a browser API; rename it and use window.{{name}} for browser access.'}},
 create(context){return {'Program:exit'(){for(const scope of context.sourceCode.scopeManager.scopes)for(const v of scope.variables)if(reserved.has(v.name))for(const d of v.defs)if(d.name)context.report({node:d.name,messageId:'collision',data:{name:v.name}})}}}
};
export function checkSource(source,filename='app.js',browser=true){
 const l=new Linter();
 return l.verify(source,[{files:['**/*.{js,mjs,cjs}'],languageOptions:{ecmaVersion:'latest',sourceType:filename.endsWith('.cjs')?'commonjs':'module'},plugins:{platform:{rules:{'browser-binding':browserBindingRule}}},rules:{
  'no-dupe-args':'error','no-dupe-keys':'error','no-unreachable':'error','no-func-assign':'error','no-import-assign':'error','no-unsafe-finally':'error','valid-typeof':'error','no-global-assign':'error','no-unsafe-optional-chaining':'error',
  ...(browser?{'platform/browser-binding':'error','no-restricted-globals':['error',{name:'history',message:'Use window.history explicitly.'},{name:'event',message:'Pass an explicit event argument.'}]}:{})
 }}],{filename});
}
export function runQuality(root,config={}){
 const include=config.include||[];if(!include.length)throw Error('codeQuality.include must list the app source files to check; no silent skip');
 const issues=[],checked=[];
 for(const file of include){
  if(file.includes('..')||path.isAbsolute(file))throw Error('Unsafe code-quality path: '+file);
  const full=path.join(root,file);if(!fs.existsSync(full))throw Error('Missing code-quality file: '+file);
  const source=fs.readFileSync(full,'utf8');checked.push(file);
  const snippets=file.endsWith('.html')?[...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/\bsrc\s*=/.test(m[1])&&!/type\s*=\s*["'](?:application\/json|application\/ld\+json|importmap)["']/.test(m[1])).map(m=>m[2]):[source];
  for(const snippet of snippets)for(const issue of checkSource(snippet,file.endsWith('.html')?'inline.js':file,!(config.nodeFiles||[]).includes(file)))if(issue.severity===2)issues.push({file,line:issue.line,rule:issue.ruleId,message:issue.message});
 }
 return {checked,issues};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
 const root=path.resolve(process.argv[2]||'.'),config=JSON.parse(fs.readFileSync(path.join(root,process.argv[3]||'validation.config.json'),'utf8'));
 const result=runQuality(root,config.codeQuality);fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
 fs.writeFileSync(path.join(root,'artifacts','code-quality-report.json'),JSON.stringify({status:result.issues.length?'failed':'passed',...result},null,2)+'\n');
 console.log(JSON.stringify(result,null,2));if(result.issues.length)process.exitCode=1;
}
