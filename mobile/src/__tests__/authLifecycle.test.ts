const mockStart = jest.fn();
const mockStop = jest.fn();
const mockRemove = jest.fn();
let mockChange: (state: string) => void;
jest.mock("../lib/supabase", () => ({ supabase: { auth: { startAutoRefresh: () => mockStart(), stopAutoRefresh: () => mockStop() } } }));
import { AppState, Platform } from "react-native";
import { watchAuthLifecycle } from "../services/authLifecycle";

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = "ios";
  AppState.currentState = "active";
  jest.spyOn(AppState, "addEventListener").mockImplementation((_, callback) => {
    mockChange = callback;
    return { remove: mockRemove };
  });
});
afterEach(() => jest.restoreAllMocks());
it("pauses refresh in the background, resumes on foreground, and removes its listener", () => {
  const cleanup = watchAuthLifecycle();
  expect(mockStart).toHaveBeenCalledTimes(1);
  mockChange("background");
  expect(mockStop).toHaveBeenCalledTimes(1);
  mockChange("active");
  expect(mockStart).toHaveBeenCalledTimes(2);
  cleanup();
  expect(mockRemove).toHaveBeenCalledTimes(1);
  expect(mockStop).toHaveBeenCalledTimes(2);
});
it("leaves browser visibility handling to Supabase", () => {
  Platform.OS = "web";
  watchAuthLifecycle()();
  expect(mockStart).not.toHaveBeenCalled();
  expect(mockStop).not.toHaveBeenCalled();
});
