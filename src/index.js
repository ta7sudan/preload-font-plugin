/* global DEBUG */
'use strict';
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

function createLinkTags(map, publicPath = '') {
	const tags = [];
	for (let { attr, file, query } of map.values()) {
		if (file) {
			if (query) {
				file += `?${query}`;
			}

			if (attr) {
				attr.href = `${publicPath}${file}`;
			} else {
				attr = {
					href: `${file}`,
					rel: 'preload',
					as: 'font'
				};
			}

			tags.push({
				tagName: 'link',
				closeTag: false,
				voidTag: true,
				attributes: attr
			});
		}
	}
	return tags;
}

class PreloadFontPlugin {
	constructor(options = {}) {
		this._options = options;
	}
	apply(compiler) {
		const assetsMap = new Map(Object.keys(this._options).map(src => {
			return [path.resolve(process.cwd(), src.trim()), {
				attr: this._options[src],
				file: null,
				query: ''
			}];
		}));
		// 需要在html-webpack-plugin之前拿到文件映射的信息, 意味着
		// 注册emit需要在它之前, 意味着在配置中的顺序需要在它之前
		compiler.hooks.emit.tap(this.constructor.name, compilation => {
			// compilation.assets;
			// compilation.chunks;
			// compilation.modules;
			compilation.modules.forEach(mod => {
				if (typeof mod.resource !== 'string') {
					return;
				}
				let parts = mod.resource.split('?'), src = parts[0], query = parts[1];
				if (assetsMap.has(src)) {
					// 需要注意的是也可能一个文件被打包到多个chunk, 但是字体应该是只会一一对应
					const item = assetsMap.get(src);
					item.file = Object.keys(mod.buildInfo.assets)[0];
					item.query = query || '';
				}
			});
		});
		// 拿到文件映射关系之后, 需要修改掉html-webpack-plugin中的数据,
		// 需要在它生成html之前进行修改
		compiler.hooks.compilation.tap(this.constructor.name, compilation => {
			// 但是修改数据需要在html-webpack-plugin的hook中进行,
			// 意味着需要等html-webpack-plugin自身的hook挂到compilation
			// 之后, 但是配置中的顺序又需要在它之前
			if (typeof HtmlWebpackPlugin.getHooks === 'function') {
				HtmlWebpackPlugin
					.getHooks(compilation)
					.alterAssetTagGroups
					.tap(this.constructor.name, ({ headTags }) => 
						headTags.push(...createLinkTags(assetsMap, compilation.outputOptions.publicPath))
					);
			} else {
				// 因为配置中我们在html-webpack-plugin之前, 所以这里推迟到当前
				// 阶段最后去hook html-webpack-plugin, 等待它先注册hook到compilation
				// 但是前面是通过html-webpack-plugin v4的方法去hook的, 所以不需要我
				// 们自己来推迟
				process.nextTick(() => {
					compilation.hooks.htmlWebpackPluginAlterAssetTags
						.tap(this.constructor.name, ({ head }) => 
							head.push(...createLinkTags(assetsMap, compilation.outputOptions.publicPath))
						);
				});
			}
		});
	}
}

module.exports = PreloadFontPlugin;
