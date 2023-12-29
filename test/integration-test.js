/* eslint-disable no-unused-expressions */
/* eslint-env mocha */
'use strict'

require('./harness')
const { JSDOM } = require('jsdom')

const chaiAsPromised = require('chai-as-promised')
const chai = require('chai')
chai.use(chaiAsPromised)

const { expect } = chai

const { promises: fsp } = require('fs')
const cheerio = require('cheerio')
const ospath = require('path')

const FIXTURES_DIR = ospath.join(__dirname, 'fixtures')
const WORK_DIR = ospath.join(__dirname, 'work')

const generateSite = require('@antora/site-generator')

const collectCss = (parsedHtml) => {
  const stylesheets = []
  parsedHtml('link[rel="stylesheet"]').each((i, link) => {
    const href = parsedHtml(link).attr('href')
    stylesheets.push(href)
  })
  return stylesheets
}

const collectScripts = (parsedHtml) => {
  const scripts = []
  parsedHtml('script').each((i, script) => {
    if (parsedHtml(script).attr('src')) {
      scripts.push(parsedHtml(script).attr('src'))
    }
  })
  return scripts
}

const createVendorScriptPath = (relPath = '', scriptName) => {
  return `${relPath}_/js/vendor/${scriptName}`
}

const createCssPath = (relPath = '../', cssName) => {
  return `${relPath}_/css/${cssName}`
}

describe('generateSite() - with default values', () => {
  const cacheDir = ospath.join(WORK_DIR, '.cache/antora')
  const outputDir = ospath.join(WORK_DIR, 'public')
  const defaultPlaybookFile = ospath.join(
    FIXTURES_DIR,
    'docs-site/antora-playbook-default.yml'
  )
  const env = {}
  let parsedHtml = null
  let startPageContents = null
  let usedStyleSheets = null
  let usedScripts = null

  before(
    async () => {
      fsp.rm(outputDir, { recursive: true, force: true })
      await generateSite(
        [
          '--playbook',
          defaultPlaybookFile,
          '--to-dir',
          outputDir,
          '--cache-dir',
          cacheDir,
          '--quiet',
        ],
        env
      )

      startPageContents = await fsp.readFile(
        ospath.join(outputDir, 'example/index.html')
      )

      // Load the jsdom-created document into Cheerio
      parsedHtml = cheerio.load(startPageContents)
      usedStyleSheets = collectCss(parsedHtml)
      usedScripts = collectScripts(parsedHtml)
    }
  )
  after(() => {
    // fsp.rm(WORK_DIR, { recursive: true, force: true })
  })

  beforeEach(async () => {
    // Reset global states
    delete global.window
  })

  afterEach(() => {
    // Clean up global states
    delete global.window
  })

  it('should use stylesheet highlightjs-treeview.css', async () => {
    expect(usedStyleSheets).to.include(createCssPath('../', 'highlightjs-treeview.css'))

    const stylesheet = ospath.join(outputDir, createCssPath('', 'highlightjs-treeview.css'))
    expect(stylesheet).to.be.a.file().and.not.empty()
  })

  it('should use stylesheet highlightjs-extension.css', async () => {
    expect(usedStyleSheets).to.include(createCssPath('../', 'highlightjs-extension.css'))

    const stylesheet = ospath.join(outputDir, createCssPath('', 'highlightjs-extension.css'))
    expect(stylesheet).to.be.a.file().and.not.empty()
  })

  it('should use stylesheet github.css as default style', async () => {
    expect(usedStyleSheets).to.include(createCssPath('../', 'github.css'))

    const stylesheet = ospath.join(outputDir, createCssPath('', 'github.css'))
    expect(stylesheet).to.be.a.file().and.not.empty()
  })

  it('should use script highlight.js', () => {
    expect(usedScripts).to.include(createVendorScriptPath('../', 'highlight.js'))
  })

  it('should only have registered the automatic found languages', async () => {
    const scriptFile = ospath.join(outputDir, createVendorScriptPath('', 'highlight.js'))
    expect(scriptFile).to.be.a.file().and.not.empty()

    const dom = await new JSDOM(startPageContents, {
      runScripts: 'dangerously', // Allow scripts to run
      resources: 'usable', // Load external resources
    })
    const window = dom.window
    const document = dom.window.document
    global.window = window
    global.document = document

    // load highlight.js
    require(scriptFile)

    const hljs = global.hljs
    const expectedFoundLanguages = ['asciidoc', 'java', 'javascript', 'plaintext', 'shell', 'treeview', 'xml']
    const foundLanguages = hljs.listLanguages().sort()

    expect(foundLanguages).to.include.members(expectedFoundLanguages)
    expect(foundLanguages).to.have.members(expectedFoundLanguages)

    delete require.cache[require.resolve(scriptFile)]
    delete global.hljs
  })
})

