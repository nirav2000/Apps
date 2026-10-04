import fs from 'node:fs';

const registry=JSON.parse(fs.readFileSync(new URL('./registry.json',import.meta.url),'utf8'));
const outputs={
  'app-monitor':'app-monitor.webmanifest',
  'pwa-lab':'lab.webmanifest'
};
function manifest(app){
  return {
    name:app.name,
    short_name:app.short_name,
    id:app.id||app.start_url,
    start_url:app.start_url,
    scope:app.scope,
    display:app.display||'standalone',
    background_color:app.background_color||'#ffffff',
    theme_color:app.theme_color||'#ffffff',
    ...(app.description?{description:app.description}:{}),
    icons:app.icons||[]
  };
}
let failed=false;
for(const [id,file] of Object.entries(outputs)){
  const app=registry.apps?.[id];
  if(!app)throw new Error('Registry missing '+id);
  const expected=JSON.stringify(manifest(app),null,2)+'\n';
  const url=new URL('./'+file,import.meta.url);
  if(process.argv.includes('--check')){
    const actual=fs.readFileSync(url,'utf8');
    if(actual!==expected){console.error(file+' is not generated from registry.json');failed=true}
  }else{
    fs.writeFileSync(url,expected);
    console.log('Wrote '+file);
  }
}
if(failed)process.exit(1);
