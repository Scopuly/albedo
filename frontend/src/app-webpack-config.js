const path = require('path'),
    pkgInfo = require('../package.json'),
    webpack = require('webpack'),
    autoprefixer = require('autoprefixer'),
    CopyPlugin = require('copy-webpack-plugin'),
    MiniCssExtractPlugin = require('mini-css-extract-plugin'),
    cssnano = require('cssnano'),
    fs = require('fs')

module.exports = function (env, argv) {
    const mode = argv.mode || 'development'
    process.env.NODE_ENV = mode

    console.log('mode=' + mode)

    const isProduction = mode !== 'development'

    const settings = {
        mode,
        entry: {
            'albedo': [path.join(__dirname, './app.js')],
            'albedo-intent': [path.join(__dirname, './ui/intent/intent-script-global-import.js')],
            'albedo-payment-button': [path.join(__dirname, './payment-request-script/payment-button.js')]
        },
        output: {
            path: path.join(__dirname, '../distr/app/'),
            filename: '[name].js',
            chunkFilename: '[name].js',
            publicPath: '/'
        },
        module: {
            rules: [
                {
                    test: /\.js?$/,
                    loader: 'babel-loader'
                    //exclude: /node_modules/
                },
                {
                    test: /\.scss$/,
                    use: [
                        {
                            loader: MiniCssExtractPlugin.loader
                        },
                        {
                            loader: 'css-loader',
                            options: {
                                importLoaders: 1,
                                url: false,
                                sourceMap: !isProduction
                            }
                        },
                        {
                            loader: 'postcss-loader',
                            options: {
                                ident: 'postcss',
                                plugins: [
                                    autoprefixer(),
                                    cssnano({
                                        autoprefixer: true,
                                        discardComments: {removeAll: true}
                                    })
                                ],
                                sourceMap: !isProduction
                            }
                        },
                        {
                            loader: 'sass-loader',
                            options: {
                                sourceMap: !isProduction,
                                prependData: '@import "./src/ui/variables.scss";'
                            }
                        }
                    ]
                },
                {
                    test: /\.svg$/,
                    loader: 'svg-inline-loader'
                },
                {
                    test: /\.wasm$/,
                    // Tells WebPack that this module should be included as base64-encoded binary file and not as code
                    loaders: ['base64-loader'],
                    // Disables WebPack's opinion where WebAssembly should be, makes it think that it's not WebAssembly - Error: WebAssembly module is included in initial chunk.
                    type: 'javascript/auto'
                }
            ],
            noParse: /\.wasm$/ // Makes WebPack think that we don't need to parse this module, otherwise it tries to recompile it, but fails - Error: Module not found: Error: Can't resolve 'env'
        },
        plugins: [
            new webpack.IgnorePlugin(/ed25519/),
            new webpack.IgnorePlugin(/^\.\/wordlists\/(?!english)/, /bip39\/src$/),
            new CopyPlugin({
                patterns: [
                    path.join(__dirname, './static/shared/'),
                    {
                        from: path.join(__dirname, './static/app/'),
                        transform(content, absoluteFrom) {
                            if (absoluteFrom.includes('index.html')) {
                                content = content.toString('utf8').replace(/v=0\.0\.0/g, 'v=' + pkgInfo.version)
                                return Buffer.from(content, 'utf8')
                            }
                            return content
                        }
                    }
                ]
            }),
            new MiniCssExtractPlugin({
                filename: '[name].css'
            }),
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': JSON.stringify(mode),
                albedoOrigin: JSON.stringify(mode === 'development' ? 'https://localhost:5001' : 'https://albedo.link'),
                appVersion: JSON.stringify(pkgInfo.version)
            })
        ],
        node: {
            fs: 'empty'
        },
        optimization: {},
        resolve: {
            alias: {
                components: path.resolve(__dirname, 'ui/components/')
            }
        }
    }

    if (!isProduction) {
        settings.devtool = 'source-map'
        settings.devServer = {
            historyApiFallback: {
                disableDotRule: true
            },
            compress: true,
            port: 5001,
            contentBase: [path.join(__dirname, './distr/app')],
            https: {
                key: fs.readFileSync('./certs/private.key'),
                cert: fs.readFileSync('./certs/private.crt'),
                ca: fs.readFileSync('./certs/private.pem')
            },
            setup(app) {
                const bodyParser = require('body-parser')
                app.use(bodyParser.urlencoded())
                app.post('*', (req, res) => {
                    const querystring = require('querystring')
                    res.redirect(req.originalUrl + '?' + querystring.stringify(req.body))
                })
            }
        }
    } else {
        settings.plugins.unshift(new webpack.LoaderOptionsPlugin({
            minimize: true,
            debug: false,
            sourceMap: false
        }))

        const TerserPlugin = require('terser-webpack-plugin')

        settings.optimization.minimizer = [new TerserPlugin({
            parallel: true,
            sourceMap: false,
            terserOptions: {
                //warnings: true,
                toplevel: true
            }
        })]

        /*const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
        settings.plugins.push(new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: 'bundle-stats.html',
            openAnalyzer: false
        }))*/
    }
    return settings
}