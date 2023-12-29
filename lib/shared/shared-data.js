class ExtensionContext {
  constructor () {
    this.usedLanguages = new Set()
    this.logger = undefined
    this.languageToLocationDataMap = {}
    this.config = null
  }

  registerUsedLanguage (language, locationData) {
    if (!this.languageToLocationDataMap[language]) {
      this.languageToLocationDataMap[language] = []
    }
    this.languageToLocationDataMap[language].push(locationData)
    this.usedLanguages.add(language)
  }

  registerUsedLanguages (languages, locationData) {
    languages.forEach((lang) => this.registerUsedLanguage(lang, locationData))
  }

  getUsedLanguagesSortedString () {
    const sortedLanguages = Array.from(this.usedLanguages).sort()
    return sortedLanguages.join(', ')
  }

  clear () {
    this.usedLanguages = new Set()
    this.logger = undefined
    this.languageToLocationDataMap = {}
    this.config = null
  }
}

module.exports = ExtensionContext
