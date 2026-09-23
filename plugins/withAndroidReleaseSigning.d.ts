import type { ConfigPlugin } from 'expo/config-plugins';

declare const withAndroidReleaseSigning: ConfigPlugin;
export default withAndroidReleaseSigning;
export function applyReleaseSigning(contents: string): string;
