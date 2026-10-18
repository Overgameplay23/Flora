// What VoiceOver and Larger Text get from the shared kit (src/components/common). Every screen builds on these, so a
// change here reaches the whole app; these tests keep the names, roles and states from slipping.
import React from "react";
import { Text, TextInput } from "react-native";
import renderer, { act } from "react-test-renderer";
import Button from "../components/common/Button";
import Chip from "../components/common/Chip";
import TextField from "../components/common/TextField";
import Card from "../components/common/Card";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));

function render(element: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  return tree;
}

const flat = (style: any): Record<string, any> => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
// the outermost element that carries a role (a busy button has no onPress on purpose, so the role is the marker)
const pressable = (tree: renderer.ReactTestRenderer) => tree.root.findAll((node) => typeof node.props.accessibilityRole === "string")[0];

describe("accessibility: the kit", () => {
  it("names a button, says when it is busy or off, and lets its label wrap with Larger Text", () => {
    const tree = render(<Button label="Delete my account" onPress={() => {}} loading />);
    const button = pressable(tree);
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityLabel).toBe("Delete my account");
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });

    const idle = render(<Button label="Keep my account" onPress={() => {}} />);
    const style = flat(idle.root.findAll((n) => n.props.style && flat(n.props.style).minHeight != null)[0]?.props.style);
    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBeGreaterThan(0);
    const label = idle.root.findAllByType(Text).find((t) => t.props.children === "Keep my account");
    expect(label?.props.numberOfLines).toBeGreaterThanOrEqual(2);
  });

  it("gives a chip the role it plays", () => {
    const action = pressable(render(<Chip label="3 days" role="button" onPress={() => {}} />));
    expect(action.props.accessibilityRole).toBe("button");
    expect(action.props.accessibilityState).not.toHaveProperty("checked");

    const choice = pressable(render(<Chip label="7:30" role="radio" selected onPress={() => {}} />));
    expect(choice.props.accessibilityRole).toBe("radio");
    expect(choice.props.accessibilityState).toMatchObject({ selected: true, checked: true });

    const many = pressable(render(<Chip label="Sleep" selected={false} onPress={() => {}} />));
    expect(many.props.accessibilityRole).toBe("checkbox");
    expect(many.props.accessibilityState).toMatchObject({ checked: false });
  });

  it("names a text field by its label, not its placeholder, and reads its note as the hint", () => {
    const tree = render(<TextField label="Email" placeholder="you@example.com" note="We never share it" />);
    const input = tree.root.findByType(TextInput);
    expect(input.props.accessibilityLabel).toBe("Email");
    expect(input.props.accessibilityHint).toBe("We never share it");
    // the visible label is not read a second time
    const visible = tree.root.findAllByType(Text).find((t) => t.props.children === "Email");
    expect(visible?.props.accessibilityElementsHidden).toBe(true);
  });

  it("makes a labelled card one element, and leaves an unlabelled one open", () => {
    const labelled = render(<Card accessibilityLabel="Warm Blankets: 1 of 3"><Text>inside</Text></Card>);
    expect(labelled.root.findAll((n) => n.props.accessible === true && n.props.accessibilityLabel === "Warm Blankets: 1 of 3").length).toBeGreaterThan(0);
    const open = render(<Card><Text>inside</Text></Card>);
    expect(open.root.findAll((n) => n.props.accessible === true).length).toBe(0);
  });
});
