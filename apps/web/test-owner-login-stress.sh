#!/bin/bash

# Test owner login multiple times in sequence to reproduce server error

cd /Users/samujjwal/Development/rental/apps/web

for i in {1..10}; do
  echo "=== Login attempt $i ==="
  
  response=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3010/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"owner@test.com","password":"Test123!@#"}')
  
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)
  
  echo "Status: $http_code"
  
  if [ "$http_code" != "200" ] && [ "$http_code" != "201" ]; then
    echo "ERROR Response:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  else
    echo "Success"
  fi
  
  echo ""
  sleep 0.5
done
