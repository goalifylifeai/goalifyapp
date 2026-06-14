import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { GoalifyMediumWidget } from './GoalifyMediumWidget';
import { WIDGET_SNAPSHOT_KEY } from '../lib/widget-bridge';
import type { WidgetSnapshot } from '../lib/widget-snapshot';

const nameToWidget = {
  GoalifyMedium: GoalifyMediumWidget,
};

async function readSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const Widget = nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];
  if (!Widget) return;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const snapshot = await readSnapshot();
      props.renderWidget(<Widget snapshot={snapshot} />);
      break;
    }
    case 'WIDGET_CLICK':
      // Deep link handled by the OPEN_RITUAL clickAction → goalify://ritual/morning
      break;
    default:
      break;
  }
}
