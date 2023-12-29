const extensions = [
  'antora-highlightjs-extension/used-language-collector',
]

function registerExtensions (playbook, logger, extensionContext) {
  logger.info('Register additional asciidoctor.js extensions')
  // Check if the playbook has an asciidoc section, if not, initialize it
  if (!playbook.asciidoc) {
    playbook.asciidoc = {}
  }

  // Check if the asciidoc section has an extensions array, if not, initialize it
  if (!playbook.asciidoc.extensions) {
    playbook.asciidoc.extensions = []
  }

  // Add the asciidoctor-extensions/converter to the asciidoc extensions
  extensions.forEach((extensionName) => {
    if (!playbook.asciidoc.extensions.includes(extensionName)) {
      playbook.asciidoc.extensions.push(extensionName)
      logger.info(`Added ${extensionName} to asciidoc extensions`)
      const extension = require(extensionName)
      extension.setExtensionContext(extensionContext)
    }
  })
}

module.exports = registerExtensions
