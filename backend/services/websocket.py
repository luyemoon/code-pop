"""WebSocket connection manager for real-time indexing updates."""

from collections import defaultdict
from typing import Dict, List

from fastapi import WebSocket


class ConnectionManager:
    """Manage active WebSocket connections and channel subscriptions."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.subscriptions: defaultdict[str, List[str]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            for channel in list(self.subscriptions.keys()):
                if client_id in self.subscriptions[channel]:
                    self.subscriptions[channel].remove(client_id)

    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(message)

    async def broadcast(self, message: dict, channel: str):
        for client_id in list(self.subscriptions[channel]):
            if client_id in self.active_connections:
                await self.active_connections[client_id].send_json(message)

    def subscribe(self, client_id: str, channel: str):
        if client_id not in self.subscriptions[channel]:
            self.subscriptions[channel].append(client_id)
