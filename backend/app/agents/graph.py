from __future__ import annotations

from typing import Any

from app.agents.nodes.decision import decision_node, review_pause_node
from app.agents.nodes.executor import executor_node
from app.agents.nodes.mapper import mapper_node
from app.agents.nodes.profiler import profiler_node
from app.agents.nodes.reconciler import reconciler_node
from app.agents.nodes.validator import validator_node
from app.agents.nodes.verifier import verifier_node
from app.agents.state import MigrationState

try:
    from langgraph.graph import END, StateGraph
except ImportError:  # pragma: no cover - requirements install LangGraph; keeps lightweight unit tests usable
    END = "__end__"
    StateGraph = None


async def finalize_node(state: MigrationState) -> dict[str, Any]:
    runtime = state["runtime"]
    executions = await runtime.store.find("execution_batches", {"migration_id": state["migration_id"]})
    open_items = await runtime.store.find("escalations", {"migration_id": state["migration_id"], "status": "open"})
    failed = [item for item in executions if item.get("status") == "failed"]
    status = "review" if open_items else "failed" if failed else "completed"
    await runtime.set_migration_status(state["migration_id"], status)
    await runtime.audit.record(tenant_id=state["tenant_id"], migration_id=state["migration_id"], event_type="migration.completed" if status == "completed" else "migration.paused", agent="control_plane", node="finalize", status=status, metadata={"failed": len(failed), "open_escalations": len(open_items)})
    return {"status": status, "current_node": "finalize"}


def decision_route(state: MigrationState) -> str:
    return "review" if state.get("open_escalations") else "execute"


class MigrationGraph:
    def __init__(self) -> None:
        self.compiled = self._build()
        self.resume_compiled = self._build_resume()

    def _build(self) -> Any:
        if StateGraph is None:
            return None
        graph = StateGraph(MigrationState)
        graph.add_node("profiler", profiler_node)
        graph.add_node("mapper", mapper_node)
        graph.add_node("reconciler", reconciler_node)
        graph.add_node("validator", validator_node)
        graph.add_node("decision_gate", decision_node)
        graph.add_node("review_pause", review_pause_node)
        graph.add_node("executor", executor_node)
        graph.add_node("verifier", verifier_node)
        graph.add_node("finalize", finalize_node)
        graph.set_entry_point("profiler")
        graph.add_edge("profiler", "mapper")
        graph.add_edge("mapper", "reconciler")
        graph.add_edge("reconciler", "validator")
        graph.add_edge("validator", "decision_gate")
        graph.add_conditional_edges("decision_gate", decision_route, {"review": "review_pause", "execute": "executor"})
        graph.add_edge("review_pause", END)
        graph.add_edge("executor", "verifier")
        graph.add_edge("verifier", "finalize")
        graph.add_edge("finalize", END)
        return graph.compile()

    def _build_resume(self) -> Any:
        if StateGraph is None:
            return None
        graph = StateGraph(MigrationState)
        graph.add_node("executor", executor_node)
        graph.add_node("verifier", verifier_node)
        graph.add_node("finalize", finalize_node)
        graph.set_entry_point("executor")
        graph.add_edge("executor", "verifier")
        graph.add_edge("verifier", "finalize")
        graph.add_edge("finalize", END)
        return graph.compile()

    async def run(self, state: MigrationState) -> dict[str, Any]:
        if self.compiled:
            return await self.compiled.ainvoke(state)
        result = await profiler_node(state)
        state.update(result)
        for node in (mapper_node, reconciler_node, validator_node, decision_node):
            result = await node(state)
            state.update(result)
        if state.get("open_escalations"):
            result = await review_pause_node(state)
        else:
            for node in (executor_node, verifier_node, finalize_node):
                result = await node(state)
                state.update(result)
        return state

    async def resume(self, state: MigrationState) -> dict[str, Any]:
        if self.resume_compiled:
            return await self.resume_compiled.ainvoke(state)
        for node in (executor_node, verifier_node, finalize_node):
            result = await node(state)
            state.update(result)
        return state

