import { load } from 'cheerio';

import type { Route } from '@/types';
import { parseDate } from '@/utils/parse-date';
import { getPlaywrightPage } from '@/utils/playwright';
import timezone from '@/utils/timezone';

const baseUrl = 'https://www.carp.co.jp';

export const route: Route = {
    path: '/chen-blog',
    categories: ['blog'],
    example: '/carp/chen-blog',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.carp.co.jp/chen-blog', 'www.carp.co.jp/chen-blog/:date'],
            target: '/chen-blog',
        },
    ],
    name: '陳ブログ',
    maintainers: [],
    handler,
    url: 'www.carp.co.jp/chen-blog',
};

async function handler() {
    const listUrl = `${baseUrl}/chen-blog`;

    // The page is rendered client-side (Studio Design), so ofetch returns an
    // empty shell. Use a headless browser and wait for the post links to appear.
    const { page, destroy } = await getPlaywrightPage(listUrl, {
        gotoConfig: { waitUntil: 'networkidle' },
    });

    try {
        await page.waitForSelector('a.link[href*="/chen-blog/"]', { timeout: 30000 });
    } catch {
        // fall through; selector may differ or content genuinely empty
    }

    const html = await page.content();
    await destroy();

    const $ = load(html);

    const item = $('a.link')
        .toArray()
        .map((el) => {
            const $el = $(el);

            const href = $el.attr('href') ?? '';
            const link = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;

            // First p.text = title, second p.text = date (YYYY年M月D日)
            const texts = $el
                .find('p.text')
                .toArray()
                .map((t) => $(t).text().trim());
            const title = texts[0] ?? '';
            const dateText = texts[1] ?? '';

            const slugDate = link.match(/\/chen-blog\/(\d{8})/)?.[1];
            const pubDate = dateText ? timezone(parseDate(dateText, 'YYYY年M月D日'), 9) : slugDate ? timezone(parseDate(slugDate, 'YYYYMMDD'), 9) : undefined;

            return { title, link, pubDate };
        })
        .filter((i) => i.title && i.link && /\/chen-blog\/\d{8}/.test(i.link));

    return {
        title: '広島東洋カープ 陳ブログ',
        link: listUrl,
        description: '広島東洋カープ 台湾人広報 陳浚錡（チェンチュンチー）のブログ',
        language: 'ja' as const,
        item,
    };
}
