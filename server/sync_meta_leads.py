#!/usr/bin/env python3
"""
Sync missing leads from Meta Graph API to CRM database.
Fetches leads from all active leadgen forms and inserts any that are missing from the CRM.
"""
import json
import re
import sys
import requests
import mysql.connector

# Database config
DB_CONFIG = {
    'host': 'localhost',
    'user': 'tamiyouz',
    'password': 'TamiyouzDB@2025',
    'database': 'tamiyouz_crm',
}

GRAPH_API_BASE = "https://graph.facebook.com/v21.0"

def normalize_saudi_phone(phone):
    """Normalize Saudi phone numbers to +966XXXXXXXXX format."""
    if not phone:
        return None
    phone = re.sub(r'[\s\-\(\)]', '', phone.strip())
    if phone.startswith('+'):
        return phone
    if phone.startswith('00'):
        return '+' + phone[2:]
    if phone.startswith('05') and len(phone) == 10:
        return '+966' + phone[1:]
    if phone.startswith('5') and len(phone) == 9:
        return '+966' + phone
    if phone.startswith('966'):
        return '+' + phone
    return phone

def get_config(cursor):
    """Get the meta_leadgen_config."""
    cursor.execute("""
        SELECT id, page_id, page_name, page_access_token, is_enabled, 
               assignment_rule, fixed_owner_id, field_mapping
        FROM meta_leadgen_config 
        WHERE is_enabled = 1
    """)
    rows = cursor.fetchall()
    configs = []
    for row in rows:
        configs.append({
            'id': row[0],
            'page_id': row[1],
            'page_name': row[2],
            'page_access_token': row[3],
            'is_enabled': row[4],
            'assignment_rule': row[5],
            'fixed_owner_id': row[6],
            'field_mapping': json.loads(row[7]) if row[7] else {},
        })
    return configs

def get_active_agents(cursor):
    """Get active sales agents for round-robin assignment."""
    cursor.execute("""
        SELECT id, name FROM users 
        WHERE role = 'SalesAgent' AND isActive = 1 AND deletedAt IS NULL
        ORDER BY id
    """)
    return cursor.fetchall()

def get_existing_external_ids(cursor):
    """Get all existing externalIds to check for duplicates."""
    cursor.execute("SELECT externalId FROM leads WHERE externalId IS NOT NULL")
    return set(row[0] for row in cursor.fetchall())

def get_existing_phones(cursor):
    """Get all existing phones to check for duplicates."""
    cursor.execute("SELECT phone FROM leads WHERE phone IS NOT NULL AND phone != ''")
    return set(row[0] for row in cursor.fetchall())

def fetch_form_leads(form_id, access_token, limit=100):
    """Fetch leads from a specific form via Graph API."""
    all_leads = []
    url = f"{GRAPH_API_BASE}/{form_id}/leads"
    params = {
        'fields': 'id,created_time,field_data,ad_id,ad_name,form_id,campaign_id,campaign_name',
        'limit': limit,
        'access_token': access_token,
    }
    while url:
        resp = requests.get(url, params=params)
        data = resp.json()
        if 'error' in data:
            print(f"  Error fetching leads from form {form_id}: {data['error'].get('message', 'Unknown error')}")
            break
        all_leads.extend(data.get('data', []))
        paging = data.get('paging', {})
        url = paging.get('next')
        params = {}  # next URL already has params
    return all_leads

def fetch_leadgen_forms(page_id, access_token):
    """Fetch all leadgen forms for a page."""
    url = f"{GRAPH_API_BASE}/{page_id}/leadgen_forms"
    params = {
        'fields': 'id,name,status,created_time',
        'access_token': access_token,
    }
    resp = requests.get(url, params=params)
    data = resp.json()
    if 'error' in data:
        print(f"Error fetching forms: {data['error'].get('message', 'Unknown error')}")
        return []
    return data.get('data', [])

def map_meta_fields(field_data, field_mapping):
    """Map Meta lead fields to CRM fields."""
    by_name = {}
    for field in field_data:
        by_name[field['name']] = field.get('values', [''])[0]
    
    crm_lead = {'name': None, 'phone': None, 'businessProfile': None, 'notes': None}
    custom_fields = {}
    
    for meta_field, value in by_name.items():
        target = field_mapping.get(meta_field)
        if target == 'name':
            crm_lead['name'] = value
        elif target == 'phone':
            crm_lead['phone'] = value
        elif target == 'businessProfile':
            crm_lead['businessProfile'] = value
        elif target == 'notes':
            crm_lead['notes'] = value
        elif target and target.startswith('_customField.'):
            custom_fields[target.replace('_customField.', '')] = value
        else:
            custom_fields[meta_field] = value
    
    # Fallback field detection
    if not crm_lead['name']:
        for key in ['full_name', 'name', 'first_name']:
            if key in by_name:
                crm_lead['name'] = by_name[key]
                break
    if not crm_lead['phone']:
        for key in ['phone_number', 'phone', 'mobile_number']:
            if key in by_name:
                crm_lead['phone'] = by_name[key]
                break
    if not crm_lead['businessProfile']:
        for key in ['company_name', 'company', 'business_name']:
            if key in by_name:
                crm_lead['businessProfile'] = by_name[key]
                break
    if not crm_lead['notes']:
        email = by_name.get('email')
        if email:
            crm_lead['notes'] = f"Email: {email}"
    
    crm_lead['customFieldsData'] = custom_fields
    return crm_lead

