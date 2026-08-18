#!/usr/bin/env python3
import argparse
import datetime
import json
import os
import time
import urllib.error
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:3300/api/readyz')
parser.add_argument('--seconds', type=int, default=30)
parser.add_argument('--rate', type=float, default=2.0)
parser.add_argument('--evidence')
parser.add_argument('--scenario', default='continuity')
args = parser.parse_args()

started = time.monotonic()
total = errors = server_errors = 0
while time.monotonic() - started < args.seconds:
    total += 1
    try:
        with urllib.request.urlopen(args.url, timeout=2) as response:
            if response.status >= 500:
                server_errors += 1
                errors += 1
    except urllib.error.HTTPError as error:
        if error.code >= 500:
            server_errors += 1
        errors += 1
    except Exception:
        errors += 1
    time.sleep(1 / args.rate)

result = {
    'event': 'continuity-probe',
    'scenario': args.scenario,
    'total': total,
    'errors': errors,
    'serverErrors': server_errors,
    'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
}
if args.evidence:
    os.makedirs(os.path.dirname(os.path.abspath(args.evidence)), exist_ok=True)
    with open(args.evidence, 'a', encoding='utf-8') as evidence:
        evidence.write(json.dumps(result, ensure_ascii=False) + '\n')
print(json.dumps(result))
raise SystemExit(0 if errors == 0 else 1)
