
Test0 = require 'test/subdir/Test0'

class Test1 extends Test0

  constructor: ->
    super()
    console.log 'constructor Test1'


module.exports = Test1
