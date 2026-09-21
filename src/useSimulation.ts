import { useEffect, useMemo, useState } from "react";
import { trace, validate } from "./engine";
import { useEditor } from "./store";
import { emptySelection } from "./model";
export function useSimulation() {
  const { doc, revision, select } = useEditor(),
    [input, setInput] = useState("1001"),
    [index, setIndex] = useState(0),
    [started, setStarted] = useState(false),
    [playing, setPlaying] = useState(false),
    [highlight, setHighlight] = useState(false),
    [speed, setSpeed] = useState(1);
  const errors = useMemo(() => validate(doc), [doc]);
  const frames = useMemo(
    () => (errors.length ? [] : trace(doc, input)),
    [doc, input, errors],
  );
  const frame = started
    ? frames[Math.min(index, frames.length - 1)]
    : undefined;
  const reset = () => {
    setPlaying(false);
    setIndex(0);
    setStarted(false);
    setHighlight(false);
  };
  useEffect(reset, [revision, input]);
  // Keep the result available, but release canvas highlights after stopping.
  useEffect(() => {
    if (!highlight || !frame || playing) return;
    const timer = window.setTimeout(() => setHighlight(false), 2500);
    return () => window.clearTimeout(timer);
  }, [highlight, frame, playing]);
  const focusSimulation = () => {
    select(emptySelection());
    setHighlight(true);
  };
  useEffect(() => {
    if (!playing) return;
    if (frame && frame.status !== "running") {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setStarted(true);
      setIndex((i) => Math.min(i + 1, frames.length - 1));
    }, 900 / speed);
    return () => clearTimeout(timer);
  }, [playing, index, started, frames.length, speed, frame]);
  return {
    input,
    setInput,
    index,
    started,
    playing,
    speed,
    setSpeed,
    errors,
    frames,
    frame,
    highlight,
    reset,
    next: () => {
      if (errors.length || !frames.length) return;
      focusSimulation();
      setPlaying(false);
      if (!started) {
        setStarted(true);
        setIndex(0);
      } else setIndex((i) => Math.min(i + 1, frames.length - 1));
    },
    back: () => {
      focusSimulation();
      setPlaying(false);
      if (index === 0) setStarted(false);
      else setIndex((i) => i - 1);
    },
    toggle: () => {
      if (errors.length || !frames.length) return;
      if (playing) {
        setPlaying(false);
        return;
      }
      focusSimulation();
      if (!started || frame?.status !== "running") {
        setStarted(true);
        setIndex(0);
      }
      setPlaying(true);
    },
  };
}
export type Simulation = ReturnType<typeof useSimulation>;
