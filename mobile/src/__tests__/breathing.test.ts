import { DEFAULT_BREATHS, PATTERN_4_2_6, fullnessAfter, positionAt, sessionLengthMs, sessionSteps } from "../domain/breathing";

describe("4-2-6 breathing", () => {
  const steps = sessionSteps();

  it("makes one minute of five breaths", () => {
    expect(DEFAULT_BREATHS).toBe(5);
    expect(PATTERN_4_2_6.map((phase) => phase.seconds)).toEqual([4, 2, 6]);
    expect(steps).toHaveLength(15);
    expect(sessionLengthMs(steps)).toBe(60_000);
  });

  it("finds the phase and the time left in it", () => {
    expect(positionAt(steps, 0)).toMatchObject({ index: 0, remainingMs: 4000, breathsDone: 0, done: false });
    expect(positionAt(steps, 0).step?.phase.key).toBe("in");
    expect(positionAt(steps, 4500).step?.phase.key).toBe("hold");
    expect(positionAt(steps, 4500).remainingMs).toBe(1500);
    expect(positionAt(steps, 6000).step?.phase.key).toBe("out");
  });

  it("counts a breath once its out-breath ends", () => {
    expect(positionAt(steps, 11_999).breathsDone).toBe(0);
    expect(positionAt(steps, 12_000)).toMatchObject({ breathsDone: 1, done: false });
    expect(positionAt(steps, 12_000).step?.breath).toBe(1);
  });

  it("is done at the end of the minute", () => {
    expect(positionAt(steps, 60_000)).toMatchObject({ done: true, breathsDone: 5, step: null });
    expect(positionAt(steps, 90_000).done).toBe(true);
  });

  it("skips zero-length phases and keeps at least one breath", () => {
    const noHold = sessionSteps([{ key: "in", seconds: 4, label: "In" }, { key: "hold", seconds: 0, label: "Hold" }, { key: "out", seconds: 4, label: "Out" }], 0);
    expect(noHold.map((step) => step.phase.key)).toEqual(["in", "out"]);
  });

  it("fills on the way in, empties on the way out", () => {
    expect(fullnessAfter("in")).toBe(1);
    expect(fullnessAfter("hold")).toBe(1);
    expect(fullnessAfter("out")).toBe(0);
  });
});
