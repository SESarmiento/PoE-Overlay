import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { TradeLeaguesHttpLeague } from '@data/poe/schema';
import { environment } from '@env/environment';
import { Observable, of, throwError } from 'rxjs';
import { delay, flatMap, retryWhen } from 'rxjs/operators';
import { CurrencyOverviewResponse } from '../schema/currency-overview';

export enum CurrencyOverviewType {
    Currency = 'Currency',
    Fragment = 'Fragment'
}

const PATH_TYPE_MAP = {
    [CurrencyOverviewType.Currency]: 'currency',
    [CurrencyOverviewType.Fragment]: 'fragments',
};

const RETRY_COUNT = 3;
const RETRY_DELAY = 100;

@Injectable({
    providedIn: 'root'
})
export class CurrencyOverviewHttpService {
    private readonly baseUrl: string;

    constructor(
        private readonly httpClient: HttpClient) {
        this.baseUrl = `${environment.poeNinja.baseUrl}/api/data/currencyoverview`;
    }

    public get(leagueId: string, type: CurrencyOverviewType): Observable<CurrencyOverviewResponse> {
        const url = this.getUrl(leagueId, type);
        return this.httpClient.get<CurrencyOverviewResponse>(url).pipe(
            retryWhen(errors => errors.pipe(
                flatMap((response, count) => this.handleError(response, count))
            )),
            flatMap(response => {
                if (!response?.lines) {
                    if (leagueId !== TradeLeaguesHttpLeague.Standard) {
                        console.log(`Got empty result from '${url}'. Using Standard league for now.`, response);
                        return this.get(TradeLeaguesHttpLeague.Standard, type);
                    }
                    console.warn(`Got empty result from '${url}'.`, response);
                    return throwError(`Got empty result from '${url}'.`);
                }

                const result: CurrencyOverviewResponse = {
                    lines: response.lines,
                    url: `${environment.poeNinja.baseUrl}/${this.getLeaguePath(leagueId)}/${PATH_TYPE_MAP[type]}`
                };
                return of(result);
            })
        );
    }

    private handleError(response: HttpErrorResponse, count: number): Observable<void> {
        if (count >= RETRY_COUNT) {
            return throwError(response);
        }
        return of(null).pipe(delay(RETRY_DELAY));
    }

    private getUrl(leagueId: string, type: CurrencyOverviewType): string {
        return `${this.baseUrl}?league=${encodeURIComponent(leagueId)}&type=${encodeURIComponent(type)}&language=en`;
    }

    private getLeaguePath(leagueId: string): string {
        switch (leagueId) {
            case TradeLeaguesHttpLeague.Standard:
                return 'standard';
            case TradeLeaguesHttpLeague.HardCore:
                return 'hardcore';
        }

        const exp = new RegExp(`${TradeLeaguesHttpLeague.HardCore} .*`);
        const regexResult = exp.exec(leagueId);
        if (regexResult !== null) {
            return 'challengehc';
        }
        return 'challenge';
    }
}
