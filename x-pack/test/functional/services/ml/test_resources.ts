/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { ProvidedType } from '@kbn/test';
import { savedSearches, dashboards } from './test_resources_data';
import { COMMON_REQUEST_HEADERS } from './common_api';
import { FtrProviderContext } from '../../ftr_provider_context';
import { JobType } from '../../../../plugins/ml/common/types/saved_objects';

export enum SavedObjectType {
  CONFIG = 'config',
  DASHBOARD = 'dashboard',
  INDEX_PATTERN = 'index-pattern',
  SEARCH = 'search',
  VISUALIZATION = 'visualization',
  ML_JOB = 'ml-job',
}

export type MlTestResourcesi = ProvidedType<typeof MachineLearningTestResourcesProvider>;

export function MachineLearningTestResourcesProvider({ getService }: FtrProviderContext) {
  const kibanaServer = getService('kibanaServer');
  const log = getService('log');
  const supertest = getService('supertest');
  const retry = getService('retry');

  return {
    async setKibanaTimeZoneToUTC() {
      await kibanaServer.uiSettings.update({
        'dateFormat:tz': 'UTC',
      });
    },

    async resetKibanaTimeZone() {
      await kibanaServer.uiSettings.unset('dateFormat:tz');
    },

    async savedObjectExistsById(id: string, objectType: SavedObjectType): Promise<boolean> {
      const response = await supertest.get(`/api/saved_objects/${objectType}/${id}`);
      return response.status === 200;
    },

    async savedObjectExistsByTitle(title: string, objectType: SavedObjectType): Promise<boolean> {
      const id = await this.getSavedObjectIdByTitle(title, objectType);
      if (id) {
        return await this.savedObjectExistsById(id, objectType);
      } else {
        return false;
      }
    },

    async getSavedObjectIdByTitle(
      title: string,
      objectType: SavedObjectType
    ): Promise<string | undefined> {
      log.debug(`Searching for '${objectType}' with title '${title}'...`);
      const findResponse = await supertest
        .get(`/api/saved_objects/_find?type=${objectType}&per_page=10000`)
        .set(COMMON_REQUEST_HEADERS)
        .expect(200)
        .then((res: any) => res.body);

      for (const savedObject of findResponse.saved_objects) {
        const objectTitle = savedObject.attributes.title;
        if (objectTitle === title) {
          log.debug(` > Found '${savedObject.id}'`);
          return savedObject.id;
        }
      }
      log.debug(` > Not found`);
    },

    async getSavedObjectIdsByType(objectType: SavedObjectType): Promise<string[]> {
      const savedObjectIds: string[] = [];

      log.debug(`Searching for '${objectType}' ...`);
      const findResponse = await supertest
        .get(`/api/saved_objects/_find?type=${objectType}&per_page=10000`)
        .set(COMMON_REQUEST_HEADERS)
        .expect(200)
        .then((res: any) => res.body);

      findResponse.saved_objects.forEach((element: any) => {
        savedObjectIds.push(element.id);
      });

      return savedObjectIds;
    },

    async getIndexPatternId(title: string): Promise<string | undefined> {
      return this.getSavedObjectIdByTitle(title, SavedObjectType.INDEX_PATTERN);
    },

    async getSavedSearchId(title: string): Promise<string | undefined> {
      return this.getSavedObjectIdByTitle(title, SavedObjectType.SEARCH);
    },

    async getVisualizationId(title: string): Promise<string | undefined> {
      return this.getSavedObjectIdByTitle(title, SavedObjectType.VISUALIZATION);
    },

    async getDashboardId(title: string): Promise<string | undefined> {
      return this.getSavedObjectIdByTitle(title, SavedObjectType.DASHBOARD);
    },

    async createIndexPattern(title: string, timeFieldName?: string): Promise<string> {
      log.debug(
        `Creating index pattern with title '${title}'${
          timeFieldName !== undefined ? ` and time field '${timeFieldName}'` : ''
        }`
      );

      const createResponse = await supertest
        .post(`/api/saved_objects/${SavedObjectType.INDEX_PATTERN}`)
        .set(COMMON_REQUEST_HEADERS)
        .send({ attributes: { title, timeFieldName } })
        .expect(200)
        .then((res: any) => res.body);

      await this.assertIndexPatternExistByTitle(title);

      log.debug(` > Created with id '${createResponse.id}'`);
      return createResponse.id;
    },

    async createBulkSavedObjects(body: object[]): Promise<string> {
      log.debug(`Creating bulk saved objects'`);

      const createResponse = await supertest
        .post(`/api/saved_objects/_bulk_create`)
        .set(COMMON_REQUEST_HEADERS)
        .send(body)
        .expect(200)
        .then((res: any) => res.body);

      log.debug(` > Created bulk saved objects'`);
      return createResponse;
    },

    async createIndexPatternIfNeeded(title: string, timeFieldName?: string): Promise<string> {
      const indexPatternId = await this.getIndexPatternId(title);
      if (indexPatternId !== undefined) {
        log.debug(`Index pattern with title '${title}' already exists. Nothing to create.`);
        return indexPatternId;
      } else {
        return await this.createIndexPattern(title, timeFieldName);
      }
    },

    async assertIndexPatternNotExist(title: string) {
      await this.assertSavedObjectNotExistsByTitle(title, SavedObjectType.INDEX_PATTERN);
    },

    async createSavedSearch(title: string, body: object): Promise<string> {
      log.debug(`Creating saved search with title '${title}'`);

      const createResponse = await supertest
        .post(`/api/saved_objects/${SavedObjectType.SEARCH}`)
        .set(COMMON_REQUEST_HEADERS)
        .send(body)
        .expect(200)
        .then((res: any) => res.body);

      await this.assertSavedSearchExistByTitle(title);

      log.debug(` > Created with id '${createResponse.id}'`);
      return createResponse.id;
    },

    async createDashboard(title: string, body: object): Promise<string> {
      log.debug(`Creating dashboard with title '${title}'`);

      const createResponse = await supertest
        .post(`/api/saved_objects/${SavedObjectType.DASHBOARD}`)
        .set(COMMON_REQUEST_HEADERS)
        .send(body)
        .expect(200)
        .then((res: any) => res.body);

      log.debug(` > Created with id '${createResponse.id}'`);
      return createResponse.id;
    },

    async createSavedSearchIfNeeded(savedSearch: any): Promise<string> {
      const title = savedSearch.requestBody.attributes.title;
      const savedSearchId = await this.getSavedSearchId(title);
      if (savedSearchId !== undefined) {
        log.debug(`Saved search with title '${title}' already exists. Nothing to create.`);
        return savedSearchId;
      } else {
        const body = await this.updateSavedSearchRequestBody(
          savedSearch.requestBody,
          savedSearch.indexPatternTitle
        );
        return await this.createSavedSearch(title, body);
      }
    },

    async updateSavedSearchRequestBody(body: object, indexPatternTitle: string): Promise<object> {
      const indexPatternId = await this.getIndexPatternId(indexPatternTitle);
      if (indexPatternId === undefined) {
        throw new Error(
          `Index pattern '${indexPatternTitle}' to base saved search on does not exist. `
        );
      }

      // inject index pattern id
      const updatedBody = JSON.parse(JSON.stringify(body), (_key, value) => {
        if (value === 'INDEX_PATTERN_ID_PLACEHOLDER') {
          return indexPatternId;
        } else {
          return value;
        }
      });

      // make searchSourceJSON node a string
      const searchSourceJsonNode = updatedBody.attributes.kibanaSavedObjectMeta.searchSourceJSON;
      const searchSourceJsonString = JSON.stringify(searchSourceJsonNode);
      updatedBody.attributes.kibanaSavedObjectMeta.searchSourceJSON = searchSourceJsonString;

      return updatedBody;
    },

    async createSavedSearchFarequoteFilterIfNeeded() {
      await this.createSavedSearchIfNeeded(savedSearches.farequoteFilter);
    },

    async createMLTestDashboardIfNeeded() {
      await this.createDashboardIfNeeded(dashboards.mlTestDashboard);
    },

    async deleteMLTestDashboard() {
      await this.deleteDashboardByTitle(dashboards.mlTestDashboard.requestBody.attributes.title);
    },

    async createDashboardIfNeeded(dashboard: any) {
      const title = dashboard.requestBody.attributes.title;
      const dashboardId = await this.getDashboardId(title);
      if (dashboardId !== undefined) {
        log.debug(`Dashboard with title '${title}' already exists. Nothing to create.`);
        return dashboardId;
      } else {
        return await this.createDashboard(title, dashboard.requestBody);
      }
    },

    async createSavedSearchFarequoteLuceneIfNeeded() {
      await this.createSavedSearchIfNeeded(savedSearches.farequoteLucene);
    },

    async createSavedSearchFarequoteKueryIfNeeded() {
      await this.createSavedSearchIfNeeded(savedSearches.farequoteKuery);
    },

    async createSavedSearchFarequoteFilterAndLuceneIfNeeded() {
      await this.createSavedSearchIfNeeded(savedSearches.farequoteFilterAndLucene);
    },

    async createSavedSearchFarequoteFilterAndKueryIfNeeded() {
      await this.createSavedSearchIfNeeded(savedSearches.farequoteFilterAndKuery);
    },

    async deleteSavedObjectById(id: string, objectType: SavedObjectType, force: boolean = false) {
      log.debug(`Deleting ${objectType} with id '${id}'...`);

      if ((await this.savedObjectExistsById(id, objectType)) === false) {
        log.debug(`${objectType} with id '${id}' does not exists. Nothing to delete.`);
        return;
      } else {
        await supertest
          .delete(`/api/saved_objects/${objectType}/${id}`)
          .set(COMMON_REQUEST_HEADERS)
          .query({ force })
          .expect(200);

        await this.assertSavedObjectNotExistsById(id, objectType);

        log.debug(` > Deleted ${objectType} with id '${id}'`);
      }
    },

    async deleteIndexPatternByTitle(title: string) {
      log.debug(`Deleting index pattern with title '${title}'...`);

      const indexPatternId = await this.getIndexPatternId(title);
      if (indexPatternId === undefined) {
        log.debug(`Index pattern with title '${title}' does not exists. Nothing to delete.`);
        return;
      } else {
        await this.deleteIndexPatternById(indexPatternId);
      }
    },

    async deleteIndexPatternById(id: string) {
      await this.deleteSavedObjectById(id, SavedObjectType.INDEX_PATTERN);
    },

    async deleteSavedSearchByTitle(title: string) {
      log.debug(`Deleting saved search with title '${title}'...`);

      const savedSearchId = await this.getSavedSearchId(title);
      if (savedSearchId === undefined) {
        log.debug(`Saved search with title '${title}' does not exists. Nothing to delete.`);
        return;
      } else {
        await this.deleteSavedSearchById(savedSearchId);
      }
    },

    async deleteSavedSearchById(id: string) {
      await this.deleteSavedObjectById(id, SavedObjectType.SEARCH);
    },

    async deleteVisualizationByTitle(title: string) {
      log.debug(`Deleting visualization with title '${title}'...`);

      const visualizationId = await this.getVisualizationId(title);
      if (visualizationId === undefined) {
        log.debug(`Visualization with title '${title}' does not exists. Nothing to delete.`);
        return;
      } else {
        await this.deleteVisualizationById(visualizationId);
      }
    },

    async deleteVisualizationById(id: string) {
      await this.deleteSavedObjectById(id, SavedObjectType.VISUALIZATION);
    },

    async deleteDashboardByTitle(title: string) {
      log.debug(`Deleting dashboard with title '${title}'...`);

      const dashboardId = await this.getDashboardId(title);
      if (dashboardId === undefined) {
        log.debug(`Dashboard with title '${title}' does not exists. Nothing to delete.`);
        return;
      } else {
        await this.deleteDashboardById(dashboardId);
      }
    },

    async deleteDashboardById(id: string) {
      await this.deleteSavedObjectById(id, SavedObjectType.DASHBOARD);
    },

    async deleteSavedSearches() {
      for (const search of Object.values(savedSearches)) {
        await this.deleteSavedSearchByTitle(search.requestBody.attributes.title);
      }
    },

    async deleteDashboards() {
      for (const dashboard of Object.values(dashboards)) {
        await this.deleteDashboardByTitle(dashboard.requestBody.attributes.title);
      }
    },

    async assertSavedObjectExistsByTitle(title: string, objectType: SavedObjectType) {
      await retry.waitForWithTimeout(
        `${objectType} with title '${title}' to exist`,
        5 * 1000,
        async () => {
          if ((await this.savedObjectExistsByTitle(title, objectType)) === true) {
            return true;
          } else {
            throw new Error(`${objectType} with title '${title}' should exist.`);
          }
        }
      );
    },

    async assertSavedObjectNotExistsByTitle(title: string, objectType: SavedObjectType) {
      await retry.waitForWithTimeout(
        `${objectType} with title '${title}' not to exist`,
        5 * 1000,
        async () => {
          if ((await this.savedObjectExistsByTitle(title, objectType)) === false) {
            return true;
          } else {
            throw new Error(`${objectType} with title '${title}' should not exist.`);
          }
        }
      );
    },

    async assertSavedObjectExistsById(id: string, objectType: SavedObjectType) {
      await retry.waitForWithTimeout(
        `${objectType} with id '${id}' to exist`,
        5 * 1000,
        async () => {
          if ((await this.savedObjectExistsById(id, objectType)) === true) {
            return true;
          } else {
            throw new Error(`${objectType} with id '${id}' should exist.`);
          }
        }
      );
    },

    async assertSavedObjectNotExistsById(id: string, objectType: SavedObjectType) {
      await retry.waitForWithTimeout(
        `${objectType} with id '${id}' not to exist`,
        5 * 1000,
        async () => {
          if ((await this.savedObjectExistsById(id, objectType)) === false) {
            return true;
          } else {
            throw new Error(`${objectType} with id '${id}' should not exist.`);
          }
        }
      );
    },

    async assertIndexPatternExistByTitle(title: string) {
      await this.assertSavedObjectExistsByTitle(title, SavedObjectType.INDEX_PATTERN);
    },

    async assertIndexPatternExistById(id: string) {
      await this.assertSavedObjectExistsById(id, SavedObjectType.INDEX_PATTERN);
    },

    async assertSavedSearchExistByTitle(title: string) {
      await this.assertSavedObjectExistsByTitle(title, SavedObjectType.SEARCH);
    },

    async assertSavedSearchExistById(id: string) {
      await this.assertSavedObjectExistsById(id, SavedObjectType.SEARCH);
    },

    async assertVisualizationExistByTitle(title: string) {
      await this.assertSavedObjectExistsByTitle(title, SavedObjectType.VISUALIZATION);
    },

    async assertVisualizationExistById(id: string) {
      await this.assertSavedObjectExistsById(id, SavedObjectType.VISUALIZATION);
    },

    async assertDashboardExistByTitle(title: string) {
      await this.assertSavedObjectExistsByTitle(title, SavedObjectType.DASHBOARD);
    },

    async assertDashboardExistById(id: string) {
      await this.assertSavedObjectExistsById(id, SavedObjectType.DASHBOARD);
    },

    async deleteMlSavedObjectByJobId(jobId: string, jobType: JobType) {
      const savedObjectId = `${jobType}-${jobId}`;
      await this.deleteSavedObjectById(savedObjectId, SavedObjectType.ML_JOB, true);
    },

    async cleanMLSavedObjects() {
      log.debug('Deleting ML saved objects ...');
      const savedObjectIds = await this.getSavedObjectIdsByType(SavedObjectType.ML_JOB);
      for (const id of savedObjectIds) {
        await this.deleteSavedObjectById(id, SavedObjectType.ML_JOB, true);
      }
      log.debug('> ML saved objects deleted.');
    },

    async setupFleet() {
      log.debug(`Setting up Fleet`);
      await retry.tryForTime(2 * 60 * 1000, async () => {
        await supertest.post(`/api/fleet/setup`).set(COMMON_REQUEST_HEADERS).expect(200);
      });
      log.debug(` > Setup done`);
    },

    async installFleetPackage(packageName: string): Promise<string> {
      log.debug(`Installing Fleet package '${packageName}'`);

      const version = await this.getFleetPackageVersion(packageName);
      const packageWithVersion = `${packageName}-${version}`;

      await supertest
        .post(`/api/fleet/epm/packages/${packageWithVersion}`)
        .set(COMMON_REQUEST_HEADERS)
        .expect(200);

      log.debug(` > Installed`);
      return packageWithVersion;
    },

    async removeFleetPackage(packageWithVersion: string) {
      log.debug(`Removing Fleet package '${packageWithVersion}'`);

      await supertest
        .delete(`/api/fleet/epm/packages/${packageWithVersion}`)
        .set(COMMON_REQUEST_HEADERS)
        .expect(200);

      log.debug(` > Removed`);
    },

    async getFleetPackageVersion(packageName: string): Promise<string> {
      log.debug(`Fetching version for Fleet package '${packageName}'`);
      let packageVersion = '';

      await retry.tryForTime(10 * 1000, async () => {
        const { body } = await supertest
          .get(`/api/fleet/epm/packages?experimental=true`)
          .set(COMMON_REQUEST_HEADERS)
          .expect(200);

        packageVersion =
          body.response.find(
            ({ name, version }: { name: string; version: string }) =>
              name === packageName && version
          )?.version ?? '';

        expect(packageVersion).to.not.eql(
          '',
          `Fleet package definition for '${packageName}' should exist and have a version`
        );
      });

      log.debug(` > found version '${packageVersion}'`);
      return packageVersion;
    },

    async setAdvancedSettingProperty(
      propertyName: string,
      propertyValue: string | number | boolean
    ) {
      await kibanaServer.uiSettings.update({
        [propertyName]: propertyValue,
      });
    },

    async clearAdvancedSettingProperty(propertyName: string) {
      await kibanaServer.uiSettings.unset(propertyName);
    },
  };
}
