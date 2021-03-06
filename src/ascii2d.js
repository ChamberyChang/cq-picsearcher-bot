import Cheerio from 'cheerio';
import CQ from './CQcode';
import pixivShorten from './urlShorten/pixiv';
import logError from './logError';
const Axios = require('./axiosProxy');

let hostsI = 0;

/**
 * ascii2d 搜索
 *
 * @param {string} url 图片地址
 * @returns 色合検索 和 特徴検索 结果
 */
async function doSearch(url, snLowAcc = false) {
  const hosts = global.config.ascii2dHost;
  let host = hosts[hostsI++ % hosts.length];
  if (host === 'ascii2d.net') host = `https://${host}`;
  else if (!/^https?:\/\//.test(host)) host = `http://${host}`;
  const { colorURL, colorDetail } = await Axios.get(`${host}/search/url/${encodeURIComponent(url)}`).then(r => ({
    colorURL: r.request.res.responseUrl,
    colorDetail: getDetail(r, host),
  }));
  const bovwURL = colorURL.replace('/color/', '/bovw/');
  const bovwDetail = await Axios.get(bovwURL).then(r => getDetail(r, host));
  const colorRet = getResult(colorDetail, snLowAcc);
  const bovwRet = getResult(bovwDetail, snLowAcc);
  return {
    color: `色合\n${colorRet.result}`,
    bovw: `特徴\n${bovwRet.result}`,
    success: colorRet.success && bovwRet.success,
  };
}

/**
 * 解析 ascii2d 网页结果
 *
 * @param {string} ret ascii2d response
 * @param {string} baseURL ascii2d base URL
 * @returns 画像搜索结果
 */
function getDetail(ret, baseURL) {
  let result = {};
  const html = ret.data;
  const $ = Cheerio.load(html, {
    decodeEntities: false,
  });
  const $itembox = $('.item-box');
  for (let i = 0; i < $itembox.length; i++) {
    const $box = $($itembox[i]);
    const $link = $box.find('.detail-box a');
    if ($link.length === 0) continue;
    const $title = $($link[0]);
    const $author = $($link[1]);
    result = {
      thumbnail: baseURL + $box.find('.image-box img').attr('src'),
      title: $title.html(),
      author: $author.html(),
      url: $title.attr('href'),
      author_url: $author.attr('href'),
    };
    break;
  }
  if (!result.url) {
    logError(`${global.getTime()} [error] ascii2d getDetail`);
    logError(ret);
  }
  return result;
}

function getResult({ url, title, author, thumbnail, author_url }, snLowAcc = false) {
  if (!url) return { success: false, result: 'う～さ～～ぎ～～～' };
  const texts = [`「${title}」/「${author}」`];
  if (thumbnail && !(global.config.bot.hideImg || (snLowAcc && global.config.bot.hideImgWhenLowAcc))) {
    texts.push(CQ.img(thumbnail));
  } 
  texts.push(`来源：${pixivShorten(url)}`);
  if (author_url) {
    const tweetSearch = /(twitter.+intent\/user\?user_id=([0-9]+))|(al.dmm.co.jp.+)|(seiga.nicovideo.+)|(amazon.jp.+)/.test(author_url);
    if (!tweetSearch) texts.push(`作者：${pixivShorten(author_url)}`);
  }
  return { success: true, result: texts.join('\n') };
}

export default doSearch;
