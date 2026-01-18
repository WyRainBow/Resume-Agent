"""Agent execution state management.

Defines states and state transitions for agent execution.
"""

from enum import Enum
from typing import Optional, Set, Dict, Any


class AgentState(str, Enum):
    """States in the agent execution lifecycle.

    The state machine follows this flow:
    IDLE -> STARTING -> RUNNING -> (THINKING | TOOL_EXECUTING | OUTPUTTING)
    -> (COMPLETED | ERROR | STOPPED) -> IDLE
    """

    # Initial state - agent is ready
    IDLE = "idle"

    # Agent is starting up
    STARTING = "starting"

    # Agent is actively running (general state)
    RUNNING = "running"

    # Agent is thinking/reasoning
    THINKING = "thinking"

    # Agent is executing a tool
    TOOL_EXECUTING = "tool_executing"

    # Agent is generating output
    OUTPUTTING = "outputting"

    # Agent completed successfully
    COMPLETED = "completed"

    # Agent encountered an error
    ERROR = "error"

    # Agent was stopped by user
    STOPPED = "stopped"

    # Agent is waiting for user input
    WAITING = "waiting"

    def is_terminal(self) -> bool:
        """Check if this is a terminal state."""
        return self in {
            AgentState.COMPLETED,
            AgentState.ERROR,
            AgentState.STOPPED,
        }

    def is_active(self) -> bool:
        """Check if this is an active (non-idle) state."""
        return self in {
            AgentState.STARTING,
            AgentState.RUNNING,
            AgentState.THINKING,
            AgentState.TOOL_EXECUTING,
            AgentState.OUTPUTTING,
            AgentState.WAITING,
        }

    def can_transition_to(self, target_state: "AgentState") -> bool:
        """Check if transition to target state is valid."""
        valid_transitions: Dict[AgentState, Set[AgentState]] = {
            AgentState.IDLE: {AgentState.STARTING},
            AgentState.STARTING: {AgentState.RUNNING, AgentState.ERROR},
            AgentState.RUNNING: {
                AgentState.THINKING,
                AgentState.TOOL_EXECUTING,
                AgentState.OUTPUTTING,
                AgentState.COMPLETED,
                AgentState.ERROR,
                AgentState.STOPPED,
            },
            AgentState.THINKING: {
                AgentState.TOOL_EXECUTING,
                AgentState.OUTPUTTING,
                AgentState.RUNNING,
                AgentState.COMPLETED,
                AgentState.ERROR,
                AgentState.STOPPED,
            },
            AgentState.TOOL_EXECUTING: {
                AgentState.THINKING,
                AgentState.OUTPUTTING,
                AgentState.RUNNING,
                AgentState.COMPLETED,
                AgentState.ERROR,
                AgentState.STOPPED,
            },
            AgentState.OUTPUTTING: {
                AgentState.THINKING,
                AgentState.RUNNING,
                AgentState.COMPLETED,
                AgentState.ERROR,
                AgentState.STOPPED,
            },
            AgentState.WAITING: {
                AgentState.RUNNING,
                AgentState.COMPLETED,
                AgentState.STOPPED,
            },
            AgentState.COMPLETED: {AgentState.IDLE},
            AgentState.ERROR: {AgentState.IDLE},
            AgentState.STOPPED: {AgentState.IDLE},
        }
        return target_state in valid_transitions.get(self, set())


class StateInfo:
    """Information about the current state."""

    def __init__(
        self,
        state: AgentState,
        message: str | None = None,
        data: Dict[str, Any] | None = None,
    ) -> None:
        """Initialize state info.

        Args:
            state: The current agent state
            message: Optional message describing the state
            data: Optional additional data
        """
        self.state = state
        self.message = message
        self.data = data or {}
        self.timestamp: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "state": self.state.value,
            "message": self.message,
            "data": self.data,
        }


class StateTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""

    def __init__(
        self,
        from_state: AgentState,
        to_state: AgentState,
        message: str | None = None,
    ) -> None:
        """Initialize the error.

        Args:
            from_state: The source state
            to_state: The target state
            message: Optional error message
        """
        self.from_state = from_state
        self.to_state = to_state
        self.message = message or (
            f"Invalid state transition: {from_state.value} -> {to_state.value}"
        )
        super().__init__(self.message)
