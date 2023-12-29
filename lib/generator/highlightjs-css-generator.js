const fs = require('fs')
const path = require('path')
const Handlebars = require('handlebars')
const ospath = require('path')

const TEMPLATE_FILE = path.join(__dirname, './highlightjs-extension.css.hbs')

async function generate ({ logger, uiCatalog, extensionCacheDir, config: { style } }) {
  logger.info(`Generating css content for highlight.js style ${style}`)

  const cssDir = 'css'
  const foundStyle = await findStyle(uiCatalog, logger, cssDir, style)
  logger.debug(`  foundStyle: ${foundStyle.source} -> ${foundStyle.sourcePath || foundStyle.sourceFile.path}`)

  const extractedBackgroundColor = await extractBackgroundColorFromStyle(foundStyle)
  logger.debug(`  Background value for .hljs: ${extractedBackgroundColor}`)

  const generatedFile = await createGeneratedFile(extractedBackgroundColor, extensionCacheDir)

  return {
    style: foundStyle,
    styleExtension: generatedFile,
  }
}

function extractBackgroundColorFromStyle (style) {
  if (style.source === 'highlight.js') {
    return extractBackgroundColorFromHighlightJsStyle(style)
  } else if (style.source === 'uiCatalog') {
    return extractBackgroundColorFromUiCatalogStyle(style)
  }
}

function extractBackgroundColorFromHighlightJsStyle (style) {
  const cssContent = fs.readFileSync(style.sourcePath, 'utf8')
  return extractBackgroundColor(cssContent)
}

function extractBackgroundColorFromUiCatalogStyle (style) {
  const cssContent = Buffer.from(style.sourceFile._contents).toString('utf8')
  return extractBackgroundColor(cssContent)
}

async function createGeneratedFile (backgroundColor, extensionCacheDir) {
  const basename = 'highlightjs-extension.css'
  const generatedDir = ospath.join(extensionCacheDir, 'css')
  const fileToGeneratePath = ospath.join(generatedDir, basename)

  const template = compileTemplate()
  const generatedContent = template({ backgroundColor })

  await fs.promises.writeFile(fileToGeneratePath, generatedContent, 'utf8')
  return {
    basename: basename,
    sourcePath: fileToGeneratePath,
    targetPath: `css/${basename}`,
    source: 'generated',
  }
}

function compileTemplate () {
  const templateContent = fs.readFileSync(TEMPLATE_FILE, 'utf8')
  return Handlebars.compile(templateContent)
}

function extractBackgroundColor (cssContent) {
  const hljsRegex = /\.hljs\s*\{[^}]*\}/
  const backgroundRegex = /background:\s*([^;]+);/

  const hljsSection = cssContent.match(hljsRegex)
  if (!hljsSection) throw new Error('No .hljs class found in the CSS content.')

  const backgroundMatch = hljsSection[0].match(backgroundRegex)
  if (!backgroundMatch) throw new Error('No background property found in .hljs class.')

  return backgroundMatch[1]
}

async function findStyle (uiCatalog, logger, cssDir, style) {
  try {
    logger.debug(`  Search for ${style} in highlight.js/styles/`)
    return {
      basename: style + '.css',
      sourcePath: require.resolve(`highlight.js/styles/${style}.css`),
      targetPath: `${cssDir}/${style}.css`,
      source: 'highlight.js',
    }
  } catch (error) {
    logger.debug(`  Style ${style} not found in highlight.js`)
    logger.debug(`  Search for ${style} in uiCatalog`)

    const foundFile = findAsset(uiCatalog, cssDir, style + '.css')
    if (foundFile) {
      return {
        basename: style + '.css',
        sourceFile: foundFile,
        targetPath: `${cssDir}/${style}.css`,
        source: 'uiCatalog',
      }
    }

    if (!foundFile) {
      throw new Error(`Style ${style} not found in highlight.js/styles/ or in UI catalog`)
    }
  }
}

function findAsset (uiCatalog,
  assetDir,
  basename,
  assetPath = assetDir + '/' + basename) {
  const existingFiles = uiCatalog.findByType('asset')
  return existingFiles.find(({ path }) => path === assetPath)
}

module.exports = { generate }
