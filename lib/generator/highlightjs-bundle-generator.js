const fs = require('fs')
const path = require('path')
const Handlebars = require('handlebars')

const TEMPLATE_FILE = './highlightjs.bundle.js.hbs'
const DEFAULT_LANGUAGE_PATH = 'highlight.js/lib/languages'

function generate ({ usedLanguages, languageToLocationDataMap, logger, config }, fileToGenerate) {
  const { failOnUnsupportedLanguage, languageMapping, alias, languages } = config

  const {
    definedLanguages,
    knownLanguages,
    unknownLanguages,
  } = processLanguages(languages, usedLanguages, alias, languageMapping, logger)

  handleUnknownLanguages(unknownLanguages, languageToLocationDataMap, failOnUnsupportedLanguage, logger)
  handleSupportedLanguages(
    languages, knownLanguages, languageToLocationDataMap, failOnUnsupportedLanguage, logger
  )

  const template = compileTemplate(logger)
  const generatedContent = template({ languages: definedLanguages.length > 0 ? definedLanguages : knownLanguages })

  logger.info(`Generating ${fileToGenerate}`)
  fs.writeFileSync(fileToGenerate, generatedContent, 'utf8')
}

function processLanguages (languages, usedLanguages, languageAlias, languageMapping, logger) {
  const definedLanguages = []
  const knownLanguages = []
  const unknownLanguages = new Set()

  languages.forEach((language) => {
    const languageDefinition = getLanguageDefinition(language, languageAlias, languageMapping, logger)
    if (languageDefinition) {
      definedLanguages.push(languageDefinition)
    } else {
      unknownLanguages.add(language)
    }
  })

  usedLanguages.forEach((language) => {
    const languageDefinition = getLanguageDefinition(language, languageAlias, languageMapping, logger)
    if (languageDefinition) {
      knownLanguages.push(languageDefinition)
    } else {
      unknownLanguages.add(language)
    }
  })

  return { definedLanguages, knownLanguages, unknownLanguages }
}

function handleUnknownLanguages (unknownLanguages, languageToLocationDataMap, failOnUnsupportedLanguage, logger) {
  if (unknownLanguages.size > 0) {
    const locations = reportLocationOfUnknownLanguages(unknownLanguages, languageToLocationDataMap)
    const message = `Highlight.js encountered unsupported languages: ${Array.from(unknownLanguages).sort().join(', ')}.
Please verify your source language. If necessary, add an alias to your highlight.js configuration.
${locations}`

    if (failOnUnsupportedLanguage) {
      throw new Error(message)
    }
    logger.warn(message)
  }
}

function handleSupportedLanguages (
  languages,
  knownLanguages,
  languageToLocationDataMap,
  failOnUnsupportedLanguage,
  logger) {
  const unknownSupportedLanguages = knownLanguages
    .filter((language) => !languages.includes(language.name))
    .map((language) => language.name)

  const unknownSupportedLanguagesSet = new Set(unknownSupportedLanguages)

  // in case it is empty we don't need to do anything
  if (languages.length > 0) {
    if (unknownSupportedLanguages.length > 0) {
      const locations = reportLocationOfUnknownLanguages(unknownSupportedLanguagesSet, languageToLocationDataMap)
      const message = `Unsupported languages: ${unknownSupportedLanguages.sort().join(', ')}.
Please verify/update your languages config.
${locations}`

      if (failOnUnsupportedLanguage) {
        throw new Error(message)
      }
      logger.warn(message)
    }
  }
}

function getLanguageDefinition (language, languageAlias, languageMapping, logger) {
  try {
    const resolvedPath = resolveLanguagePath(language)
    return { name: language, path: resolvedPath }
  } catch {
    const alias = findAlias(language, languageAlias)
    if (alias) {
      return getLanguageDefinition(alias, logger)
    }

    const languageDefinition = languageMapping[language]
    if (languageDefinition) {
      logger.info(`Mapped language ${language} to ${languageDefinition.path}`)
      return languageDefinition
    }
  }
  return null
}

function resolveLanguagePath (language) {
  return require.resolve(`${DEFAULT_LANGUAGE_PATH}/${language}`)
}

function compileTemplate (logger) {
  const templatePath = path.join(__dirname, TEMPLATE_FILE)
  const templateContent = fs.readFileSync(templatePath, 'utf8')
  return Handlebars.compile(templateContent)
}

function reportLocationOfUnknownLanguages (unknownLanguages, languageToLocationDataMap) {
  let result = ''
  unknownLanguages.forEach((language) => {
    const locations = languageToLocationDataMap[language] || []
    if (locations.length > 0) {
      result += `Locations of unsupported language '${language}':\n`
      locations.forEach(({ id }) => result += `  ${id}\n`)// eslint-disable-line no-return-assign
    }
  })
  return result
}

function findAlias (language, languageAlias) {
  for (const [alias, languages] of Object.entries(languageAlias)) {
    if (languages.includes(language)) {
      return alias
    }
  }
  return null
}

module.exports = { generate }
