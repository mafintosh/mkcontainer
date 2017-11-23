#!/usr/bin/env node

var minimist = require('minimist')
var combine = require('../lib/combine-diffs')
var diff = require('../lib/diff-images')
var mkdirp = require('mkdirp')
var path = require('path')
var fs = require('fs')

var argv = minimist(process.argv.slice(2), {
  alias: {
    out: 'o',
    diff: 'd',
    image: 'i',
  }
})

var diffs = [].concat(argv.diff || [])

if (!argv.image) {
  console.log('--image or -i is required')
  process.exit(1)
}

if (!argv.out) {
  console.log('--out or -o is required')
  process.exit(1)
}

var prev = argv.image + '.prev'

mkdirp(path.dirname(argv.out), function (err) {
  if (err) throw err
  combine(diffs, prev, function (err) {
    if (err) throw err
    diff(prev, argv.image, argv.tmp || argv.out, function (err) {
      if (err) throw err
      if (!argv.tmp) return
      fs.rename(argv.tmp, argv.out, function (err) {
        if (err) throw err
      })
    })
  })
})
