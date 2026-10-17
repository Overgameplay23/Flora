import React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";
import AppErrorBoundary, { CRASH_COPY } from "../components/AppErrorBoundary";
import { clearDiagLogs, getDiagLogs } from "../utils/diagLog";

const switches = { explode: true };
let mounts = 0;

function Fragile() {
  React.useState(() => {
    mounts += 1;
    return null;
  });
  if (switches.explode) throw new Error("the garden fell over");
  return <Text>garden</Text>;
}

const textOf = (tree: renderer.ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((node) => [].concat(node.props.children).join("")).join(" | ");

describe("AppErrorBoundary", () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    switches.explode = true;
    mounts = 0;
    clearDiagLogs();
    // React and the boundary both log the caught error; keep the test output readable
    spy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it("shows the calm screen instead of a blank app, and logs the crash for Diagnostics", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AppErrorBoundary>
          <Fragile />
        </AppErrorBoundary>
      );
    });
    const shown = textOf(tree);
    expect(shown).toContain(CRASH_COPY.title);
    expect(shown).toContain(CRASH_COPY.retry);
    expect(shown).not.toContain("garden |");

    const crash = getDiagLogs().find((entry) => entry.event === "APP_CRASH");
    expect(crash?.payload).toMatchObject({ message: "the garden fell over" });
  });

  it("tries again with a fresh mount, and stays on the calm screen while the error persists", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AppErrorBoundary>
          <Fragile />
        </AppErrorBoundary>
      );
    });
    const pressRetry = () => act(() => tree.root.findByProps({ accessibilityRole: "button" }).props.onPress());

    pressRetry();
    expect(textOf(tree)).toContain(CRASH_COPY.title);

    switches.explode = false;
    const before = mounts;
    pressRetry();
    expect(textOf(tree)).toBe("garden");
    expect(mounts).toBeGreaterThan(before);
  });

  it("never blames the person or mentions losing anything", () => {
    const words = `${CRASH_COPY.title} ${CRASH_COPY.body}`.toLowerCase();
    expect(words).toContain("safe");
    expect(words).not.toMatch(/you (did|broke)|lost|fault|error code/);
  });
});
