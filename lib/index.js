'use strict'

const fs = require('fs')
const { promises: fsp } = fs
const ospath = require('path')
const { name: packageName } = require('../package.json')
const LazyReadable = require('./lazy-readable')
const ExtensionContext = require('./shared/shared-data')
const highlighjsBundleGenerator = require('./generator/highlightjs-bundle-generator')
const highlighjsCssGenerator = require('./generator/highlightjs-css-generator')
const highlighjsStylesHbsGenerator = require('./generator/highlightjs-styles-hbs-generator')
const registerExtensions = require('./asciidoctor-extensions/register-extensions')
const bundler = require('./bundler')
const validateConfig = require('./validate-config')

function register ({ config, playbook }) {
  const logger = this.getLogger(packageName)

  const extensionContext = new ExtensionContext()
  extensionContext.logger = logger

  const validatedConfig = validateConfig(config, packageName, logger)
  extensionContext.config = validatedConfig

  registerExtensions(playbook, logger, extensionContext)

  this.on('documentsConverted', async ({ playbook, uiCatalog }) => {
    const { uiOutputDir, cacheDir } = getDirectories(playbook)
    extensionContext.playbook = playbook
    extensionContext.uiCatalog = uiCatalog
    extensionContext.uiOutputDir = uiOutputDir
    extensionContext.cacheDir = cacheDir
    extensionContext.extensionCacheDir = ospath.join(cacheDir, '..', packageName)

    logger.info(`Found languages for highlight.js: ${extensionContext.getUsedLanguagesSortedString()}`)

    await processHighlightJs(extensionContext)
  })
}

async function processHighlightJs (extensionContext) {
  const { extensionCacheDir, logger } = extensionContext

  createFolder(ospath.join(extensionCacheDir, 'css'), logger)
  createFolder(ospath.join(extensionCacheDir, 'partials'), logger)
  createFolder(ospath.join(extensionCacheDir, 'js/vendor'), logger)

  const generatedCssResult = await generateStyleCss(extensionContext)
  await generateStyleHbsFiles(extensionContext, generatedCssResult)
  await copyTreeViewStyleCss(extensionContext)
  await generateHighlightJsScript(extensionContext)
  await copyPartialFiles(extensionContext, 'scripts')
}

async function generateStyleHbsFiles (extensionContext, generatedCssResult) {
  const { uiCatalog, uiOutputDir, logger } = extensionContext

  const {
    filePath,
    basePath,
    contents,
  } = await highlighjsStylesHbsGenerator.generate(extensionContext, generatedCssResult)

  if (uiCatalog.findByType('partial').some(({ path }) => path === basePath)) return

  logger.info(`Copying ${filePath} to ${uiOutputDir}`)
  // logger.info(contents)
  uiCatalog.addFile({
    contents,
    path: basePath,
    stem: 'highlightjs-styles',
    type: 'partial',
  })
}

async function copyPartialFiles (extensionContext, type) {
  const { uiCatalog, uiOutputDir, logger } = extensionContext
  const basePath = `partials/highlightjs-${type}.hbs`

  if (uiCatalog.findByType('partial').some(({ path }) => path === basePath)) return

  const filePath = ospath.join(__dirname, '../data', basePath)
  logger.info(`Copying ${filePath} to ${uiOutputDir}`)
  const contents = Buffer.from(await fsp.readFile(filePath, 'utf8'))

  uiCatalog.addFile({
    contents,
    path: basePath,
    stem: `highlightjs-${type}`,
    type: 'partial',
  })
}

async function generateHighlightJsScript (extensionContext) {
  const { uiCatalog, uiOutputDir, logger, extensionCacheDir } = extensionContext
  const jsVendorDir = 'js/vendor'
  const basename = 'highlight.js'

  const generatedDir = ospath.join(extensionCacheDir, jsVendorDir)
  const generatedFilePath = ospath.join(generatedDir, basename)
  createFolder(generatedDir, logger)

  const generatedBundleFile = ospath.join(generatedDir, 'highlight.bundle.js')

  highlighjsBundleGenerator.generate(extensionContext, generatedBundleFile)

  bundler.bundleFile(generatedBundleFile, generatedFilePath, extensionContext)
  const contents = new LazyReadable(() => fs.createReadStream(generatedFilePath))

  assetFile(uiCatalog, logger, uiOutputDir, jsVendorDir, basename, undefined, contents, true)
}

async function generateStyleCss (extensionContext) {
  const { uiCatalog, uiOutputDir, logger, extensionCacheDir } = extensionContext
  const cssDir = 'css'

  const generatedDir = ospath.join(extensionCacheDir, cssDir)
  createFolder(generatedDir, logger)

  const cssGeneratorResult = await highlighjsCssGenerator.generate(extensionContext)
  const { style, styleExtension } = cssGeneratorResult

  if (style.source === 'highlight.js') {
    const contents = new LazyReadable(() => fs.createReadStream(style.sourcePath))
    assetFile(uiCatalog, logger, uiOutputDir, cssDir, style.basename, style.targetPath, contents, true)
  } else if (style.source === 'uiCatalog') {
    // do nothing => already existing
  }

  const generatedContents = new LazyReadable(() => fs.createReadStream(styleExtension.sourcePath))

  assetFile(
    uiCatalog,
    logger,
    uiOutputDir,
    cssDir,
    styleExtension.basename,
    styleExtension.targetPath,
    generatedContents,
    true
  )

  return cssGeneratorResult
}

function copyTreeViewStyleCss (extensionContext) {
  const { uiCatalog, uiOutputDir, logger, config: { treeview: { theme } } } = extensionContext

  const basename = 'highlightjs-treeview.css'
  const contents = new LazyReadable(() => fs.createReadStream(require.resolve(`highlightjs-treeview/treeview-${theme}-css`)))
  const cssDir = 'css'
  assetFile(uiCatalog, logger, uiOutputDir, cssDir, basename, cssDir + '/' + basename, contents)
}

function assetFile (
  uiCatalog,
  logger,
  uiOutputDir,
  assetDir,
  basename,
  assetPath = assetDir + '/' + basename,
  contents = new LazyReadable(() => fs.createReadStream(ospath.join(__dirname, '../data', assetPath))),
  overwrite = false
) {
  const outputDir = uiOutputDir + '/' + assetDir
  const existingFiles = uiCatalog.findByType('asset')
  const existingFile = existingFiles.find(({ path }) => path === assetPath)

  if (existingFile) {
    if (overwrite) {
      logger.warn(`Please remove the following file from your UI since it is managed by ${packageName}: ${assetPath}`)
      existingFile.contents = contents // Assuming existingFile is an object where you can assign contents
      delete existingFile.stat
    } else {
      logger.info(`The following file already exists in your UI: ${assetPath}, skipping`)
    }
  } else {
    logger.info(`Copying ${assetPath} to ${outputDir}`)
    uiCatalog.addFile({
      contents,
      type: 'asset',
      path: assetPath,
      out: { dirname: outputDir, path: outputDir + '/' + basename, basename },
    })
  }
}

function createFolder (folderPath, logger) {
  if (!fs.existsSync(folderPath)) {
    logger.debug('Create folder: ' + folderPath)
    fs.mkdirSync(folderPath, { recursive: true })
  }
}

function getDirectories (playbook) {
  return {
    uiOutputDir: playbook.ui.outputDir,
    cacheDir: playbook.runtime.cacheDir,
  }
}

module.exports = { register }
