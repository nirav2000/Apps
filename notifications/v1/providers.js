export function providerStatus(env = {}) {
  return {
    in_app: { configured:true, cost:'free' },
    web_push: { configured:!!(env.ONESIGNAL_APP_ID && env.ONESIGNAL_API_KEY), cost:'provider' },
    email: { configured:!!(env.RESEND_API_KEY && env.NOTIFICATION_FROM_EMAIL), cost:'provider' },
    telegram: { configured:!!env.TELEGRAM_BOT_TOKEN, cost:'provider' },
    whatsapp: { configured:!!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM), cost:'metered' },
    signal: { configured:!!env.SIGNAL_WEBHOOK_URL, cost:'provider' },
    slack: { configured:!!env.SLACK_WEBHOOK_URL, cost:'provider' },
    discord: { configured:!!env.DISCORD_WEBHOOK_URL, cost:'provider' },
    sms: { configured:!!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_SMS_FROM), cost:'metered' },
    ios_push: { configured:!!(env.ONESIGNAL_APP_ID && env.ONESIGNAL_API_KEY), cost:'provider' }
  };
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
    const url = destination.slackWebhookUrl || env.SLACK_WEBHOOK_URL;
    if (!url) return { ok:false, channel, error:'missing-webhook' };
    return { ...(await postJSON(url,{ text })), channel };
  }

  if (channel === 'discord') {
    const url = destination.discordWebhookUrl || env.DISCORD_WEBHOOK_URL;
    if (!url) return { ok:false, channel, error:'missing-webhook' };
    return { ...(await postJSON(url,{ content:text })), channel };
  }

  if (channel === 'signal') {
    const url = destination.signalWebhookUrl || env.SIGNAL_WEBHOOK_URL;
    if (!url) return { ok:false, channel, error:'missing-webhook' };
    return { ...(await postJSON(url,{ text, notification })), channel };
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

  if (channel === 'web_push' || channel === 'ios_push') {
    if (!destination.oneSignalExternalId) return { ok:false, channel, error:'missing-recipient' };
    const result = await postJSON('https://api.onesignal.com/notifications', {
      app_id:env.ONESIGNAL_APP_ID,
      include_aliases:{ external_id:[destination.oneSignalExternalId] },
      target_channel:'push',
      headings:{ en:notification.title || 'Notification' },
      contents:{ en:notification.body || 'Update' },
      url:notification.url || undefined,
      data:{ eventType:notification.type, app:notification.app }
    }, { Authorization:'Key ' + env.ONESIGNAL_API_KEY });
    return { ...result, channel };
  }

  return { ok:false, channel, error:'unsupported-channel' };
}
