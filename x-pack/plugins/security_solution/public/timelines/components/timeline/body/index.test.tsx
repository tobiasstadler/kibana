/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { waitFor } from '@testing-library/react';

import { DefaultCellRenderer } from '../cell_rendering/default_cell_renderer';
import '../../../../common/mock/match_media';
import { mockBrowserFields } from '../../../../common/containers/source/mock';
import { Direction } from '../../../../../common/search_strategy';
import { defaultHeaders, mockTimelineData, mockTimelineModel } from '../../../../common/mock';
import { TestProviders } from '../../../../common/mock/test_providers';
import { useAppToasts } from '../../../../common/hooks/use_app_toasts';
import { useAppToastsMock } from '../../../../common/hooks/use_app_toasts.mock';

import { BodyComponent, StatefulBodyProps } from '.';
import { Sort } from './sort';
import { getDefaultControlColumn } from './control_columns';
import { useMountAppended } from '../../../../common/utils/use_mount_appended';
import { timelineActions } from '../../../store/timeline';
import { TimelineTabs } from '../../../../../common/types/timeline';
import { defaultRowRenderers } from './renderers';

jest.mock('../../../../common/lib/kibana/hooks');
jest.mock('../../../../common/hooks/use_app_toasts');
jest.mock('../../../../common/lib/kibana', () => {
  const originalModule = jest.requireActual('../../../../common/lib/kibana');
  return {
    ...originalModule,
    useKibana: jest.fn().mockReturnValue({
      services: {
        application: {
          navigateToApp: jest.fn(),
          getUrlForApp: jest.fn(),
          capabilities: {
            siem: { crud_alerts: true, read_alerts: true },
          },
        },
        data: {
          search: jest.fn(),
          query: jest.fn(),
        },
        uiSettings: {
          get: jest.fn(),
        },
        savedObjects: {
          client: {},
        },
        timelines: {
          getLastUpdated: jest.fn(),
          getLoadingPanel: jest.fn(),
          getFieldBrowser: jest.fn(),
          getUseDraggableKeyboardWrapper: () =>
            jest.fn().mockReturnValue({
              onBlur: jest.fn(),
              onKeyDown: jest.fn(),
            }),
          getAddToCasePopover: jest
            .fn()
            .mockReturnValue(<div data-test-subj="add-to-case-action">{'Add to case'}</div>),
          getAddToCaseAction: jest.fn(),
        },
      },
    }),
    useGetUserSavedObjectPermissions: jest.fn(),
  };
});

const mockSort: Sort[] = [
  {
    columnId: '@timestamp',
    columnType: 'number',
    sortDirection: Direction.desc,
  },
];

const mockDispatch = jest.fn();
jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');

  return {
    ...original,
    useDispatch: () => mockDispatch,
  };
});

jest.mock('../../../../common/hooks/use_selector', () => ({
  useShallowEqualSelector: () => mockTimelineModel,
  useDeepEqualSelector: () => mockTimelineModel,
}));

jest.mock('../../../../common/components/link_to');

// Prevent Resolver from rendering
jest.mock('../../graph_overlay');

jest.mock(
  'react-visibility-sensor',
  () =>
    ({ children }: { children: (args: { isVisible: boolean }) => React.ReactNode }) =>
      children({ isVisible: true })
);

jest.mock('../../../../common/lib/helpers/scheduler', () => ({
  requestIdleCallbackViaScheduler: (callback: () => void, opts?: unknown) => {
    callback();
  },
  maxDelay: () => 3000,
}));

