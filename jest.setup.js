// AsyncStorage has no native module under Jest. Test files that need their own
// behaviour still override this with jest.mock().
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
