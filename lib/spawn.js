var path = require('path')
var proc = require('child_process')

module.exports = function (name, argv) {
  var bootstrap = require(name + '/package.json')
  var bin = path.join(require.resolve(name + '/package.json'), '..', bootstrap.bin[name])

  proc.spawn(bin, argv, {stdio: 'inherit'}).on('exit', code => process.exit(code))
}
