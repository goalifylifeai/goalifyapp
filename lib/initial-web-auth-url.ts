// Imported by index.ts before expo-router/entry: the router saves the
// starting URL as soon as it loads and writes it back on first render, so
// auth-email tokens must be taken out of the address bar before that.
import { takeInitialWebAuthUrl } from './auth-link';

export const initialWebAuthUrl = takeInitialWebAuthUrl();
