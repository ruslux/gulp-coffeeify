
# require modules
gulp   = require 'gulp'
del    = require 'del'
coffee = require 'gulp-coffee'

# Clean
gulp.task 'clean', (cb)->
  del 'lib', cb

# CoffeeScript
gulp.task 'build', ->
  gulp.src 'src/**/*.coffee'
    .pipe coffee()
    .pipe gulp.dest 'lib'

# Test
gulp.task 'test', ->
  gulp.src 'test/*.coffee'
    .pipe require('./lib/coffeeify')
      aliases:
        { cwd: './test', base: 'test' }
      options:
        debug: true
    .pipe gulp.dest 'test-result'

# Build
gulp.task 'default', ['clean'], ->
  gulp.start 'build'
  gulp.watch ['gulpfile.coffee', 'src/*.*'], ['build']
