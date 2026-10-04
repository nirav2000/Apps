export const PROVIDER_APPROVAL = Object.freeze({
  in_app:{approved:true,basis:'Built-in; no external service'},
  web_push:{approved:true,basis:'Firebase Cloud Messaging explicitly approved 2026-10-04'},
  ios_push:{approved:false,basis:'Future native push requires separate approval and native app setup'},
  email:{approved:false,basis:'Third-party email provider not yet approved'},
  telegram:{approved:false,basis:'Telegram Bot API not yet approved'},
  whatsapp:{approved:false,basis:'Twilio WhatsApp not yet approved'},
  signal:{approved:false,basis:'Signal bridge not yet approved'},
  slack:{approved:false,basis:'Slack webhook not yet approved'},
  discord:{approved:false,basis:'Discord webhook not yet approved'},
  sms:{approved:false,basis:'Twilio SMS not yet approved'}
});

export const PROVIDER_SETUP = Object.freeze({
  in_app:{
    title:'In-app',
    provider:'Built in',
    summary:'No external provider is required.',
    secrets:[],
    destination:[],
    cost:'free'
  },
  web_push:{
    title:'Browser push',
    provider:'Firebase Cloud Messaging (FCM)',
    providerUrl:'https://console.firebase.google.com/',
    summary:'Configure Firebase Cloud Messaging for a web app. FCM itself is a no-cost Firebase product; the browser needs the public Firebase web config and VAPID key, while the trusted Worker needs Firebase service-account credentials.',
    secrets:['FCM_CLIENT_EMAIL','FCM_PRIVATE_KEY'],
    publicSettings:['FCM_PROJECT_ID','FCM_WEB_API_KEY','FCM_WEB_APP_ID','FCM_MESSAGING_SENDER_ID','FCM_VAPID_KEY'],
    optionalPublicSettings:['FCM_AUTH_DOMAIN'],
    destination:['Grant browser notification permission on each device','Register the device Firebase Installation ID (FID)'],
    cost:'free'
  },
  ios_push:{
    title:'Native mobile push',
    provider:'Firebase Cloud Messaging (FCM)',
    providerUrl:'https://console.firebase.google.com/',
    summary:'Optional future native-app push through FCM. Native Apple push also requires the native app/APNs configuration and is not enabled by the current web setup.',
    secrets:['FCM_PROJECT_ID','FCM_CLIENT_EMAIL','FCM_PRIVATE_KEY'],
    destination:['Native app/device registration'],
    cost:'free'
  },
  email:{
    title:'Email',
    provider:'Resend',
    providerUrl:'https://resend.com/',
    summary:'Create/configure a Resend account and verified sender, then add the API key and sender address.',
    secrets:['RESEND_API_KEY','NOTIFICATION_FROM_EMAIL'],
    destination:['Recipient email address'],
    cost:'provider'
  },
  telegram:{
    title:'Telegram',
    provider:'Telegram Bot API',
    providerUrl:'https://t.me/BotFather',
    summary:'Create a Telegram bot and add its bot token. Each recipient also needs a Telegram chat ID.',
    secrets:['TELEGRAM_BOT_TOKEN'],
    optionalSecrets:['TELEGRAM_CHAT_ID'],
    destination:['Telegram chat ID'],
    cost:'provider'
  },
  whatsapp:{
    title:'WhatsApp',
    provider:'Twilio',
    providerUrl:'https://www.twilio.com/console',
    summary:'Configure Twilio WhatsApp and add the account credentials and WhatsApp sender.',
    secrets:['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_WHATSAPP_FROM'],
    destination:['Recipient WhatsApp number'],
    cost:'metered'
  },
  sms:{
    title:'SMS',
    provider:'Twilio',
    providerUrl:'https://www.twilio.com/console',
    summary:'Configure Twilio SMS and add the account credentials and SMS sender.',
    secrets:['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_SMS_FROM'],
    destination:['Recipient mobile number'],
    cost:'metered'
  },
  slack:{
    title:'Slack',
    provider:'Slack incoming webhook',
    providerUrl:'https://api.slack.com/messaging/webhooks',
    summary:'Create a trusted Slack incoming webhook for the shared notification service.',
    secrets:['SLACK_WEBHOOK_URL'],
    destination:[],
    cost:'provider'
  },
  discord:{
    title:'Discord',
    provider:'Discord webhook',
    providerUrl:'https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks',
    summary:'Create a trusted Discord webhook for the shared notification service.',
    secrets:['DISCORD_WEBHOOK_URL'],
    destination:[],
    cost:'provider'
  },
  signal:{
    title:'Signal',
    provider:'Signal bridge',
    summary:'Provide a trusted server-side Signal bridge/webhook.',
    secrets:['SIGNAL_WEBHOOK_URL'],
    destination:['Signal recipient / phone where required by the bridge'],
    cost:'provider'
  }
});