describe('Body', () => {
  const mount = useMountAppended();
  const mockRefetch = jest.fn();
  let appToastsMock: jest.Mocked<ReturnType<typeof useAppToastsMock.create>>;

  beforeEach(() => {
    appToastsMock = useAppToastsMock.create();
    (useAppToasts as jest.Mock).mockReturnValue(appToastsMock);
  });

  const ACTION_BUTTON_COUNT = 4;

  const props: StatefulBodyProps = {
    activePage: 0,
    browserFields: mockBrowserFields,
    clearSelected: jest.fn() as unknown as StatefulBodyProps['clearSelected'],
    columnHeaders: defaultHeaders,
    data: mockTimelineData,
    eventIdToNoteIds: {},
    excludedRowRendererIds: [],
    id: 'timeline-test',
    isSelectAllChecked: false,
    loadingEventIds: [],
    pinnedEventIds: {},
    refetch: mockRefetch,
    renderCellValue: DefaultCellRenderer,
    rowRenderers: defaultRowRenderers,
    selectedEventIds: {},
    setSelected: jest.fn() as unknown as StatefulBodyProps['setSelected'],
    sort: mockSort,
    showCheckboxes: false,
    tabType: TimelineTabs.query,
    totalPages: 1,
    leadingControlColumns: getDefaultControlColumn(ACTION_BUTTON_COUNT),
    trailingControlColumns: [],
  };

  describe('rendering', () => {
    test('it renders the column headers', () => {
      const wrapper = mount(
        <TestProviders>
          <BodyComponent {...props} />
        </TestProviders>
      );

      expect(wrapper.find('[data-test-subj="column-headers"]').first().exists()).toEqual(true);
    });

    test('it renders the scroll container', () => {
      const wrapper = mount(
        <TestProviders>
          <BodyComponent {...props} />
        </TestProviders>
      );

      expect(wrapper.find('[data-test-subj="timeline-body"]').first().exists()).toEqual(true);
    });

    test('it renders events', () => {
      const wrapper = mount(
        <TestProviders>
          <BodyComponent {...props} />
        </TestProviders>
      );

      expect(wrapper.find('[data-test-subj="events"]').first().exists()).toEqual(true);
    });

    test('it renders a tooltip for timestamp', async () => {
      const headersJustTimestamp = defaultHeaders.filter((h) => h.id === '@timestamp');
      const testProps = { ...props, columnHeaders: headersJustTimestamp };
      const wrapper = mount(
        <TestProviders>
          <BodyComponent {...testProps} />
        </TestProviders>
      );
      wrapper.update();
      await waitFor(() => {
        wrapper.update();
        headersJustTimestamp.forEach(() => {
          expect(
            wrapper
              .find('[data-test-subj="data-driven-columns"]')
              .first()
              .find('[data-test-subj="localized-date-tool-tip"]')
              .exists()
          ).toEqual(true);
        });
      });
    }, 20000);
  });

  describe('action on event', () => {
    const addaNoteToEvent = (wrapper: ReturnType<typeof mount>, note: string) => {
      wrapper.find('[data-test-subj="add-note"]').first().find('button').simulate('click');
      wrapper.update();
      wrapper
        .find('[data-test-subj="new-note-tabs"] textarea')
        .simulate('change', { target: { value: note } });
      wrapper.update();
      wrapper.find('button[data-test-subj="add-note"]').first().simulate('click');
      wrapper.update();
    };

    beforeEach(() => {
      mockDispatch.mockClear();
    });

    test('Add a Note to an event', () => {
      const wrapper = mount(
        <TestProviders>
          <BodyComponent {...props} />
        </TestProviders>
      );
      addaNoteToEvent(wrapper, 'hello world');

      expect(mockDispatch).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          payload: {
            eventId: '1',
            id: 'timeline-test',
            noteId: expect.anything(),
          },
          type: timelineActions.addNoteToEvent({
            eventId: '1',
            id: 'timeline-test',
            noteId: '11',
          }).type,
        })
      );
      expect(mockDispatch).toHaveBeenNthCalledWith(
        3,
        timelineActions.pinEvent({
          eventId: '1',
          id: 'timeline-test',
        })
      );
    });

    test('Add two Note to an event', () => {
      const Proxy = (proxyProps: StatefulBodyProps) => (
        <TestProviders>
          <BodyComponent {...proxyProps} />
        </TestProviders>
      );

      const wrapper = mount(<Proxy {...props} />);
      addaNoteToEvent(wrapper, 'hello world');
      mockDispatch.mockClear();
      wrapper.setProps({ pinnedEventIds: { 1: true } });
      wrapper.update();
      addaNoteToEvent(wrapper, 'new hello world');
      expect(mockDispatch).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          payload: {
            eventId: '1',
            id: 'timeline-test',
            noteId: expect.anything(),
          },
          type: timelineActions.addNoteToEvent({
            eventId: '1',
            id: 'timeline-test',
            noteId: '11',
          }).type,
        })
      );
      expect(mockDispatch).not.toHaveBeenCalledWith(
        timelineActions.pinEvent({
          eventId: '1',
          id: 'timeline-test',
        })
      );
    });
  });

  describe('event details', () => {
    beforeEach(() => {
      mockDispatch.mockReset();
    });
    test('call the right reduce action to show event details for query tab', async () => {
      const wrapper = mount(
        <TestProviders>
          <BodyComponent {...props} />
        </TestProviders>
      );

      wrapper.find(`[data-test-subj="expand-event"]`).first().simulate('click');
      wrapper.update();
      expect(mockDispatch).toBeCalledTimes(1);
      expect(mockDispatch.mock.calls[0][0]).toEqual({
        payload: {
          panelView: 'eventDetail',
          params: {
            eventId: '1',
            indexName: undefined,
            refetch: mockRefetch,
          },
          tabType: 'query',
          timelineId: 'timeline-test',
        },
        type: 'x-pack/timelines/t-grid/TOGGLE_DETAIL_PANEL',
      });
    });

    test('call the right reduce action to show event details for pinned tab', async () => {
      const wrapper = mount(
        <TestProviders>
          <BodyComponent {...props} tabType={TimelineTabs.pinned} />
        </TestProviders>
      );

      wrapper.find(`[data-test-subj="expand-event"]`).first().simulate('click');
      wrapper.update();
      expect(mockDispatch).toBeCalledTimes(1);
      expect(mockDispatch.mock.calls[0][0]).toEqual({
        payload: {
          panelView: 'eventDetail',
          params: {
            eventId: '1',
            indexName: undefined,
            refetch: mockRefetch,
          },
          tabType: 'pinned',
          timelineId: 'timeline-test',
        },
        type: 'x-pack/timelines/t-grid/TOGGLE_DETAIL_PANEL',
      });
    });

    test('call the right reduce action to show event details for notes tab', async () => {
      const wrapper = mount(
        <TestProviders>
          <BodyComponent {...props} tabType={TimelineTabs.notes} />
        </TestProviders>
      );

      wrapper.find(`[data-test-subj="expand-event"]`).first().simulate('click');
      wrapper.update();
      expect(mockDispatch).toBeCalledTimes(1);
      expect(mockDispatch.mock.calls[0][0]).toEqual({
        payload: {
          panelView: 'eventDetail',
          params: {
            eventId: '1',
            indexName: undefined,
            refetch: mockRefetch,
          },
          tabType: 'notes',
          timelineId: 'timeline-test',
        },
        type: 'x-pack/timelines/t-grid/TOGGLE_DETAIL_PANEL',
      });
    });
  });
});