def get_lead_count(cursor):
    """Get total lead count for round-robin."""
    cursor.execute("SELECT COUNT(*) FROM leads")
    return cursor.fetchone()[0]

def main():
    print("=" * 60)
    print("Meta Leads Sync - Pulling leads from Graph API to CRM")
    print("=" * 60)
    
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    configs = get_config(cursor)
    if not configs:
        print("No enabled meta_leadgen_config found!")
        return
    
    existing_external_ids = get_existing_external_ids(cursor)
    existing_phones = get_existing_phones(cursor)
    agents = get_active_agents(cursor)
    lead_count = get_lead_count(cursor)
    
    total_imported = 0
    total_skipped = 0
    
    for config in configs:
        print(f"\nProcessing page: {config['page_name']} ({config['page_id']})")
        
        forms = fetch_leadgen_forms(config['page_id'], config['page_access_token'])
        active_forms = [f for f in forms if f.get('status') == 'ACTIVE']
        print(f"  Found {len(active_forms)} active forms")
        
        for form in active_forms:
            form_id = form['id']
            form_name = form.get('name', 'Unknown')
            print(f"\n  Form: {form_name} ({form_id})")
            
            leads_data = fetch_form_leads(form_id, config['page_access_token'])
            print(f"  Fetched {len(leads_data)} leads from Meta")
            
            for lead in leads_data:
                leadgen_id = lead.get('id', '')
                
                # Check if already exists by externalId
                if leadgen_id in existing_external_ids:
                    total_skipped += 1
                    continue
                
                # Map fields
                mapped = map_meta_fields(lead.get('field_data', []), config['field_mapping'])
                normalized_phone = normalize_saudi_phone(mapped['phone'])
                
                # Check if already exists by phone
                if normalized_phone and normalized_phone in existing_phones:
                    total_skipped += 1
                    continue
                
                # Assign owner
                owner_id = None
                if config['assignment_rule'] == 'fixed_owner' and config['fixed_owner_id']:
                    owner_id = config['fixed_owner_id']
                elif config['assignment_rule'] == 'round_robin' and agents:
                    owner_id = agents[(lead_count + total_imported) % len(agents)][0]
                
                # Convert lead time
                lead_time = None
                if lead.get('created_time'):
                    try:
                        from datetime import datetime
                        dt = datetime.fromisoformat(lead['created_time'].replace('+0000', '+00:00'))
                        lead_time = dt.strftime('%Y-%m-%d %H:%M:%S')
                    except:
                        pass
                
                # Build source metadata
                source_metadata = json.dumps({
                    'page_id': config['page_id'],
                    'form_id': lead.get('form_id', form_id),
                    'ad_id': lead.get('ad_id'),
                    'campaign_id': lead.get('campaign_id'),
                    'provider': 'meta_leadgen',
                    'synced_via': 'polling',
                })
                
                custom_fields_json = json.dumps(mapped['customFieldsData']) if mapped['customFieldsData'] else None
                
                try:
                    cursor.execute("""
                        INSERT INTO leads (name, phone, country, businessProfile, leadQuality, 
                                          campaignName, adCreative, ownerId, stage, notes,
                                          externalId, sourceMetadata, customFieldsData, leadTime)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        mapped['name'],
                        normalized_phone,
                        'Saudi Arabia',
                        mapped['businessProfile'],
                        'Unknown',
                        lead.get('campaign_name'),
                        lead.get('ad_name'),
                        owner_id,
                        'New',
                        mapped['notes'],
                        leadgen_id,
                        source_metadata,
                        custom_fields_json,
                        lead_time,
                    ))
                    conn.commit()
                    
                    existing_external_ids.add(leadgen_id)
                    if normalized_phone:
                        existing_phones.add(normalized_phone)
                    total_imported += 1
                    print(f"    + Imported: {mapped['name']} ({normalized_phone}) - {lead.get('campaign_name', 'N/A')}")
                except Exception as e:
                    print(f"    ! Error importing lead {leadgen_id}: {e}")
                    conn.rollback()
    
    # Update last sync info
    if total_imported > 0:
        for config in configs:
            cursor.execute("""
                UPDATE meta_leadgen_config 
                SET last_lead_received_at = NOW(), 
                    total_leads_received = total_leads_received + %s
                WHERE id = %s
            """, (total_imported, config['id']))
        conn.commit()
    
    print(f"\n{'=' * 60}")
    print(f"Sync complete: {total_imported} imported, {total_skipped} skipped (duplicates)")
    print(f"{'=' * 60}")
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
