from channels.generic.websocket import AsyncWebsocketConsumer
import json


class SignalingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        self.room_name = 'video_call_room' #fixed room for p2p
        await self.channel_layer.group_add(self.room_name, self.channel_name)

    
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_name, self.channel_name)

    async def receive(self, text_data):
        await self.channel_layer.group_send(
            self.room_name,
            {
                "type": "signal.message",
                "message": text_data,
                "sender": self.channel_name,
            },
        )

    async def signal_message(self, event):
        if self.channel_name != event["sender"]:
            await self.send(text_data=event["message"])


