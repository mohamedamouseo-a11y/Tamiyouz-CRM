const mysql = require('mysql2/promise');

async function debug() {
  const conn = await mysql.createConnection('mysql://tamiyouz:TamiyouzDB@2025@localhost:3306/tamiyouz_crm');

  const [accounts] = await conn.execute('SELECT id, adAccountId, accessToken FROM meta_ad_accounts WHERE isActive = 1 LIMIT 1');
  if (!accounts.length) { console.log('No active account'); await conn.end(); return; }
  const account = accounts[0];
  console.log('Account:', account.adAccountId);

  const [campaigns] = await conn.execute("SELECT campaignId, campaignName FROM meta_campaign_snapshots WHERE campaignName LIKE '%Leads form web design 25%' LIMIT 1");
  if (!campaigns.length) { console.log('Campaign not found'); await conn.end(); return; }
  const campaign = campaigns[0];
  console.log('Campaign:', campaign.campaignName, '|', campaign.campaignId);

  const url = 'https://graph.facebook.com/v21.0/' + campaign.campaignId + '/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type,purchase_roas&date_preset=last_30d&access_token=' + account.accessToken;
  
  const response = await fetch(url);
  const data = await response.json();
  
  console.log('\n=== RAW API RESPONSE ===');
  console.log(JSON.stringify(data, null, 2));
  
  if (data.data && data.data[0]) {
    const insights = data.data[0];
    console.log('\n=== SPEND ===', insights.spend);
    console.log('\n=== ALL ACTIONS ===');
    if (insights.actions) {
      insights.actions.forEach(a => console.log('  ' + a.action_type + ': ' + a.value));
    } else {
      console.log('  No actions found');
    }
    console.log('\n=== COST PER ACTION ===');
    if (insights.cost_per_action_type) {
      insights.cost_per_action_type.forEach(a => console.log('  ' + a.action_type + ': ' + a.value));
    } else {
      console.log('  No cost_per_action_type found');
    }
  } else {
    console.log('No data returned from API');
    console.log(JSON.stringify(data, null, 2));
  }
  
  await conn.end();
}

debug().catch(console.error);
