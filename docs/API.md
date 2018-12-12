## Requirements

Set before html-webpack-plugin.



## Installation

```shell
$ npm i -D preload-font-plugin
```



## Usage

```javascript
{
    plugins: [
        new PreloadFontPlugin({
            // relative to process.cwd()
            './src/demo.ttf': {
                rel: 'preload',
                as: 'font',
                type: 'font/ttf',
                crossorigin: 'anonymous'
            }
        }),
        new HtmlWebpackPlugin({
            chunks: ['app', 'vendors']
        })
}
```

output

```html
<link rel="preload" type="font/ttf" as="font" href="demo.be372c5a.ttf" crossorigin="anonymous">
```





## Options

A simple object, whose key is the file relative to `process.cwd()`, value as attributes of `<link>`.