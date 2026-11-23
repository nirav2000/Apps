// Authentication capability detection, scoped to French inside Next.
// iOS Home Screen PWAs use a standalone WebKit context. Google/Firebase
// OAuth popups can strand users in a separate system browser view.
// We do not try to bypass Google/Apple security or move tokens across contexts.
export const AUTH_CONTEXT_VERSION='1.0.0';

export function isIOSStandalone({
  userAgent='',platform='',maxTouchPoints=0,navigatorStandalone=false,
  displayStandalone=false
}={}){
  const appleMobile=/iPhone|iPad|iPod/i.test(String(userAgent))
    ||(platform==='MacIntel'&&Number(maxTouchPoints)>1);
  return !!(appleMobile&&(navigatorStandalone===true||displayStandalone===true));
}

export function browserAuthContext(view=globalThis){
  const nav=view?.navigator||{};
  let displayStandalone=false;
  try{displayStandalone=!!view?.matchMedia?.('(display-mode: standalone)')?.matches;}
  catch{}
  const iosStandalone=isIOSStandalone({
    userAgent:nav.userAgent,platform:nav.platform,maxTouchPoints:nav.maxTouchPoints,
    navigatorStandalone:nav.standalone,displayStandalone
  });
  return {
    iosStandalone,
    allowGooglePopup:!iosStandalone,
    // This information is safe to show; it does not reveal device identity.
    reason:iosStandalone?'ios-home-screen':'ordinary-browser'
  };
}
