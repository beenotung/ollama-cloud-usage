#!/usr/bin/env node
require('./dist/cli.js').main().catch((error) => {
  console.error(error)
  process.exit(1)
})
