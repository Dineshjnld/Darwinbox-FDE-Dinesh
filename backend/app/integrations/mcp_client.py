from __future__ import annotations

import json
from typing import Any

from mcp import ClientSession
from mcp.client.sse import sse_client


class MCPClient:
    """Standard MCP SSE client boundary; the graph only sees named tools."""

    def __init__(self, url: str, api_key: str = "") -> None:
        self.url = url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        async with sse_client(self.url, headers=self.headers, timeout=15, sse_read_timeout=30) as (read_stream, write_stream), ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(name, arguments)
            structured = getattr(result, "structuredContent", None) or getattr(result, "structured_content", None)
            if structured is not None:
                return structured
            content = getattr(result, "content", [])
            for block in content:
                text = getattr(block, "text", None)
                if text:
                    try:
                        return json.loads(text)
                    except json.JSONDecodeError:
                        return {"text": text}
            return result.model_dump() if hasattr(result, "model_dump") else result
