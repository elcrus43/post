#!/bin/bash
cd /c/Users/Office-40/post-project
sed -i "s#require(./news-api.cjs)#require('./news-api.cjs')#" backend/server.js
echo "Fixed quotes"
