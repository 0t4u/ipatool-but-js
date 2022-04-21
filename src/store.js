import plist from 'plist';
import getMAC from 'getmac';
import { retryConfig } from './common.js';

export class StoreClient {
    constructor(fetch) {
        this.userAgent = 'Configurator/2.15 (Macintosh; OS X 11.0.0; 16G29) AppleWebKit/2603.3.8';
        this.fetch = fetch;
        this.guid = getMAC().replace(/[^a-z0-9]/gi, '').toUpperCase();
        this.dsid = null;
        this.creditDisplay = null;
        this.passwordToken = null;
        this.storeFront = null;
        this.accountName = null;
        this.cookie = null;
    }

    async authenticate(appleId, password, code = false) {
        let response;
        let url = `https://${code ? 'p71' : 'p46'}-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/authenticate?guid=${this.guid}`;
        const dataJson = {
            appleId,
            password: `${password}${code ? code : ''}`,
            attempt: code ? '2' : '4',
            createSession: true,
            guid: this.guid,
            rmp: '0',
            why: 'signIn'
        }
        const body = plist.build(dataJson);
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent
        }
        while (true) {
            const request = await this.fetch(url, { ...{ method: 'POST', redirect: 'manual', headers, body }, ...retryConfig });
            response = request;
            if (request.status === 302) {
                url = request.headers.get('Location');
                continue;
            }
            break;
        }
        const plistData = await response.text();
        const result = plist.parse(plistData);
        if (result.failureType) return result;
        if (result.customerMessage?.includes('BadLogin')) return result;
        this.dsid = result['download-queue-info'].dsid.toString();
        this.creditDisplay = result.creditDisplay;
        this.passwordToken = result.passwordToken;
        this.storeFront = response.headers.get('x-set-apple-store-front');
        this.accountName = result.accountInfo.address.firstName + ' ' + result.accountInfo.address.lastName;
        this.cookie = response.headers.get('set-cookie');
        return { guid: this.guid, dsid: this.dsid, creditDisplay: this.creditDisplay, passwordToken: this.passwordToken, storeFront: this.storeFront, accountName: this.accountName };
    }

    async download(appId, appVerId = '') {
        const purchaseRequest = await this._requestPurchase(appId);
        if (purchaseRequest.status !== 500) {
            if (purchaseRequest.result.statusCode !== 0 || purchaseRequest.result.statusType !== "purchaseSuccess" || purchaseRequest.result.failure) {
                return { error: true, message: "Purchase failure" }
            }
        }

        const downloadRequest = await this._requestDownload(appId, appVerId);
        if (downloadRequest.songList[0]) {
            return downloadRequest.songList[0];
        } else {
            return { error: true, message: "Invalid response" }
        }
    }

    async _requestDownload(appId, appVerId = '0') {
        let response;
        let url = `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/volumeStoreDownloadProduct?guid=${this.guid}`;
        const dataJson = {
            creditDisplay: this.creditDisplay,
            guid: this.guid,
            salableAdamId: appId.toString(),
            appExtVrsId: appVerId.toString()
        }
        const body = plist.build(dataJson);
        const headers = {
            'iCloud-DSID': this.dsid,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent,
            'X-Dsid': this.dsid,
            'Cookie': this.cookie
        }
        while (true) {
            const request = await this.fetch(url, { ...{ method: 'POST', redirect: 'manual', headers, body }, ...retryConfig });
            response = request;
            if (request.status === 302) {
                url = request.headers.get('Location');
                continue;
            }
            break;
        }
        const plistData = await response.text();
        const result = plist.parse(plistData);
        return result;
    }

    async _requestPurchase(appId, appVerId = '0') {
        let response;
        let url = `https://buy.itunes.apple.com/WebObjects/MZBuy.woa/wa/buyProduct?guid=${this.guid}`;
        const dataJson = {
            appExtVrsId: appVerId,
            hasAskedToFulfillPreorder: 'true',
            buyWithoutAuthorization: 'true',
            hasDoneAgeCheck: 'true',
            guid: this.guid,
            needDiv: '0',
            origPage: 'Software-' + appId.toString(),
            origPageLocation: 'Buy',
            price: '0',
            pricingParameters: 'STDQ',
            productType: 'C',
            salableAdamId: appId.toString()
        }
        const body = plist.build(dataJson);
        const headers = {
            'X-Dsid': this.dsid,
            'iCloud-DSID': this.dsid,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Configurator/2.15 (Macintosh; OS X 10.12.6; 16G29) AppleWebKit/2603.3.8',
            'X-Apple-Store-Front': this.storeFront.split('-')[0],
            'X-Token': this.passwordToken
        }
        while (true) {
            const request = await this.fetch(url, { ...{ method: 'POST', redirect: 'manual', headers, body }, ...retryConfig });
            response = request;
            if (request.status === 302) {
                url = request.headers.get('Location');
                continue;
            }
            break;
        }
        const plistData = await response.text();
        const result = (response.status === 500) ? {} : plist.parse(plistData);
        return { result, status: response.status };
    }
}