let extensionContext = {}
let logger = null

// Function to set SharedData from outside
function setExtensionContext (newExtensionContext) {
  if (!newExtensionContext || !newExtensionContext.logger || !newExtensionContext.registerUsedLanguages) {
    throw new Error('Invalid shared data object')
  }
  extensionContext = newExtensionContext
  logger = newExtensionContext.logger
}

function searchSourceBlocks (node, languages) {
  if (!node) return

  if (isSourceBlock(node)) {
    addLanguage(languages, node.getAttribute('language'))
  }

  node.blocks?.forEach((block) => searchSourceBlocks(block, languages))
  if (node.context === 'table') {
    node.rows.body.forEach((row) => row.forEach((cell) => searchCellForSourceBlock(cell, languages)))
  }
}

function isSourceBlock (node) {
  return node.context === 'listing' && node.hasAttribute('language')
}

function searchCellForSourceBlock (cell, languages) {
  const sourceBlockPattern = /\[source,([^\]]+)\]/
  const match = cell.text.match(sourceBlockPattern)
  if (match) {
    addLanguage(languages, match[1].trim())
  }
}

function addLanguage (languages, language) {
  languages.add(language.toLowerCase())
}

function createLanguageCollector (context) {
  return function () {
    this.process((document) => processDocument(document, context))
  }
}

function processDocument (document, { file, contentCatalog, config }) {
  const languages = new Set()
  searchSourceBlocks(document, languages)

  if (languages.size > 0) {
    document.setAttribute('source-languages', Array.from(languages).sort().join(','))

    const { path, version, origin, component } = file.src
    const fileID = `${component}:${version || '~'}:${path}`
    const locationData = {
      id: fileID,
      path: path,
      component: component,
      version: version,
      origin: origin,
    }

    extensionContext.registerUsedLanguages(languages, locationData)
    logger.debug(`${fileID} => Used languages: ${Array.from(languages).sort().join(', ')}`)
  }
}

module.exports = {
  register: function register (registry, context = {}) {
    if (!logger) {
      console.warn('Shared data and logger have not been set. The module might not work as expected.')
    }

    logger?.debug('Register treeProcessor (used-language-collector)')
    registry.treeProcessor(createLanguageCollector(context))
    return registry
  },
  setExtensionContext,
}
