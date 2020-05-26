require('dotenv').config()

const proxyConfig = require('./proxy.config');
const path = require('path')

function resolve (dir) {
  return path.join(__dirname, dir)
}

const {
  env
} = process

const publicPath = env.PUBLIC_PATH || './'

function addStyleResource (rule) {
  rule.use('style-resource')
    .loader('style-resources-loader')
    .options({
      patterns: [
        path.resolve(__dirname, './src/styles/var.less'),
      ],
    })
}

module.exports = {
  devServer: {
    proxy: proxyConfig
  },
  publicPath: process.env.NODE_ENV === 'production' ?
    publicPath : './',
  chainWebpack: (config) => {
    // set svg-sprite-loader
    config.module
      .rule('svg')
      .exclude.add(resolve('src/icons'))
      .end()
    config.module
      .rule('icons')
      .test(/\.svg$/)
      .include.add(resolve('src/icons'))
      .end()
      .use('svg-sprite-loader')
      .loader('svg-sprite-loader')
      .options({
        symbolId: 'icon-[name]'
      })
      .end()
    const types = ['vue-modules', 'vue', 'normal-modules', 'normal']
    types.forEach(type => addStyleResource(config.module.rule('less').oneOf(type)))
  },
  configureWebpack: config => {
    if (process.env.NODE_ENV === 'production') {
      // 为生产环境修改配置...
      config.externals = {
        vue: 'Vue',
        'vue-router': 'VueRouter',
        'element-ui': 'ELEMENT'
      }
    } else {
      // 为开发环境修改配置...
    }
  }
}
