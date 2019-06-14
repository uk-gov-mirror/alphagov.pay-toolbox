const path = require('path')
const express = require('express')
const helmet = require('helmet')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const flash = require('connect-flash')
const cookieSession = require('cookie-session')
const nunjucks = require('nunjucks')

const { common, server } = require('./../config')
const logger = require('./../lib/logger')
const passport = require('../lib/auth/passport')

const errors = require('./errorHandler')
const router = require('./router')

// @FIXME(sfount) move this out of server configuration
const { toFormattedDate, toFormattedDateLong } = require('./../lib/format')

// @FIXME(sfount) errors should be thrown and this should be properly handled if
//                there is no manifest etc.
// eslint-disable-next-line import/no-unresolved
const staticResourceManifest = require('./../public/manifest')

const app = express()

const configureSecureHeaders = function configureSecureHeaders() {
  app.use(helmet())
  app.use(helmet.contentSecurityPolicy({
    directives: { defaultSrc: [ '\'self\'' ] }
  }))
}

const configureRequestParsing = function configureRequestParsing(instance) {
  const httpRequestLoggingFormat = common.production ? 'short' : 'dev'

  if (common.production) {
    // service is behind a front-facing proxy - set req IP values accordinglyi
    instance.enable('trust proxy')
  }

  instance.use(bodyParser.urlencoded({ extended: false }))
  instance.use(bodyParser.json({ strict: true, limit: '15kb' }))
  instance.use(flash())

  // logger middleware included after flash and body parsing middleware as they
  // alter the call stack (it should ideally be placed just before routes)
  instance.use(logger.middleware)
  instance.use(morgan(httpRequestLoggingFormat, { stream: logger.stream }))
}

const configureServingPublicStaticFiles = function configureServingPublicStaticFiles(instance) {
  const cache = { maxage: '1y' }
  instance.use('/public', express.static(path.join(__dirname, '../public'), cache))
  instance.use('/assets/fonts', express.static(path.join(process.cwd(), 'node_modules/govuk-frontend/assets/fonts'), cache))
  instance.use('/favicon.ico', express.static(path.join(process.cwd(), 'node_modules/govuk-frontend/assets/images/', 'favicon.ico')))
}

const configureClientSessions = function configureClientSessions(instance) {
  instance.use(cookieSession({
    name: 'pay-toolbox-service-cookies',
    keys: [ server.COOKIE_SESSION_ENCRYPTION_SECRET ],
    maxAge: '24h'
  }))
}

const configureAuth = function configureAuth(instance) {
  instance.use(passport.initialize())
  instance.use(passport.session())
}

const configureTemplateRendering = function configureTemplateRendering(instance) {
  const templateRendererConfig = { autoescape: true, express: instance, watch: !common.production }

  // include both templates from this repository and from govuk frontend
  const templatePathRoots = [ path.join(process.cwd(), 'node_modules/govuk-frontend'), path.join(__dirname, 'modules') ]
  const templaterEnvironment = nunjucks.configure(templatePathRoots, templateRendererConfig)

  // make static manifest details available to all templates
  templaterEnvironment.addGlobal('manifest', staticResourceManifest)
  templaterEnvironment.addFilter('formatDate', date => toFormattedDate(new Date(date)))
  templaterEnvironment.addFilter('formatDateLong', date => toFormattedDateLong(new Date(date)))

  instance.set('view engine', 'njk')
}

const configureRouting = function configureRouting(instance) {
  instance.use('/', router)
  instance.use(errors.handleNotFound)
}

// top level service stack wide error handling
const configureErrorHandling = function configureErrorHandling(instance) {
  instance.use(errors.handleRequestErrors)
  instance.use(errors.handleDefault)
}

// order of configuration options important given the nature of Express Middleware
const configure = [
  configureSecureHeaders,
  configureRequestParsing,
  configureServingPublicStaticFiles,
  configureClientSessions,
  configureAuth,
  configureTemplateRendering,
  configureRouting,
  configureErrorHandling
]
configure.map(config => config(app))

module.exports = app
