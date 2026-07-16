import { useRef } from "react";

export function useStreamRunController() {
  const streamRunRef = useRef(0);

  const startNewRun = () => {
    streamRunRef.current += 1;
    return streamRunRef.current;
  };

  return {
    streamRunRef,
    startNewRun,
  };
}
