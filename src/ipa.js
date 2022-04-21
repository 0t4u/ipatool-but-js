import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import fetchretry from 'fetch-retry';
import nodefetch from 'node-fetch';
import { ItunesClient } from './itunes.js';
import { StoreClient } from './store.js';

export class IPATool {
    constructor() {
        this.fetch = fetchretry(nodefetch);
        this.itunes = new ItunesClient(this.fetch);
        this.store = new StoreClient(this.fetch);
    }

    async downloadMeta({ id, email, password, code } = {}) {
        await this.store.authenticate(email, password, code);
        const version = await this.itunes.getAppVersionId(id, this.store.storeFront);
        const data = await this.store.download(id, version);
        return data;
    }

    async downloadToDisk({ path, id, email, password, code } = {}) {
        const meta = await this.downloadMeta({ id, email, password, code });
        const status = await this._saveToDisk({
            url: meta.URL,
            path,
            filename: `${meta.metadata.bundleDisplayName}-${meta.metadata.bundleShortVersionString}.ipa`
        });
        return status.error ? status.message : status;
    }

    async _saveToDisk({ url, path, filename } = {}) {
        const streamPipeline = promisify(pipeline);
        const response = await this.fetch(url);
        if (!response.ok) return { error: true, message: 'Data read error' };
        await streamPipeline(response.body, createWriteStream(`${path}/${filename}`));
        return { error: false }
    }
}