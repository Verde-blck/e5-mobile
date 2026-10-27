const { withAndroidManifest } = require('expo/config-plugins')
const { setSupportsScreens } = require('./tabletScreens')

module.exports = (config) =>
  withAndroidManifest(config, (c) => {
    c.modResults = setSupportsScreens(c.modResults)
    return c
  })
