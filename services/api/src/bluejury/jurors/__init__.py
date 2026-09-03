from bluejury.schemas.domain import AgentName

JURORS: tuple[AgentName, ...] = (
    AgentName.CATCH,
    AgentName.SAFETY,
    AgentName.FUEL,
    AgentName.ECOLOGY,
    AgentName.BORDER,
)
