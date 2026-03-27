from dataclasses import dataclass


@dataclass
class SessionState:
    json_output: bool = False


STATE = SessionState()
