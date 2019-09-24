/* global DEBUG */
'use strict';
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Hook = require('require-in-the-middle');
const path = require('path');

const hookMap = new Map();

// 我们在webpack.config.js中被require, 所以肯定比
// webpack require loader的时间早, 但是有个情况是
// 可能存在多个实例对应一个hookMap, 会不会导致类似
// 线城安全的问题? 然而如果每个实例一个hookMap, 那
// 就要在apply中实例化hookMap并调用Hook去hook file-loader
// apply什么时候被调用, 还能不能确保webpack require
// file-loader之前hook到file-loader是不能确定的, 这里
// 已经很多地方依赖于webpack和file-loader的具体实现了,
// 这些东西都不怎么靠谱, 说不定哪天他们改了, 我插件就
// 跟着挂了...还是就一个hookMap吧, 没人会这么智障搞几个的...
// 搞了几个出了问题他们自己负责吧...
Hook(['file-loader'], exports => {
	const loader = function (...args) {
		const _emitFile = this.emitFile, src = this.resource;
		// 虽然这里是个callback, 不过这里是同步调用的,
		// 所以调用的时候肯定已经有src了
		this.emitFile = function (...args) {
			hookMap.set(src, args[0]);
			_emitFile.apply(this, args);
		};
		return exports.apply(this, args);
	};

	return loader;
});

function createLinkTags(map, publicPath = '') {
	const tags = [];
	for (let { attr, file, query } of map.values()) {
		if (file) {
			if (query && attr.preserveQuery) {
				file += `?${query}`;
			}

			if (attr) {
				attr.href = `${publicPath}${file}`;
				delete attr.preserveQuery;
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
		const assetsMap = new Map(Object.keys(this._options).map(src =>
			[path.resolve(process.cwd(), src.trim()), {
				attr: this._options[src],
				file: null,
				query: ''
			}]
		));
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
				let [src, query] = mod.resource.split('?'), item = assetsMap.get(src);
				if (item && mod.buildInfo && mod.buildInfo.assets) {
					// 需要注意的是也可能一个文件被打包到多个chunk, 但是字体应该是只会一一对应
					item.file = Object.keys(mod.buildInfo.assets)[0];
					item.query = query || '';
				}
			});
			hookMap.forEach((val, resource) => {
				let [src, query] = resource.split('?'), item = assetsMap.get(src);
				if (item && !item.file) {
					item.file = val;
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
					.tap(this.constructor.name, ({ headTags }) => {
						const tags = createLinkTags(assetsMap, compilation.outputOptions.publicPath);
						if (tags.length) {
							headTags.push(...tags);
						}
					});
			} else {
				// 因为配置中我们在html-webpack-plugin之前, 所以这里推迟到当前
				// 阶段最后去hook html-webpack-plugin, 等待它先注册hook到compilation
				// 但是前面是通过html-webpack-plugin v4的方法去hook的, 所以不需要我
				// 们自己来推迟
				process.nextTick(() => {
					compilation.hooks.htmlWebpackPluginAlterAssetTags
						.tap(this.constructor.name, ({ head }) => {
							const tags = createLinkTags(assetsMap, compilation.outputOptions.publicPath);
							if (tags.length) {
								head.push(...tags);
							}
						});
				});
			}
		});
	}
}

module.exports = PreloadFontPlugin;
