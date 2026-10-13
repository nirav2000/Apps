// Resolve review URLs without changing the shared recorder.
import {init as initialise} from './runtime.mjs';
export {VERSION,measure} from './runtime.mjs';
export function init(options={}){return initialise({...options,reviewUrl:new URL(options.reviewUrl||'https://nirav2000.github.io/Apps/diagnostics/',location.href).href});}