export function providerStatus(env = {}) {
  const raw={
    in_app:{configured:true,cost:'free'},
    web_push:{configured:!!(env.FCM_PROJECT_ID&&env.FCM_CLIENT_EMAIL&&env.FCM_PRIVATE_KEY&&env.FCM_WEB_API_KEY&&env.FCM_WEB_APP_ID&&env.FCM_MESSAGING_SENDER_ID&&env.FCM_VAPID_KEY),cost:'free'},
    email:{configured:!!(env.RESEND_API_KEY&&env.NOTIFICATION_FROM_EMAIL),cost:'provider'},
    telegram:{configured:!!env.TELEGRAM_BOT_TOKEN,cost:'provider'},
    whatsapp:{configured:!!(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_WHATSAPP_FROM),cost:'metered'},
    signal:{configured:!!env.SIGNAL_WEBHOOK_URL,cost:'provider'},
    slack:{configured:!!env.SLACK_WEBHOOK_URL,cost:'provider'},
    discord:{configured:!!env.DISCORD_WEBHOOK_URL,cost:'provider'},
    sms:{configured:!!(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_SMS_FROM),cost:'metered'},
    ios_push:{configured:false,cost:'free'}
  };
  return Object.fromEntries(Object.entries(raw).map(([key,value])=>[
    key,{...value,approved:PROVIDER_APPROVAL[key]?.approved===true,configured:value.configured&&PROVIDER_APPROVAL[key]?.approved===true,approvalBasis:PROVIDER_APPROVAL[key]?.basis||''}
  ]));
}

let fcmTokenCache={token:'',expiresAt:0};

function base64url(input){
  const bytes=input instanceof Uint8Array?input:new TextEncoder().encode(String(input));
  let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function pemBytes(pem){
  const clean=String(pem||'').replace(/\\n/g,'\n').replace(/-----BEGIN PRIVATE KEY-----/g,'').replace(/-----END PRIVATE KEY-----/g,'').replace(/\s+/g,'');
  const raw=atob(clean),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;
}
async function fcmAccessToken(env){
  const now=Math.floor(Date.now()/1000);
  if(fcmTokenCache.token&&fcmTokenCache.expiresAt>now+90)return fcmTokenCache.token;
  const header=base64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const payload=base64url(JSON.stringify({
    iss:env.FCM_CLIENT_EMAIL,
    scope:'https://www.googleapis.com/auth/firebase.messaging',
    aud:'https://oauth2.googleapis.com/token',
    iat:now,exp:now+3600
  }));
  const unsigned=header+'.'+payload;
  const key=await crypto.subtle.importKey('pkcs8',pemBytes(env.FCM_PRIVATE_KEY),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));
  const assertion=unsigned+'.'+base64url(signature);
  const form=new URLSearchParams({
    grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});
  if(!response.ok)throw new Error('fcm-oauth-'+response.status);
  const data=await response.json();
  fcmTokenCache={token:String(data.access_token||''),expiresAt:now+Number(data.expires_in||3600)};
  if(!fcmTokenCache.token)throw new Error('fcm-oauth-empty-token');
  return fcmTokenCache.token;
}
async function sendFcm(env,notification,destination){
  const fids=[...(Array.isArray(destination.fcmInstallationIds)?destination.fcmInstallationIds:[]),destination.fcmInstallationId]
    .map(x=>String(x||'').trim()).filter(Boolean);
  const unique=[...new Set(fids)];
  if(!unique.length)return{ok:false,error:'missing-recipient'};
  const token=await fcmAccessToken(env);
  const results=[];
  for(const fid of unique){
    const message={
      fid,
      notification:{title:notification.title||'Notification',body:notification.body||'Update'},
      data:{
        eventType:String(notification.type||''),
        app:String(notification.app||''),
        url:String(notification.url||'')
      }
    };
    if(notification.url)message.webpush={fcm_options:{link:String(notification.url)}};
    const response=await fetch('https://fcm.googleapis.com/v1/projects/'+encodeURIComponent(env.FCM_PROJECT_ID)+'/messages:send',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({message})
    });
    results.push({fid,ok:response.ok,status:response.status});
  }
  return{ok:results.some(x=>x.ok),status:results.every(x=>x.ok)?200:207,results};
}

