const browserify = require('browserify')
const fs = require('fs')

function bundleFile (file, outputPath, { logger }) {
  logger.info(`Bundling ${file} to ${outputPath}`)
  // const path = require.resolve(file)

  browserify()
    .plugin('browser-pack-flat/plugin')
    .add(file)
    .transform('@browserify/uglifyify', { global: true })
    .bundle()
    .pipe(fs.createWriteStream(outputPath))
}

module.exports = { bundleFile }
