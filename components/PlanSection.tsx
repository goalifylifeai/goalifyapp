import React from 'react';
import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/theme';
import { PAID_PLAN_NAME } from '../constants/brand';
import { Card, SectionLabel, F } from './ui';
import { usePlan } from '../store/plan';
import { openPaywall } from '../lib/paywall';
import { planDetail, planTitle, storeLabel } from '../lib/plan-state';

const rowStyle = (last: boolean) => ({
  flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
  paddingHorizontal: 14, paddingVertical: 14,
  borderBottomWidth: last ? 0 : 0.5, borderBottomColor: COLORS.ink7,
});

export function PlanSection() {
  const plan = usePlan();

  const onManage = () => {
    if (plan.managementURL) {
      Linking.openURL(plan.managementURL);
      return;
    }
    Alert.alert('Manage subscription', `Manage or cancel your subscription in ${storeLabel(plan.store) ?? 'the store you subscribed with'}.`);
  };

  const onRestore = async () => {
    try {
      const restored = await plan.restore();
      if (restored === 'beyond') Alert.alert('Restored', `${PAID_PLAN_NAME} is active on this account.`);
      else Alert.alert('No subscription found', `We couldn't find a ${PAID_PLAN_NAME} subscription for this account.`);
    } catch {
      Alert.alert('Restore failed', 'Please try again.');
    }
  };

  return (
    <>
      <SectionLabel>{PAID_PLAN_NAME}</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <Card pad={4}>
          <View style={rowStyle(false)}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: COLORS.ink1, fontWeight: '500' }}>{planTitle(plan, new Date())}</Text>
              <Text style={{ fontSize: 12, color: COLORS.ink3, marginTop: 3, lineHeight: 17 }}>{planDetail(plan)}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={plan.plan === 'free' ? () => openPaywall('profile') : onManage}
            style={rowStyle(false)}
          >
            <Text style={{ fontSize: 14, color: COLORS.ink1 }}>{plan.plan === 'free' ? 'Upgrade' : 'Manage subscription'}</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRestore} style={rowStyle(true)}>
            <Text style={{ fontSize: 14, color: COLORS.ink1 }}>Restore purchases</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>↺</Text>
          </TouchableOpacity>
        </Card>
      </View>
    </>
  );
}
