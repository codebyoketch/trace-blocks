#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
cd traceblocks
python manage.py collectstatic --no-input
python manage.py migrate