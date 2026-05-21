from typing import Callable, Dict, Type


class AgentRegistry:
    """Agent 注册中心（简化版）"""

    _agents: Dict[str, Type] = {}
    _factories: Dict[str, Callable] = {}

    @classmethod
    def register(cls, name: str, agent_class: Type = None, factory: Callable = None):
        def decorator(agent_cls: Type):
            cls._agents[name] = agent_cls
            return agent_cls

        if agent_class:
            cls._agents[name] = agent_class
            return agent_class

        if factory:
            cls._factories[name] = factory
            return factory

        return decorator

    @classmethod
    def create(cls, name: str, **kwargs):
        if name in cls._factories:
            return cls._factories[name](**kwargs)
        if name in cls._agents:
            agent_cls = cls._agents[name]
            try:
                return agent_cls(**kwargs)
            except TypeError:
                return agent_cls()
        raise ValueError(f"Unknown agent type: {name}")
