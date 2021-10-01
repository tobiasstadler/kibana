/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { Setup } from '../../helpers/setup_request';
import { getCPUChartData } from './shared/cpu';
import { getMemoryChartData } from './shared/memory';

export async function getDefaultMetricsCharts({
  environment,
  kuery,
  serviceAgentIds,
  setup,
  start,
  end,
}: {
  environment: string;
  kuery: string;
  serviceAgentIds: string[];
  setup: Setup;
  start: number;
  end: number;
}) {
  const charts = await Promise.all([
    getCPUChartData({ environment, kuery, setup, serviceAgentIds, start, end }),
    getMemoryChartData({ environment, kuery, setup, serviceAgentIds, start, end }),
  ]);

  return { charts };
}
