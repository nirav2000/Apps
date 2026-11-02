// Shared, app-neutral icon artwork for PWA onboarding.
// SVG is the editable master; the onboarding CLI rasterises it for iOS/Android.
export const ICON_CONCEPTS = Object.freeze([
  {id:'insight-book', label:'Insight book', description:'An open book and a spark of understanding.'},
  {id:'open-pages', label:'Open pages', description:'Two growing pages connected by a spine.'},
  {id:'learning-path', label:'Learning path', description:'A connected sequence from question to answer.'},
  {id:'pencil-notes', label:'Pencil & notes', description:'Writing and improving ideas.'},
  {id:'constellation', label:'Concept constellation', description:'Connections between ideas.'},
  {id:'monogram', label:'Initials', description:'Simple, recognisable app initials.'}
]);
const foreground={
  'insight-book': `
    <path d="M105 178 Q172 153 251 196 L251 374 Q177 335 106 360 Z" fill="#f3faff"/>
    <path d="M261 196 Q334 153 407 178 L406 360 Q330 335 261 374 Z" fill="#d3f5f2"/>
    <path d="M256 198 V379" stroke="#44bfbc" stroke-width="13" stroke-linecap="round"/>
    <path d="M130 215 Q177 200 225 226 M130 252 Q178 237 225 263 M286 224 Q331 199 373 213 M286 260 Q331 236 373 247" stroke="#2b6081" stroke-width="9" opacity=".36" fill="none" stroke-linecap="round"/>
    <path d="M345 80 L356 113 L389 125 L356 137 L345 170 L333 137 L300 125 L333 113 Z" fill="#ffcf70"/>
  `,
  'open-pages': `
    <path d="M113 154 Q176 122 249 177 V371 Q174 331 113 354 Z" fill="#f4ffff"/>
    <path d="M263 177 Q342 127 400 154 V354 Q339 330 263 371 Z" fill="#9de5df"/>
    <path d="M256 182 V376" stroke="#f5c76a" stroke-width="13" stroke-linecap="round"/>
    <path d="M145 207 Q186 191 226 211 M145 244 Q186 227 226 249 M287 212 Q332 193 371 208 M287 249 Q332 229 371 244" fill="none" stroke="#265778" stroke-width="10" opacity=".42" stroke-linecap="round"/>
  `,
  'learning-path': `
    <path d="M115 338 Q157 338 179 278 T275 231 T385 148" fill="none" stroke="#e2faf5" stroke-width="24" stroke-linecap="round"/>
    <circle cx="116" cy="338" r="36" fill="#ffd37d"/>
    <circle cx="256" cy="238" r="37" fill="#9df1e9"/>
    <circle cx="386" cy="148" r="38" fill="#fff"/>
    <path d="M369 149 L382 164 L402 132" fill="none" stroke="#16726c" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  'pencil-notes': `
    <rect x="116" y="114" width="273" height="287" rx="28" fill="#f5ffff"/>
    <path d="M153 174 H276 M153 214 H274 M153 254 H235 M153 294 H227" stroke="#6ba9ad" stroke-width="14" stroke-linecap="round"/>
    <g transform="rotate(37 328 300)"><rect x="302" y="168" width="55" height="183" rx="13" fill="#fbd176"/><rect x="302" y="168" width="55" height="31" rx="11" fill="#4ac4b4"/><path d="M302 343 H357 L330 385 Z" fill="#f0bd9c"/><path d="M322 371 H339 L330 391 Z" fill="#23415a"/></g>
  `,
  'constellation': `
    <g stroke="#9de8e0" stroke-width="13" stroke-linecap="round"><path d="M131 302 L215 158 L340 186 L386 320 L247 369 L131 302 L340 186"/></g>
    <circle cx="131" cy="302" r="28" fill="#fbd176"/><circle cx="215" cy="158" r="30" fill="#fff"/><circle cx="340" cy="186" r="30" fill="#7be5d9"/><circle cx="386" cy="320" r="30" fill="#fff"/><circle cx="247" cy="369" r="29" fill="#fbd176"/>
  `,
  'monogram': `
    <rect x="106" y="116" width="300" height="279" rx="45" fill="#f4ffff" opacity=".13"/>
    <text x="256" y="319" font-size="172" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" fill="#f4ffff" letter-spacing="-10">IC</text>
    <path d="M351 99 L361 127 L389 137 L361 147 L351 175 L341 147 L313 137 L341 127 Z" fill="#ffcf70"/>
  `
};
export function iconSvg({concept='insight-book',background='#102a43',accent='#1a6674',maskable=false}={}){
  if(!Object.hasOwn(foreground,concept))throw new Error('Unknown icon concept: '+concept);
  // Keep all essential artwork inside the central maskable-safe area.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="App icon">
<defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs>
<rect width="512" height="512" fill="url(#bg)"/>
<circle cx="85" cy="69" r="160" fill="#7de7d9" opacity=".055"/><circle cx="474" cy="440" r="170" fill="#ffffff" opacity=".045"/>
${maskable?'<g transform="translate(51.2 51.2) scale(.8)">':''}
${foreground[concept]}
${maskable?'</g>':''}
</svg>
`;
}
