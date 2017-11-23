#!/usr/bin/env node

var minimist = require('minimist')
var combine = require('../lib/combine-diffs')
var mkdirp = require('mkdirp')
var path = require('path')

var argv = minimist(process.argv.slice(2), {
  alias: {
    out: 'o',
    diff: 'd'
  }
})

var diffs = [].concat(argv.diff || [])

if (!argv.out) {
  console.log('--out or -o is required')
  process.exit(1)
}

mkdirp(path.dirname(argv.out), function (err) {
  if (err) throw err
  combine(diffs, argv.out, function (err) {
    if (err) throw err
  })
})