function textFor(notification) {
  return [notification.title, notification.body].filter(Boolean).join('\n');
}

async function postJSON(url, body, headers = {}) {
  const response = await fetch(url, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', ...headers },
    body:JSON.stringify(body)
  });
  return { ok:response.ok, status:response.status };
}

async function twilioMessage(env, { to, from, body }) {
  if (!to || !from) return { ok:false, error:'missing-recipient' };
  const auth = btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN);
  const form = new URLSearchParams({ To:to, From:from, Body:body });
  const response = await fetch(
    'https://api.twilio.com/2010-04-01/Accounts/' + env.TWILIO_ACCOUNT_SID + '/Messages.json',
    { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded', Authorization:'Basic ' + auth }, body:form }
  );
  return { ok:response.ok, status:response.status };
}

export async function deliverNotification(env, channel, notification, destination = {}) {
  const text = textFor(notification) + (notification.url ? '\n' + notification.url : '');

  if (channel === 'in_app') return { ok:true, channel, status:'stored' };

  if (channel === 'email') {
    if (!destination.email) return { ok:false, channel, error:'missing-recipient' };
    const result = await postJSON('https://api.resend.com/emails', {
      from:env.NOTIFICATION_FROM_EMAIL,
      to:[destination.email],
      subject:notification.title || 'Notification',
      text:notification.body || text
    }, { Authorization:'Bearer ' + env.RESEND_API_KEY });
    return { ...result, channel };
  }

  if (channel === 'telegram') {
    const chatId = destination.telegramChatId || env.TELEGRAM_CHAT_ID;
    if (!chatId) return { ok:false, channel, error:'missing-recipient' };
    const result = await postJSON(
      'https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage',
      { chat_id:chatId, text }
    );
    return { ...result, channel };
  }

  if (channel === 'slack') {
    const url = env.SLACK_WEBHOOK_URL;
    if (!url) return { ok:false, channel, error:'missing-webhook' };
    return { ...(await postJSON(url,{ text })), channel };
  }

  if (channel === 'discord') {
    const url = env.DISCORD_WEBHOOK_URL;
    if (!url) return { ok:false, channel, error:'missing-webhook' };
    return { ...(await postJSON(url,{ content:text })), channel };
  }

  if (channel === 'signal') {
    const url = env.SIGNAL_WEBHOOK_URL;
    if (!url) return { ok:false, channel, error:'missing-webhook' };
    return { ...(await postJSON(url,{ text, notification, recipient:destination.signalRecipient||destination.phone||'' })), channel };
  }

  if (channel === 'sms') {
    const result = await twilioMessage(env, {
      to:destination.phone,
      from:env.TWILIO_SMS_FROM,
      body:text
    });
    return { ...result, channel };
  }

  if (channel === 'whatsapp') {
    const withPrefix = value => value && String(value).startsWith('whatsapp:') ? value : ('whatsapp:' + value);
    const result = await twilioMessage(env, {
      to:withPrefix(destination.whatsapp || destination.phone),
      from:withPrefix(env.TWILIO_WHATSAPP_FROM),
      body:text
    });
    return { ...result, channel };
  }

  if (channel === 'web_push') {
    try{return { ...(await sendFcm(env,notification,destination)), channel }}
    catch(error){return {ok:false,channel,error:String(error?.message||error).slice(0,160)}}
  }

  if (channel === 'ios_push') return {ok:false,channel,error:'native-push-not-configured'};

  return { ok:false, channel, error:'unsupported-channel' };
}
