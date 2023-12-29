const defaultFailOnUnsupportedLanguage = false
const defaultLanguages = []
const defaultStyle = 'github'
const defaultTreeViewConfig = {
  enabled: true,
  theme: 'default',
}
const defaultLanguageMapping = {
  treeview: {
    name: 'treeview',
    path: 'highlightjs-treeview/dist/js/treeview-default',
  },
}
const defaultAlias = {
  plaintext: ['txt', 'text'],
  shell: ['bash', 'sh', 'console'],
  javascript: ['js'],
}

function validateConfig (config, packageName, logger) {
  const {
    failOnUnsupportedLanguage = defaultFailOnUnsupportedLanguage,
    languages = defaultLanguages,
    style = defaultStyle,
    treeview = defaultTreeViewConfig,
    alias = defaultAlias,
    languageMapping = defaultLanguageMapping,
    ...unknownOptions
  } = config

  if (Object.keys(unknownOptions).length) {
    const unrecognizedOptions = Object.keys(unknownOptions).join(', ')
    throw new Error(`Unrecognized options specified for ${packageName}: ${unrecognizedOptions}`)
  }

  const {
    enabled = defaultTreeViewConfig.enabled,
    theme = defaultTreeViewConfig.theme,
    ...unknownTreeViewOptions
  } = treeview

  if (Object.keys(unknownTreeViewOptions).length) {
    const unrecognizedTreeViewOptions = Object.keys(unknownTreeViewOptions).join(', ')
    throw new Error(`Unrecognized options specified for ${packageName}: ${unrecognizedTreeViewOptions}`)
  }

  if (treeview.enabled) {
    const themePath = `highlightjs-treeview/dist/js/treeview-${treeview.theme}`

    languageMapping.treeview = {
      name: 'treeview',
      path: themePath,
    }
  }

  logger.info('Registering highlight.js extension')
  logger.info(`Supported languages: ${languages.join(', ')}`)

  const validatedConfig = {
    failOnUnsupportedLanguage,
    languages,
    style,
    alias: mergeAndValidate(defaultAlias, alias),
    languageMapping,
    treeview: {
      enabled,
      theme,
    },
  }

  return validatedConfig
}

function mergeAndValidate (defaultAlias, incomingAlias) {
  const mergedAlias = {}
  const valueToKeysMap = {} // Map to track which keys use each value

  // Combine the keys from both defaultAlias and incomingAlias
  const allKeys = new Set([...Object.keys(defaultAlias), ...Object.keys(incomingAlias)])

  allKeys.forEach((key) => {
    const defaultValues = defaultAlias[key] || []
    let incomingValues = incomingAlias[key] || []

    // Normalize incomingValues to always be an array
    if (typeof incomingValues === 'string') {
      incomingValues = [incomingValues]
    }

    // Merge the values and convert to a Set to remove duplicates
    const mergedValues = new Set([...defaultValues, ...incomingValues])

    // Update valueToKeysMap
    mergedValues.forEach((value) => {
      if (!valueToKeysMap[value]) {
        valueToKeysMap[value] = new Set()
      }
      valueToKeysMap[value].add(key)
    })

    mergedAlias[key] = Array.from(mergedValues).sort()
  })

  // Check for values used in multiple keys and throw an error if found
  for (const value in valueToKeysMap) {
    if (valueToKeysMap[value].size > 1) {
      throw new Error(`Value '${value}' is used in multiple keys: ${Array.from(valueToKeysMap[value]).join(', ')}`)
    }
  }

  return mergedAlias
}

module.exports = validateConfig
