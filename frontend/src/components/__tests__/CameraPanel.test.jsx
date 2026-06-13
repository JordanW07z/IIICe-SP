import { render, screen } from "@testing-library/react";
import CameraPanel from "../CameraPanel.jsx";

const shelf = {
  id: 1, stage: "small_medium",
  detections: [
    { box: [0.2, 0.2, 0.2, 0.2], label: "dont_water", stage: "small_medium", confidence: 0.9 },
    { box: [0.6, 0.5, 0.2, 0.2], label: "water", stage: "none", confidence: 0.8 },
  ],
};

test("renders one box per detection with label-coded class", () => {
  render(<CameraPanel shelf={shelf} />);
  const boxes = screen.getAllByTestId("det-box");
  expect(boxes).toHaveLength(2);
  expect(boxes[0].className).toContain("box-dont_water");
  expect(boxes[1].className).toContain("box-water");
});

test("shows the stage label", () => {
  render(<CameraPanel shelf={shelf} />);
  expect(screen.getByText(/small_medium/)).toBeInTheDocument();
});