describe('Handling of Supported Languages', () => {
  const cacheDir = ospath.join(WORK_DIR, '.cache/antora')
  const outputDir = ospath.join(WORK_DIR, 'public')

  before(() => fsp.rm(outputDir, { recursive: true, force: true }))
  // after(() => fsp.rm(WORK_DIR, { recursive: true, force: true }))
  beforeEach(async () => {
    // Reset global states
    delete global.window
  })

  afterEach(() => {
    // Clean up global states
    delete global.window
  })

  describe('Automatic language support', () => {
    it('automatic - should fail because language unknown is unsupported (flag=true)', async () => {
      const playbookFile = ospath.join(
        FIXTURES_DIR,
        'docs-site',
        'antora-playbook-fail-on-unknown-languages.yml'
      )
      const env = {}

      await expect(
        generateSite(
          [
            '--playbook',
            playbookFile,
            '--to-dir',
            outputDir,
            '--cache-dir',
            cacheDir,
            '--quiet',
          ],
          env
        )
      ).to.be.rejectedWith('Highlight.js encountered unsupported languages: unknown')
    })

    it('automatic - should not fail when on unsupported language when flag=false', async () => {
      const playbookFile = ospath.join(
        FIXTURES_DIR,
        'docs-site',
        'antora-playbook-not-fail-on-unknown-languages.yml'
      )
      const env = {}

      await generateSite(
        [
          '--playbook',
          playbookFile,
          '--to-dir',
          outputDir,
          '--cache-dir',
          cacheDir,
          '--quiet',
        ],
        env
      )
    })

    it('automatic - should not fail when alias is defined for unknown language', async () => {
      const playbookFile = ospath.join(
        FIXTURES_DIR,
        'docs-site',
        'antora-playbook-set-alias-on-unknown-language.yml'
      )
      const env = {}

      await generateSite(
        [
          '--playbook',
          playbookFile,
          '--to-dir',
          outputDir,
          '--cache-dir',
          cacheDir,
          '--quiet',
        ],
        env
      )
    })

    it('automatic - should fail because language unknown is used in more than one alias', async () => {
      const playbookFile = ospath.join(
        FIXTURES_DIR,
        'docs-site',
        'antora-playbook-fail-on-multimapped-language.yml'
      )
      const env = {}

      await expect(
        generateSite(
          [
            '--playbook',
            playbookFile,
            '--to-dir',
            outputDir,
            '--cache-dir',
            cacheDir,
            '--quiet',
          ],
          env
        )
      ).to.be.rejectedWith('Value \'unknown\' is used in multiple keys: plaintext, xml')
    })
  })

  describe('Explicit language support', () => {
    it('explicit - should fail because language xml is not defined in config', async () => {
      const playbookFile = ospath.join(
        FIXTURES_DIR,
        'docs-site',
        'antora-playbook-fail-configure-supported-languages.yml'
      )
      const env = {}

      await expect(
        generateSite(
          [
            '--playbook',
            playbookFile,
            '--to-dir',
            outputDir,
            '--cache-dir',
            cacheDir,
            '--quiet',
          ],
          env
        )
      ).to.be.rejectedWith('Unsupported languages: xml.')
    })

    it('explicit - should not fail on unsupported languages when flag=false', async () => {
      const playbookFile = ospath.join(
        FIXTURES_DIR,
        'docs-site',
        'antora-playbook-configure-supported-languages.yml'
      )
      const env = {}

      await generateSite(
        [
          '--playbook',
          playbookFile,
          '--to-dir',
          outputDir,
          '--cache-dir',
          cacheDir,
          '--quiet',
        ],
        env
      )
    })

    it('explicit - should only have registered the automatic found languages', async () => {
      const playbookFile = ospath.join(
        FIXTURES_DIR,
        'docs-site',
        'antora-playbook-configure-supported-languages.yml'
      )
      const env = {}

      await generateSite(
        [
          '--playbook',
          playbookFile,
          '--to-dir',
          outputDir,
          '--cache-dir',
          cacheDir,
          '--quiet',
        ],
        env
      )

      const scriptFile = ospath.join(outputDir, createVendorScriptPath('', 'highlight.js'))
      expect(scriptFile).to.be.a.file().and.not.empty()

      const startPageContents = await fsp.readFile(
        ospath.join(outputDir, 'example/index.html')
      )

      const dom = await new JSDOM(startPageContents, {
        runScripts: 'dangerously', // Allow scripts to run
        resources: 'usable', // Load external resources
      })
      const window = dom.window
      const document = dom.window.document
      global.window = window
      global.document = document

      // load highlight.js
      require(scriptFile)
      const hljs = global.hljs

      const expectedFoundLanguages = ['asciidoc', 'java', 'javascript', 'plaintext', 'shell', 'treeview']
      const foundLanguages = hljs.listLanguages().sort()

      expect(foundLanguages).to.include.members(expectedFoundLanguages)
      expect(foundLanguages).to.have.members(expectedFoundLanguages)

      delete require.cache[require.resolve(scriptFile)]
      delete global.hljs
    })
  })
})

describe('Config Handling', () => {
  const cacheDir = ospath.join(WORK_DIR, '.cache/antora')
  const outputDir = ospath.join(WORK_DIR, 'public')

  before(() => fsp.rm(outputDir, { recursive: true, force: true }))
  after(() => fsp.rm(WORK_DIR, { recursive: true, force: true }))

  it('should fail when config is unknown', async () => {
    const playbookFile = ospath.join(
      FIXTURES_DIR,
      'docs-site',
      'antora-playbook-unsupported-config.yml'
    )
    const env = {}

    await expect(
      generateSite(
        [
          '--playbook',
          playbookFile,
          '--to-dir',
          outputDir,
          '--cache-dir',
          cacheDir,
          '--quiet',
        ],
        env
      )
    ).to.be.rejectedWith('Unrecognized options specified for antora-highlightjs-extension: unsupportedConfig')
  })

  it('should fail when treeview config is unknown', async () => {
    const playbookFile = ospath.join(
      FIXTURES_DIR,
      'docs-site',
      'antora-playbook-unsupported-treeview-config'
    )
    const env = {}

    await expect(
      generateSite(
        [
          '--playbook',
          playbookFile,
          '--to-dir',
          outputDir,
          '--cache-dir',
          cacheDir,
          '--quiet',
        ],
        env
      )
    ).to.be.rejectedWith('Unrecognized options specified for antora-highlightjs-extension: unsupportedConfig')
  })
})
