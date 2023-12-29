/* eslint-env mocha */
'use strict'

process.env.NODE_ENV = 'test'

const chai = require('chai')
chai.use(require('chai-fs'))
chai.use(require('dirty-chai'))
const { configureLogger } = require(require.resolve('@antora/logger', {
  paths: [require.resolve('@antora/site-generator')],
}))
// const buildContentCatalog = require('./build-content-catalog')

beforeEach(() => configureLogger({ level: 'Error' }))

module.exports = {
  // buildContentCatalog,
  configureLogger,
  expect: chai.expect,
}
