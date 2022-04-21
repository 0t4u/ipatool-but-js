import { URLSearchParams } from 'node:url';
import { retryConfig } from './common.js';

export class ItunesClient {
    constructor(fetch) {
        this.fetch = fetch;
    }

    async lookup({ bundleId = '', term = '', country = 'US', limit = 1, media = 'software', deviceFamily = 'iPhone' } = {}) {
        const url = 'https://itunes.apple.com/lookup?';
        const params = new URLSearchParams();
        params.append('bundleId', bundleId);
        params.append('term', term);
        params.append('country', country);
        params.append('limit', limit);
        params.append('media', media);
        params.append('deviceFamily', deviceFamily);
        const request = await this.fetch(url + params.toString(), { ...retryConfig });
        const response = await request.json();
        return response;
    }

    async getAppVersionId(appId, country = '143441-1,32') {
        const url = `https://apps.apple.com/app/id${appId}`;
        const headers = { "X-Apple-Store-Front": country };
        const request = await this.fetch(url, { ...headers, ...retryConfig });
        const response = await request.text();
        const regexp = /\\\"buyParams\\\"\:\\\"(.*?)\\\"/m;
        const result = response.match(regexp);
        const resultRegexp = /\\u0026appExtVrsId\=(.*?)\\\"/m;
        const appExtVrsId = result[0].match(resultRegexp);
        return appExtVrsId[1];
    }
}