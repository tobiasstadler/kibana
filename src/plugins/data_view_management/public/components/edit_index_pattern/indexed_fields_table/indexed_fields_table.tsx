/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { Component } from 'react';
import { i18n } from '@kbn/i18n';
import { createSelector } from 'reselect';
import { OverlayStart } from 'src/core/public';
import { IndexPatternField, IndexPattern } from '../../../../../../plugins/data/public';
import { useKibana } from '../../../../../../plugins/kibana_react/public';
import { Table } from './components/table';
import { IndexedFieldItem } from './types';
import { IndexPatternManagmentContext } from '../../../types';

interface IndexedFieldsTableProps {
  fields: IndexPatternField[];
  indexPattern: IndexPattern;
  fieldFilter?: string;
  indexedFieldTypeFilter?: string;
  helpers: {
    editField: (fieldName: string) => void;
    deleteField: (fieldName: string) => void;
    getFieldInfo: (indexPattern: IndexPattern, field: IndexPatternField) => string[];
  };
  fieldWildcardMatcher: (filters: any[]) => (val: any) => boolean;
  userEditPermission: boolean;
  openModal: OverlayStart['openModal'];
}

interface IndexedFieldsTableState {
  fields: IndexedFieldItem[];
}

const withHooks = (Comp: typeof Component) => {
  return (props: any) => {
    const { application } = useKibana<IndexPatternManagmentContext>().services;
    const userEditPermission = !!application?.capabilities?.indexPatterns?.save;

    return <Comp userEditPermission={userEditPermission} {...props} />;
  };
};

class IndexedFields extends Component<IndexedFieldsTableProps, IndexedFieldsTableState> {
  constructor(props: IndexedFieldsTableProps) {
    super(props);

    this.state = {
      fields: this.mapFields(this.props.fields),
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps: IndexedFieldsTableProps) {
    if (nextProps.fields !== this.props.fields) {
      this.setState({
        fields: this.mapFields(nextProps.fields),
      });
    }
  }

  mapFields(fields: IndexPatternField[]): IndexedFieldItem[] {
    const { indexPattern, fieldWildcardMatcher, helpers, userEditPermission } = this.props;
    const sourceFilters =
      indexPattern.sourceFilters &&
      indexPattern.sourceFilters.map((f: Record<string, any>) => f.value);
    const fieldWildcardMatch = fieldWildcardMatcher(sourceFilters || []);

    const getDisplayEsType = (arr: string[]): string => {
      const length = arr.length;
      if (length < 1) {
        return '';
      }
      if (length > 1) {
        return i18n.translate('indexPatternManagement.editIndexPattern.fields.conflictType', {
          defaultMessage: 'conflict',
        });
      }
      return arr[0];
    };

    return (
      (fields &&
        fields.map((field) => {
          return {
            ...field.spec,
            type: getDisplayEsType(field.esTypes || []),
            kbnType: field.type,
            displayName: field.displayName,
            format: indexPattern.getFormatterForFieldNoDefault(field.name)?.type?.title || '',
            excluded: fieldWildcardMatch ? fieldWildcardMatch(field.name) : false,
            info: helpers.getFieldInfo && helpers.getFieldInfo(indexPattern, field),
            isMapped: !!field.isMapped,
            isUserEditable: userEditPermission,
            hasRuntime: !!field.runtimeField,
          };
        })) ||
      []
    );
  }

  getFilteredFields = createSelector(
    (state: IndexedFieldsTableState) => state.fields,
    (state: IndexedFieldsTableState, props: IndexedFieldsTableProps) => props.fieldFilter,
    (state: IndexedFieldsTableState, props: IndexedFieldsTableProps) =>
      props.indexedFieldTypeFilter,
    (fields, fieldFilter, indexedFieldTypeFilter) => {
      if (fieldFilter) {
        const normalizedFieldFilter = fieldFilter.toLowerCase();
        fields = fields.filter(
          (field) =>
            field.name.toLowerCase().includes(normalizedFieldFilter) ||
            (field.displayName && field.displayName.toLowerCase().includes(normalizedFieldFilter))
        );
      }

      if (indexedFieldTypeFilter) {
        fields = fields.filter((field) => field.type === indexedFieldTypeFilter);
      }

      return fields;
    }
  );

  render() {
    const { indexPattern } = this.props;
    const fields = this.getFilteredFields(this.state, this.props);

    return (
      <div>
        <Table
          indexPattern={indexPattern}
          items={fields}
          editField={(field) => this.props.helpers.editField(field.name)}
          deleteField={(fieldName) => this.props.helpers.deleteField(fieldName)}
          openModal={this.props.openModal}
        />
      </div>
    );
  }
}

export const IndexedFieldsTable = withHooks(IndexedFields);
