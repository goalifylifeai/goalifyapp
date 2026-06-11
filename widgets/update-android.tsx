import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { GoalifyMediumWidget } from './GoalifyMediumWidget';
import { ANDROID_WIDGET_NAME } from '../lib/widget-bridge';
import type { WidgetSnapshot } from '../lib/widget-snapshot';

/** Repaint the Android medium widget with a fresh snapshot. */
export async function updateAndroidWidget(snapshot: WidgetSnapshot): Promise<void> {
  await requestWidgetUpdate({
    widgetName: ANDROID_WIDGET_NAME,
    renderWidget: () => <GoalifyMediumWidget snapshot={snapshot} />,
    widgetNotFound: () => {
      // No widget pinned to the home screen — nothing to do.
    },
  });
}
