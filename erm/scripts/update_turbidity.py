#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
update_turbidity.py
Scrapes raw water turbidity (ความขุ่น) data from MWA RWC table
and updates data/turbidity_cache.json for ERM dashboard.
"""

import os
import re
import json
import urllib.request
from datetime import datetime

TARGET_STATIONS = [
    {'id': 'S16', 'search_name': 'แควน้อย', 'name': 'แควน้อย'},
    {'id': 'T5',  'search_name': 'แควใหญ่', 'name': 'แควใหญ่'},
    {'id': 'S11', 'search_name': 'แม่กลอง', 'name': 'แม่กลอง'},
    {'id': 'S9',  'search_name': 'ท่าม่วง',  'name': 'ท่าม่วง'},
    {'id': 'S12', 'search_name': 'บางเลน กม.35', 'name': 'บางเลน กม.35'},
    {'id': 'S14', 'search_name': 'คลองตะวันตก กม.14', 'name': 'คลองตะวันตก กม.14'},
]

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_FILE = os.path.join(BASE_DIR, 'data', 'turbidity_cache.json')
URL = 'http://rwc.mwa.co.th/page/home/table.php'


def clean_text(html_fragment):
    """Remove HTML tags and extra whitespace."""
    text = re.sub(r'<[^>]+>', '', html_fragment)
    return text.strip()


def fetch_mwa_table():
    req = urllib.request.Request(
        URL,
        headers={
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0.0.0 Safari/537.36'
            ),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        return res.read().decode('utf-8', errors='ignore')


def parse_table(html):
    rows = re.findall(r'<TR>(.*?)</TR>', html, re.IGNORECASE | re.DOTALL)
    extracted = {}

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    default_time = datetime.now().strftime('%H:%M')
    default_date = datetime.now().strftime('%d/%m/%Y')
    update_time = default_time
    update_date = default_date

    for st in TARGET_STATIONS:
        found = False
        for row in rows:
            # Check for station ID or search name
            if f"id={st['id']}" in row or st['search_name'] in row:
                cols = re.findall(r'<TD.*?>(.*?)</TD>', row, re.IGNORECASE | re.DOTALL)
                if len(cols) >= 7:
                    # Col 0: Station, 1: Dist, 2: Date, 3: Time, 4: pH, 5: Salinity, 6: Turbidity
                    row_date = clean_text(cols[2])
                    row_time = clean_text(cols[3])
                    raw_turb = clean_text(cols[6]) or '-'

                    if row_time:
                        update_time = row_time
                    if row_date:
                        update_date = row_date

                    try:
                        turb_val = float(raw_turb)
                    except (ValueError, TypeError):
                        turb_val = None

                    is_high = (turb_val is not None and turb_val > 100.0)

                    extracted[st['id']] = {
                        'id': st['id'],
                        'name': st['name'],
                        'turbidity': turb_val,
                        'raw_turbidity': raw_turb,
                        'is_high': is_high,
                        'date': row_date,
                        'time': row_time
                    }
                    found = True
                    break

        if not found:
            print(f"[WARN] Station {st['id']} ({st['name']}) not found in table.")
            extracted[st['id']] = {
                'id': st['id'],
                'name': st['name'],
                'turbidity': None,
                'raw_turbidity': '-',
                'is_high': False,
                'date': update_date,
                'time': update_time
            }

    ordered_data = [extracted[st['id']] for st in TARGET_STATIONS]
    result = {
        'status': 'success',
        'source': 'live',
        'date': update_date,
        'time': update_time,
        'updated_at': now_str,
        'data': ordered_data
    }
    return result


def main():
    print(f"[{datetime.now().isoformat()}] Fetching MWA turbidity data from {URL}...")
    try:
        html = fetch_mwa_table()
        if not html or len(html) < 500:
            raise ValueError("HTML response is too short or empty")

        result = parse_table(html)
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=4)

        print(f"[SUCCESS] Updated {CACHE_FILE}")
        print(f"Data Date: {result['date']}, Time: {result['time']}")
        for item in result['data']:
            alert = " [!] HIGH" if item['is_high'] else ""
            print(f" - {item['name']} ({item['id']}): {item['turbidity']} NTU{alert}")

    except Exception as e:
        print(f"[ERROR] Failed to fetch/parse MWA data: {e}")
        if os.path.exists(CACHE_FILE):
            print("[INFO] Existing cache file retained.")
        raise SystemExit(1)


if __name__ == '__main__':
    main()
