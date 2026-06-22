"""WebSocket endpoint for real-time updates."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from state import ws_manager

router = APIRouter()


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket connection for live indexing progress."""
    await ws_manager.connect(websocket, client_id)

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("action") == "subscribe":
                channel = data.get("channel", "repos")
                ws_manager.subscribe(client_id, channel)
                await ws_manager.send_personal_message(
                    {"type": "subscribed", "channel": channel}, client_id
                )

            elif data.get("action") == "unsubscribe":
                channel = data.get("channel")
                if channel and client_id in ws_manager.subscriptions[channel]:
                    ws_manager.subscriptions[channel].remove(client_id)

            elif data.get("action") == "ping":
                await ws_manager.send_personal_message({"type": "pong"}, client_id)

    except WebSocketDisconnect:
        ws_manager.disconnect(client_id)
