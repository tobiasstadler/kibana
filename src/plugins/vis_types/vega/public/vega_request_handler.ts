/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
import type { KibanaExecutionContext } from 'src/core/public';
import { DataView } from 'src/plugins/data/common';
import { Filter, esQuery, TimeRange, Query } from '../../../data/public';

import { SearchAPI } from './data_model/search_api';
import { TimeCache } from './data_model/time_cache';

import { VegaVisualizationDependencies } from './plugin';
import { VisParams } from './vega_fn';
import { getData, getInjectedMetadata } from './services';
import { VegaInspectorAdapters } from './vega_inspector';

interface VegaRequestHandlerParams {
  query: Query;
  filters: Filter[];
  timeRange: TimeRange;
  visParams: VisParams;
  searchSessionId?: string;
  executionContext?: KibanaExecutionContext;
}

interface VegaRequestHandlerContext {
  abortSignal?: AbortSignal;
  inspectorAdapters?: VegaInspectorAdapters;
}

export function createVegaRequestHandler(
  { plugins: { data }, core: { uiSettings }, getServiceSettings }: VegaVisualizationDependencies,
  context: VegaRequestHandlerContext = {}
) {
  let searchAPI: SearchAPI;
  const { timefilter } = data.query.timefilter;
  const timeCache = new TimeCache(timefilter, 3 * 1000);

  return async function vegaRequestHandler({
    timeRange,
    filters,
    query,
    visParams,
    searchSessionId,
    executionContext,
  }: VegaRequestHandlerParams) {
    const { dataViews, search } = getData();

    if (!searchAPI) {
      searchAPI = new SearchAPI(
        {
          uiSettings,
          search,
          indexPatterns: dataViews,
          injectedMetadata: getInjectedMetadata(),
        },
        context.abortSignal,
        context.inspectorAdapters,
        searchSessionId,
        executionContext
      );
    }

    timeCache.setTimeRange(timeRange);

    let dataView: DataView;
    const firstFilterIndex = filters[0]?.meta.index;
    if (firstFilterIndex) {
      dataView = await dataViews.get(firstFilterIndex).catch(() => undefined);
    }

    const esQueryConfigs = esQuery.getEsQueryConfig(uiSettings);
    const filtersDsl = esQuery.buildEsQuery(dataView, query, filters, esQueryConfigs);
    const { VegaParser } = await import('./data_model/vega_parser');
    const vp = new VegaParser(visParams.spec, searchAPI, timeCache, filtersDsl, getServiceSettings);

    return await vp.parseAsync();
  };
}
