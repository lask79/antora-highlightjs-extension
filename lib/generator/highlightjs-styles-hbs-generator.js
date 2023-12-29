const fs = require('fs')
const { promises: fsp } = fs
const path = require('path')
const Handlebars = require('handlebars')
const ospath = require('path')

const TEMPLATE_FILE = path.join(__dirname, './highlightjs-styles.hbs.hbs')

async function generate ({ logger, extensionCacheDir }, { style }) {
  logger.info('Generating highlightjs-styles.hbs')

  const generatedFilePath = await createGeneratedFile(style.basename, extensionCacheDir)
  return {
    filePath: generatedFilePath,
    basePath: 'partials/highlightjs-styles.hbs',
    contents: Buffer.from(await fsp.readFile(generatedFilePath, 'utf8')),
  }
}

async function createGeneratedFile (styleName, extensionCacheDir) {
  const basename = 'highlightjs-styles.hbs'
  const generatedDir = ospath.join(extensionCacheDir, 'partials')
  const fileToGeneratePath = ospath.join(generatedDir, basename)

  Handlebars.registerHelper('deferred', function (variable) {
    // Returns a placeholder that looks like a Handlebars expression with triple curly brackets
    return new Handlebars.SafeString('{{{' + variable + '}}}')
  })

  const template = compileTemplate()
  const generatedContent = template({ styleName })

  await fs.promises.writeFile(fileToGeneratePath, generatedContent, 'utf8')
  return fileToGeneratePath
}

function compileTemplate () {
  const templateContent = fs.readFileSync(TEMPLATE_FILE, 'utf8')
  return Handlebars.compile(templateContent)
}

module.exports = { generate }
