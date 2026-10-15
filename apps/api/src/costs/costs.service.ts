import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  type ResultByTime,
} from '@aws-sdk/client-cost-explorer';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { COST_SUMMARY_MONTHS, type CostSummary, type MonthCost } from '@respark/schemas/costs';

/** Every Cost Explorer request is billed ($0.01), and AWS refreshes cost data only a few times a day. */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * ce:GetCostAndUsage can't be scoped to resources, so the role can read the whole account.
 * This fixed tag filter is what keeps the response to Respark's own costs; never let the
 * client supply filters, dimensions, or date ranges.
 */
const PROJECT_TAG = { Key: 'Project', Values: ['respark'] };

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const monthStart = (date: Date, offsetMonths = 0) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 1));

const roundCents = (value: number) => Math.round(value * 100) / 100;

const toMonthCost = (result: ResultByTime): MonthCost => {
  const byService = (result.Groups ?? [])
    .map((group) => ({
      service: group.Keys?.[0] ?? 'Unknown',
      amount: roundCents(Number(group.Metrics?.UnblendedCost?.Amount ?? 0)),
    }))
    .filter((entry) => entry.amount !== 0)
    .sort((a, b) => b.amount - a.amount);

  return {
    month: result.TimePeriod?.Start ?? '',
    total: roundCents(byService.reduce((sum, entry) => sum + entry.amount, 0)),
    byService,
  };
};

const fixtureSummary = (now: Date): CostSummary => {
  const services = [
    { service: 'Amazon Relational Database Service', amount: 14.6 },
    { service: 'Amazon Elastic Container Service', amount: 9.85 },
    { service: 'Amazon Elastic File System', amount: 0.12 },
    { service: 'Amazon CloudFront', amount: 0.04 },
    { service: 'Amazon Simple Storage Service', amount: 0.02 },
  ];
  const months = Array.from({ length: COST_SUMMARY_MONTHS }, (_, index) => {
    const offset = index - (COST_SUMMARY_MONTHS - 1);
    const scale = offset === 0 ? now.getUTCDate() / 30 : 1;
    const byService = services.map((entry) => ({
      service: entry.service,
      amount: roundCents(entry.amount * scale),
    }));
    return {
      month: isoDate(monthStart(now, offset)),
      total: roundCents(byService.reduce((sum, entry) => sum + entry.amount, 0)),
      byService,
    };
  });
  return { currency: 'USD', months, updatedAt: now.toISOString() };
};

@Injectable()
export class CostsService {
  private readonly client = new CostExplorerClient({ region: 'us-east-1' });
  private cached: { summary: CostSummary; expiresAt: number } | null = null;
  private inFlight: Promise<CostSummary> | null = null;

  constructor(
    @InjectPinoLogger(CostsService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getSummary(): Promise<CostSummary> {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.summary;
    }

    this.inFlight ??= this.refresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async refresh(): Promise<CostSummary> {
    const now = new Date();
    try {
      const summary = await this.fetchFromAws(now);
      this.cached = { summary, expiresAt: Date.now() + CACHE_TTL_MS };
      this.logger.info(
        { event: 'costs.refreshed', months: summary.months.length },
        'Refreshed cost summary',
      );
      return summary;
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(
          { event: 'costs.fixture', err },
          'Cost Explorer unavailable; serving fixture data',
        );
        return fixtureSummary(now);
      }
      this.logger.error({ event: 'costs.refresh_failed', err }, 'Cost Explorer request failed');
      throw new ServiceUnavailableException('Cost data is unavailable right now');
    }
  }

  private async fetchFromAws(now: Date): Promise<CostSummary> {
    const results: ResultByTime[] = [];
    let currency = 'USD';
    let nextPageToken: string | undefined;

    do {
      const response = await this.client.send(
        new GetCostAndUsageCommand({
          TimePeriod: {
            Start: isoDate(monthStart(now, -(COST_SUMMARY_MONTHS - 1))),
            // Exclusive end; the next month's start keeps the current month in range on the 1st.
            End: isoDate(monthStart(now, 1)),
          },
          Granularity: 'MONTHLY',
          Metrics: ['UnblendedCost'],
          Filter: { Tags: PROJECT_TAG },
          GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
          NextPageToken: nextPageToken,
        }),
      );
      results.push(...(response.ResultsByTime ?? []));
      currency = response.ResultsByTime?.[0]?.Groups?.[0]?.Metrics?.UnblendedCost?.Unit ?? currency;
      nextPageToken = response.NextPageToken;
    } while (nextPageToken);

    return {
      currency,
      months: results.map(toMonthCost).sort((a, b) => a.month.localeCompare(b.month)),
      updatedAt: now.toISOString(),
    };
  }
}
